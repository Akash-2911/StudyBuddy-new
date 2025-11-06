// api/summary.js
import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import { readFileSync } from "fs";
import { convertToHtml } from "mammoth";
import pptxParser from "pptx-parser";

export const config = {
  api: { bodyParser: false } // allow multipart/form-data
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

    // ---- Gemini 2.0 Flash Call (real) ----
    const key = process.env.GEMINI_API_KEY;
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
      key;

    const body = {
      contents: [
        {
          parts: [
            {
              text: `Summarize this document clearly and accurately:\n\n${textContent}`
            }
          ]
        }
      ]
    };

    const aiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      throw new Error("Gemini API error: " + errText);
    }

    const aiJson = await aiRes.json();
    const summary =
      aiJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No summary text returned.";

    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    console.error("Error:", err);
    return res
      .status(500)
      .json({ error: "Failed to summarize file", detail: String(err) });
  } finally {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}
