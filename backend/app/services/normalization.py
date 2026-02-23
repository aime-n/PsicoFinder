from __future__ import annotations

import re
import unicodedata

LANGUAGE_ALIASES = {
    "portugues": "Português",
    "portuguese": "Português",
    "ingles": "Inglês",
    "english": "Inglês",
    "espanhol": "Espanhol",
    "spanish": "Espanhol",
    "frances": "Francês",
    "french": "Francês",
    "alemao": "Alemão",
    "german": "Alemão",
    "italiano": "Italiano",
    "italian": "Italiano",
    "mandarim": "Mandarim",
    "chines": "Mandarim",
    "japones": "Japonês",
    "japanese": "Japonês",
    "arabe": "Árabe",
    "arabic": "Árabe",
    "libras": "Libras",
}


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_value).strip().lower()


def normalize_token_list(values: list[str] | None) -> list[str]:
    if not values:
        return []

    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        token = normalize_text(value)
        if token and token not in seen:
            seen.add(token)
            result.append(token)
    return result


def normalize_language_label(value: str | None) -> str | None:
    token = normalize_text(value)
    if not token:
        return None

    if token in LANGUAGE_ALIASES:
        return LANGUAGE_ALIASES[token]

    return None
