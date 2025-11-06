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

    // --- REAL GEMINI EXAMPLE (text-only payload) ---
const key = process.env.GEMINI_API_KEY;

// Gemini "generateContent" (v1beta 1.5-flash example). Adjust model or endpoint if needed.
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

const prompt = [
  {
    role: "user",
    parts: [{ text: `Summarize this study material clearly and concisely:\n\n${content}` }]
  }
];

const aiRes = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ contents: prompt })
});

if (!aiRes.ok) {
  const e = await aiRes.text();
  throw new Error(`Gemini error: ${e}`);
}

const aiJson = await aiRes.json();
// Extract the text (Gemini returns candidates -> content -> parts -> text)
const text =
  aiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
  "No summary text returned.";
return res.status(200).json({ ok: true, summary: text });
