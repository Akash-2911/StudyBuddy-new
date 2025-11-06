// api/summary.js
import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import { readFileSync } from "fs";
import { convertToHtml } from "mammoth"; // for DOCX
import pptxParser from "pptx-parser";   // lightweight pptx parser

export const config = {
  api: {
    bodyParser: false // disable default so we can parse multipart
  }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  const form = formidable({ multiples: false });
  const [fields, files] = await form.parse(req);

  const file = files.file?.[0] || files.file;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  const filePath = file.filepath || file.path;
  const fileName = file.originalFilename || file.newFilename || "upload";
  const ext = fileName.split(".").pop().toLowerCase();

  let textContent = "";

  try {
    if (ext === "txt") {
      textContent = readFileSync(filePath, "utf8");
    } else if (ext === "pdf") {
      const data = await pdfParse(readFileSync(filePath));
      textContent = data.text;
    } else if (ext === "docx") {
      const data = await convertToHtml({ path: filePath });
      // convert HTML to plain text
      textContent = data.value.replace(/<[^>]+>/g, " ");
    } else if (ext === "pptx") {
      const slides = await pptxParser.parse(filePath);
      textContent = slides.map((s) => s.text).join("\n");
    } else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    if (!textContent.trim()) {
      return res.status(400).json({ error: "No readable text found in file" });
    }

    // ==== Send to Gemini ====
    const key = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;

    const prompt = [
      {
        role: "user",
        parts: [{ text: `Summarize this file in a clear, concise way:\n\n${textContent.slice(0, 15000)}` }]
      }
    ];

    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: prompt })
    });

    if (!aiRes.ok) throw new Error(await aiRes.text());
    const aiJson = await aiRes.json();
    const summary =
      aiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No summary returned.";

    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    console.error("Error:", err);
    return res.status(500).json({ error: "Failed to summarize file." });
  } finally {
    // cleanup tmp file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
