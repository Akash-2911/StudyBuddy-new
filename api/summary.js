// api/summary.js – Vercel Serverless Function
// Accepts JSON { content: string, filename?: string } from the frontend
// Uses a secret API key stored in Vercel env variable (we'll set it later)

export default async function handler(req, res) {
  // CORS: safe to keep "*" because your site + API will be same-origin on Vercel
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const apiKey = process.env.GEMINI_API_KEY; // set in Vercel later
  if (!apiKey) return res.status(500).json({ error: "No GEMINI_API_KEY configured" });

  try {
    const { content, filename = "upload.txt" } = req.body || {};
    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Missing 'content' (string)" });
    }

    // TEMP demo output (replace with real call in 2B)
    const summary = `Auto-summary of "${filename}": ${content.slice(0, 240)}...`;
    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Upstream error" });
  }
}

export const config = {
  api: { bodyParser: { sizeLimit: "5mb" } }
};
