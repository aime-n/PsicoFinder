import express from "express";
import { createServer as createViteServer } from "vite";
import axios from "axios";
import pLimit from "p-limit";
import path from "path";

const app = express();
const PORT = 3000;

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const BASE_URL = "https://www.doctoralia.com.br/pesquisa?q=Psicólogo&filters%5Bdiseases%5D%5B0%5D=4567&filters%5Bonline_only%5D%5B0%5D=true&filters%5Bentity_type%5D%5B0%5D=doctor&filters%5Bspecializations%5D%5B0%5D=76&page=";

function detectTerms(html: string) {
  const aboutMatch = html.match(/about-description[^>]*>(.*?)<\/div>/is);
  if (!aboutMatch) return { tdah: false, tcc: false, tea: false };

  const text = aboutMatch[1].replace(/<.*?>/g, " ").toLowerCase();

  const hasTdah = /\btdah\b|déficit de atenção|hiperatividade/.test(text);
  const hasTcc = /\btcc\b|terapia cognitivo[- ]comportamental|cognitive behavioral/.test(text);
  const hasTea = /\btea\b|autismo|espectro autista/.test(text);

  return { tdah: hasTdah, tcc: hasTcc, tea: hasTea };
}

function extractPrice(html: string): number | null {
  // 1. JSON price
  const jsonMatch = html.match(/"price"\s*:\s*"?(\d{2,4})"?/);
  if (jsonMatch) return parseInt(jsonMatch[1], 10);

  // 2. HTML attribute price
  const attrMatch = html.match(/data-price="(\d{2,4})"/);
  if (attrMatch) return parseInt(attrMatch[1], 10);

  // 3. Visible price text
  const textMatch = html.match(/R\$\s*[\xa0 ]*(\d{2,4})/);
  if (textMatch) return parseInt(textMatch[1], 10);

  return null;
}

async function collectDoctors(maxPages = 3) {
  const doctors: { name: string; url: string }[] = [];
  
  for (let page = 1; page <= maxPages; page++) {
    try {
      console.log(`Fetching search page ${page}...`);
      const response = await axios.get(`${BASE_URL}${page}`, { headers: HEADERS, timeout: 10000 });
      const html = response.data;

      const ldJsonMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s);
      if (!ldJsonMatch) break;

      const data = JSON.parse(ldJsonMatch[1]);
      const items = data.itemListElement || [];
      if (items.length === 0) break;

      for (const it of items) {
        const doc = it.item || {};
        if (doc["@type"] === "Physician") {
          doctors.push({
            name: doc.name.trim(),
            url: doc.url,
          });
        }
      }
    } catch (error) {
      console.error(`Error on page ${page}:`, error);
      break;
    }
  }
  return doctors;
}

app.get("/api/scrape", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendEvent = (type: string, data: any) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  try {
    const maxPages = parseInt(req.query.pages as string) || 2;
    const filterTdah = req.query.tdah === 'true';
    const filterTcc = req.query.tcc === 'true';
    const filterTea = req.query.tea === 'true';

    const doctors = await collectDoctors(maxPages);
    
    sendEvent("start", { total: doctors.length });

    const limit = pLimit(50); // Increased concurrency for faster scraping
    let completed = 0;
    
    const tasks = doctors.map((doc) =>
      limit(async () => {
        try {
          const response = await axios.get(doc.url, { headers: HEADERS, timeout: 15000 });
          const html = response.data;
          const price = extractPrice(html);
          const { tdah, tcc, tea } = detectTerms(html);
          
          completed++;
          sendEvent("progress", { 
            current: completed, 
            total: doctors.length,
            name: doc.name 
          });

          // Server-side filtering
          if (filterTdah && !tdah) return null;
          if (filterTcc && !tcc) return null;
          if (filterTea && !tea) return null;

          return {
            ...doc,
            price: price || 0,
            tdah,
            tcc,
            tea,
          };
        } catch (error) {
          console.error(`Error fetching profile ${doc.url}:`, error);
          completed++;
          sendEvent("progress", { 
            current: completed, 
            total: doctors.length,
            name: doc.name 
          });
          return null;
        }
      })
    );

    const results = (await Promise.all(tasks)).filter(Boolean);
    sendEvent("complete", { data: results });
    res.end();
  } catch (error: any) {
    sendEvent("error", { message: error.message });
    res.end();
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
