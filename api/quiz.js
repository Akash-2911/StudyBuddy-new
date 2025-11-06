import fs from "fs";
import formidable from "formidable";
import officeParser from "officeparser";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import fetch from "node-fetch";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: "File parse error" });

    const file = files.file?.[0];
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = file.filepath;
    const ext = file.originalFilename.split(".").pop().toLowerCase();

    let text = "";

    try {
      if (ext === "pdf") {
        const data = await pdfParse(fs.readFileSync(filePath));
        text = data.text;
      } else if (ext === "docx") {
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
      } else {
        text = await officeParser.parseOfficeAsync(filePath);
      }
    } catch (e) {
      console.error("❌ File parse failed:", e);
    }

    if (!text.trim())
      return res.status(400).json({ error: "Empty or unreadable file" });

    const prompt = `
Generate 5 short, clear multiple-choice quiz questions from the text below.
Each question must be in JSON format with fields:
[
  {
    "question": "string",
    "options": ["A", "B", "C", "D"],
    "answer": "one correct option text"
  }
]
Only return valid JSON — no explanations or extra text.

Text:
${text.slice(0, 8000)}
`;

    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
          process.env.GEMINI_API_KEY,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      const result = await response.json();
      const aiText = result?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // Safely extract JSON array
      const match = aiText.match(/\[[\s\S]*\]/);
      const questions = match ? JSON.parse(match[0]) : [];

      if (!questions.length)
        return res.status(400).json({ error: "No quiz generated" });

      res.status(200).json({ questions });
    } catch (err) {
      console.error("❌ AI generation failed:", err);
      res.status(500).json({ error: "AI generation failed" });
    }
  });
}
