from __future__ import annotations

from dataclasses import dataclass
import json
import re
from urllib.parse import parse_qsl, urlencode, urljoin, urlparse, urlunparse

import httpx
from bs4 import BeautifulSoup

from app.core.config import settings
from app.services.normalization import normalize_language_label


@dataclass
class ScrapedTherapist:
    source: str
    source_id: str
    profile_url: str
    full_name: str
    headline: str | None = None
    city: str | None = None
    state: str | None = None
    remote_available: bool = False
    price_min: int | None = None
    price_max: int | None = None
    approaches: list[str] | None = None
    specialties: list[str] | None = None
    languages: list[str] | None = None
    bio: str | None = None


class DoctoraliaScraper:
    source_name = "doctoralia"
    profile_path_pattern = re.compile(r"^/[a-z0-9-]+(?:/[a-z0-9-]+){0,2}$", re.IGNORECASE)
    price_pattern = re.compile(r"R\$\s*([\d\.]+)", re.IGNORECASE)
    price_range_pattern = re.compile(r"R\$\s*([\d\.]+)(?:\s*-\s*R\$\s*([\d\.]+))?", re.IGNORECASE)

    def __init__(self) -> None:
        self.headers = {"User-Agent": settings.scraper_user_agent}

    def fetch_directory_page(self, page: int) -> str:
        url = self.build_page_url(page)
        with httpx.Client(headers=self.headers, timeout=20) as client:
            response = client.get(url)
            response.raise_for_status()
            return response.text

    def fetch_profile_page(self, profile_url: str) -> str:
        with httpx.Client(headers=self.headers, timeout=20, follow_redirects=True) as client:
            response = client.get(profile_url)
            response.raise_for_status()
            return response.text

    def parse_directory_page(self, html: str) -> list[ScrapedTherapist]:
        soup = BeautifulSoup(html, "html.parser")
        items = self.parse_from_ld_json(soup)
        if items:
            return items

        items = self.parse_from_cards(soup)
        if items:
            return items

        return self.parse_from_links(soup)

    def enrich_profile(self, item: ScrapedTherapist, html: str) -> ScrapedTherapist:
        soup = BeautifulSoup(html, "html.parser")
        text_lines = self.text_lines(soup)
        json_profile = self.extract_profile_json_data(soup)
        bio = self.extract_bio(text_lines)
        approaches = self.extract_approaches(text_lines, bio)
        specialties = self.merge_lists(
            item.specialties,
            json_profile.get("specialties"),
            self.extract_specialties(text_lines),
        )
        languages = self.extract_languages(text_lines)
        city = json_profile.get("city") or self.extract_city_from_profile(text_lines, item.profile_url)
        state = json_profile.get("state") or self.extract_state_from_text(text_lines)
        headline = self.build_headline(item, json_profile, text_lines, approaches, specialties)
        price_min, price_max = self.extract_prices(text_lines)

        return ScrapedTherapist(
            source=item.source,
            source_id=item.source_id,
            profile_url=item.profile_url,
            full_name=json_profile.get("full_name") or item.full_name,
            headline=headline,
            bio=bio or json_profile.get("bio"),
            city=city,
            state=state,
            remote_available=item.remote_available or self.detect_remote(text_lines),
            price_min=price_min,
            price_max=price_max,
            approaches=approaches,
            specialties=specialties,
            languages=languages,
        )

    def build_page_url(self, page: int) -> str:
        if "{page}" in settings.scraper_source_url:
            return settings.scraper_source_url.format(page=page)

        parsed = urlparse(settings.scraper_source_url)
        params = dict(parse_qsl(parsed.query, keep_blank_values=True))
        params["page"] = str(page)
        return urlunparse(parsed._replace(query=urlencode(params)))

    def parse_from_ld_json(self, soup: BeautifulSoup) -> list[ScrapedTherapist]:
        items: list[ScrapedTherapist] = []
        seen: set[str] = set()

        for script in soup.select('script[type="application/ld+json"]'):
            raw = script.string or script.get_text(strip=True)
            if not raw:
                continue

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue

            for entry in self.iter_json_nodes(payload):
                profile = self.extract_from_json_node(entry)
                if not profile or profile.profile_url in seen:
                    continue
                seen.add(profile.profile_url)
                items.append(profile)

        return items

    def parse_from_cards(self, soup: BeautifulSoup) -> list[ScrapedTherapist]:
        items: list[ScrapedTherapist] = []
        seen: set[str] = set()
        selectors = [
            "[data-doctor-id]",
            "article",
            "[data-test='search-result-card']",
            "li",
        ]

        for selector in selectors:
            for card in soup.select(selector):
                profile = self.extract_from_card(card)
                if not profile or profile.profile_url in seen:
                    continue
                seen.add(profile.profile_url)
                items.append(profile)
            if items:
                return items

        return items

    def parse_from_links(self, soup: BeautifulSoup) -> list[ScrapedTherapist]:
        items: list[ScrapedTherapist] = []
        seen: set[str] = set()

        for anchor in soup.select("a[href]"):
            href = anchor.get("href", "").strip()
            if not href:
                continue

            full_url = urljoin("https://www.doctoralia.com.br", href)
            parsed = urlparse(full_url)
            if parsed.netloc and "doctoralia.com.br" not in parsed.netloc:
                continue
            if not self.profile_path_pattern.match(parsed.path):
                continue

            name = anchor.get_text(" ", strip=True)
            if not name or len(name.split()) < 2:
                continue

            profile_url = f"https://www.doctoralia.com.br{parsed.path}"
            if profile_url in seen:
                continue

            seen.add(profile_url)
            items.append(
                ScrapedTherapist(
                    source=self.source_name,
                    source_id=parsed.path.strip("/"),
                    profile_url=profile_url,
                    full_name=name,
                    remote_available=True,
                    approaches=[],
                    specialties=[],
                    languages=[],
                )
            )

        return items

    def extract_from_json_node(self, node: object) -> ScrapedTherapist | None:
        if not isinstance(node, dict):
            return None

        item = node.get("item") if isinstance(node.get("item"), dict) else node
        item_type = item.get("@type")
        if item_type not in {"Physician", "Person", "MedicalBusiness"}:
            return None

        url = item.get("url")
        name = item.get("name")
        if not url or not name:
            return None

        parsed = urlparse(url)
        source_id = parsed.path.strip("/") or str(item.get("@id") or url)
        specialty = item.get("medicalSpecialty")
        specialties = [specialty] if isinstance(specialty, str) else []

        return ScrapedTherapist(
            source=self.source_name,
            source_id=source_id,
            profile_url=url,
            full_name=name.strip(),
            headline=self.pick_string(item, "description"),
            city=self.extract_city(item),
            remote_available=True,
            specialties=specialties,
            approaches=[],
            languages=[],
        )

    def extract_profile_json_data(self, soup: BeautifulSoup) -> dict[str, object]:
        result: dict[str, object] = {}

        for script in soup.select('script[type="application/ld+json"]'):
            raw = script.string or script.get_text(strip=True)
            if not raw:
                continue
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue

            for entry in self.iter_json_nodes(payload):
                if not isinstance(entry, dict):
                    continue
                item = entry.get("item") if isinstance(entry.get("item"), dict) else entry
                item_type = item.get("@type")
                if item_type not in {"Physician", "Person", "MedicalBusiness", "MedicalClinic", "Organization"}:
                    continue

                address = item.get("address")
                specialty = item.get("medicalSpecialty")
                if isinstance(specialty, list):
                    specialties = [value for value in specialty if isinstance(value, str)]
                elif isinstance(specialty, str):
                    specialties = [specialty]
                else:
                    specialties = []

                result.update(
                    {
                        "full_name": self.pick_string(item, "name"),
                        "bio": self.pick_string(item, "description"),
                        "specialties": specialties,
                    }
                )

                if isinstance(address, dict):
                    locality = address.get("addressLocality")
                    region = address.get("addressRegion")
                    if isinstance(locality, str) and locality.strip():
                        result["city"] = locality.strip()
                    if isinstance(region, str) and region.strip():
                        result["state"] = region.strip()

        return result

    def extract_from_card(self, card) -> ScrapedTherapist | None:
        anchor = card.select_one("a[href]")
        if not anchor:
            return None

        href = anchor.get("href", "").strip()
        profile_url = urljoin("https://www.doctoralia.com.br", href)
        parsed = urlparse(profile_url)
        if not self.profile_path_pattern.match(parsed.path):
            return None

        title_node = (
            card.select_one("h1")
            or card.select_one("h2")
            or card.select_one("h3")
            or anchor
        )
        full_name = title_node.get_text(" ", strip=True)
        if not full_name or len(full_name.split()) < 2:
            return None

        text_blob = card.get_text(" ", strip=True)
        price = self.extract_price(text_blob)
        city = self.extract_city_from_text(text_blob)
        specialties = self.extract_specialties_from_text(text_blob)

        return ScrapedTherapist(
            source=self.source_name,
            source_id=parsed.path.strip("/"),
            profile_url=f"https://www.doctoralia.com.br{parsed.path}",
            full_name=full_name,
            headline=self._text(card.select_one("[data-test='specialty']")) or self.infer_headline(text_blob),
            city=city,
            remote_available="teleconsulta" in text_blob.lower() or "online" in text_blob.lower(),
            price_min=price,
            price_max=price,
            specialties=specialties,
            approaches=[],
            languages=[],
        )

    @staticmethod
    def _text(node) -> str | None:
        if not node:
            return None
        text = node.get_text(" ", strip=True)
        return text or None

    @staticmethod
    def text_lines(soup: BeautifulSoup) -> list[str]:
        return [line.strip() for line in soup.get_text("\n", strip=True).splitlines() if line.strip()]

    @staticmethod
    def iter_json_nodes(payload: object) -> list[dict]:
        if isinstance(payload, list):
            nodes: list[dict] = []
            for item in payload:
                nodes.extend(DoctoraliaScraper.iter_json_nodes(item))
            return nodes
        if isinstance(payload, dict):
            nodes = [payload]
            item_list = payload.get("itemListElement")
            if isinstance(item_list, list):
                for item in item_list:
                    if isinstance(item, dict):
                        nodes.append(item)
            graph = payload.get("@graph")
            if isinstance(graph, list):
                for item in graph:
                    if isinstance(item, dict):
                        nodes.append(item)
            return nodes
        return []

    @staticmethod
    def pick_string(item: dict, key: str) -> str | None:
        value = item.get(key)
        return value.strip() if isinstance(value, str) and value.strip() else None

    @staticmethod
    def merge_lists(*groups: list[str] | None) -> list[str]:
        seen: set[str] = set()
        merged: list[str] = []
        for group in groups:
            for value in group or []:
                cleaned = value.strip()
                lowered = cleaned.lower()
                if cleaned and lowered not in seen:
                    seen.add(lowered)
                    merged.append(cleaned)
        return merged

    @staticmethod
    def extract_city(item: dict) -> str | None:
        address = item.get("address")
        if isinstance(address, dict):
            locality = address.get("addressLocality")
            if isinstance(locality, str) and locality.strip():
                return locality.strip()
        return None

    def extract_price(self, text: str) -> int | None:
        match = self.price_pattern.search(text)
        if not match:
            return None
        return int(match.group(1).replace(".", ""))

    def extract_prices(self, lines: list[str]) -> tuple[int | None, int | None]:
        values: list[int] = []

        for line in lines:
            if "R$" not in line:
                continue
            match = self.price_range_pattern.search(line)
            if not match:
                continue
            first = int(match.group(1).replace(".", ""))
            values.append(first)
            if match.group(2):
                values.append(int(match.group(2).replace(".", "")))

        if not values:
            return None, None
        return min(values), max(values)

    @staticmethod
    def extract_city_from_text(text: str) -> str | None:
        lowered = text.lower()
        if " teleconsulta " in f" {lowered} ":
            return None

        for separator in [" 1 endereço", " 2 endereços", " 3 endereços"]:
            if separator in lowered:
                candidate = text[: lowered.index(separator)].split()[-3:]
                return " ".join(candidate).strip() or None
        return None

    @staticmethod
    def extract_specialties_from_text(text: str) -> list[str]:
        match = re.search(r"\((.*?)\)\s*[·•]", text)
        if not match:
            return []
        values = [item.strip() for item in match.group(1).split(",")]
        return [value for value in values if value]

    @staticmethod
    def infer_headline(text: str) -> str | None:
        lines = [segment.strip() for segment in text.split(" · ") if segment.strip()]
        for line in lines:
            if "psic" in line.lower():
                return line[:255]
        return None

    def extract_bio(self, lines: list[str]) -> str | None:
        return self.collect_section(
            lines,
            start_markers=["Sobre mim"],
            stop_markers=[
                "Experiência em:",
                "Principais doenças tratadas",
                "Idiomas",
                "Publicações",
                "Prêmios",
                "Serviços",
                "Consultórios",
                "Planos de saúde",
                "Opiniões",
            ],
            limit=14,
        )

    def extract_approaches(self, lines: list[str], bio: str | None) -> list[str]:
        values = self.collect_bullet_section(
            lines,
            marker="Experiência em:",
            stop_markers=["Principais doenças tratadas", "Idiomas", "Publicações", "Prêmios"],
        )

        extra_candidates = [
            "Terapia Cognitivo Comportamental",
            "TCC",
            "Psicanálise",
            "Psicologia clínica",
            "Arteterapia",
            "Neuropsicologia",
            "Terapia do esquema",
            "ABA",
            "Gestalt",
            "Psicoterapia",
        ]
        corpus = " ".join(lines[:220])
        if bio:
            corpus = f"{corpus} {bio}"

        for candidate in extra_candidates:
            if candidate.lower() in corpus.lower() and candidate not in values:
                values.append(candidate)

        return values

    def extract_specialties(self, lines: list[str]) -> list[str]:
        values = self.collect_bullet_section(
            lines,
            marker="Doenças tratadas",
            stop_markers=["Idiomas", "Publicações", "Prêmios", "Redes sociais", "Serviços"],
        )
        if values:
            return values

        values = self.collect_bullet_section(
            lines,
            marker="Principais doenças tratadas",
            stop_markers=["Formatos de consulta", "Destaques", "Experiência", "Idiomas"],
        )
        return values

    def extract_languages(self, lines: list[str]) -> list[str]:
        values = self.collect_bullet_section(
            lines,
            marker="Idiomas",
            stop_markers=["Publicações", "Prêmios", "Redes sociais", "Serviços", "Consultórios"],
        )
        cleaned: list[str] = []
        seen: set[str] = set()
        for value in values:
            normalized = normalize_language_label(value)
            if not normalized:
                continue
            token = normalized.lower()
            if token not in seen:
                seen.add(token)
                cleaned.append(normalized)
        return cleaned

    def collect_bullet_section(
        self,
        lines: list[str],
        marker: str,
        stop_markers: list[str],
    ) -> list[str]:
        start_index = self.find_line(lines, marker)
        if start_index is None:
            return []

        values: list[str] = []
        for line in lines[start_index + 1 :]:
            if line in stop_markers:
                break
            if line in {"*", "mais", "Mostrar mais detalhes", "Mostrar mais detalhes sobre a experiência"}:
                continue
            if line.startswith("+"):
                continue
            if self.looks_like_noise(line):
                continue
            if line not in values:
                values.append(line)

        return values[:20]

    def collect_section(
        self,
        lines: list[str],
        start_markers: list[str],
        stop_markers: list[str],
        limit: int,
    ) -> str | None:
        start_index = None
        for marker in start_markers:
            start_index = self.find_line(lines, marker)
            if start_index is not None:
                break
        if start_index is None:
            return None

        chunks: list[str] = []
        for line in lines[start_index + 1 :]:
            if line in stop_markers:
                break
            if self.looks_like_noise(line):
                continue
            chunks.append(line)
            if len(chunks) >= limit:
                break

        return " ".join(chunks).strip() or None

    @staticmethod
    def find_line(lines: list[str], target: str) -> int | None:
        for index, line in enumerate(lines):
            if line == target:
                return index
        return None

    @staticmethod
    def looks_like_noise(line: str) -> bool:
        lowered = line.lower()
        if lowered in {
            "agendar consulta",
            "enviar mensagem",
            "veja minhas fotos e meu instagram para saber um pouco mais sobre mim, sobre pessoas que admiro e assuntos que estudo atualmente. minha consulta online custa 300 reais e dura 90 minutos. quando estou no rio, trabalho online até 23h, mas com último agendamento geralmente por volta de 21h ou 21:30. quando estou na frança, trabalho geralmente entre 4h e 19h pelo fuso horário de brasília. tenho a possibilidade de trabalhar online no sábado ou domingo sem custo adicional.",
        }:
            return True
        if re.fullmatch(r"\d+\s+opiniões", lowered):
            return True
        if lowered.startswith("crp ") or lowered.startswith("crm "):
            return True
        if lowered.startswith("número de registro"):
            return True
        if lowered in {"detalhes", "mais", "ver locais (1)", "ver calendário online"}:
            return True
        return False

    def extract_city_from_profile(self, lines: list[str], profile_url: str) -> str | None:
        parsed = urlparse(profile_url)
        path_parts = [part for part in parsed.path.strip("/").split("/") if part]
        if len(path_parts) >= 3:
            return self.slug_to_title(path_parts[-1])

        for line in lines[:40]:
            if "endereço" in line.lower():
                city = re.sub(r"\s+\d+\s+endere[cç]os?$", "", line, flags=re.IGNORECASE).strip()
                if city and city.lower() != "teleconsulta":
                    return city
        return None

    @staticmethod
    def extract_state_from_text(lines: list[str]) -> str | None:
        for line in lines[:60]:
            match = re.search(r"\bCRP\s+([A-Z]{2})\b", line)
            if match:
                return match.group(1)
        return None

    @staticmethod
    def slug_to_title(value: str) -> str:
        return " ".join(part.capitalize() for part in value.split("-") if part)

    @staticmethod
    def detect_remote(lines: list[str]) -> bool:
        corpus = " ".join(lines[:220]).lower()
        return "teleconsulta" in corpus or "consulta por vídeo" in corpus or "online" in corpus

    def build_headline(
        self,
        item: ScrapedTherapist,
        json_profile: dict[str, object],
        lines: list[str],
        approaches: list[str],
        specialties: list[str],
    ) -> str | None:
        headline = item.headline or self.pick_string(json_profile, "bio")
        if headline:
            return headline[:255]

        parts: list[str] = []
        if approaches:
            parts.append(", ".join(approaches[:2]))
        if specialties:
            parts.append(", ".join(specialties[:3]))

        if parts:
            return " | ".join(parts)[:255]

        for line in lines[:20]:
            if "psic" in line.lower():
                return line[:255]
        return None
