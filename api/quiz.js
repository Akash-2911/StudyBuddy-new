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

    const file = files.file[0];
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
      console.error(e);
    }

    if (!text.trim()) return res.status(400).json({ error: "Empty text" });

    const prompt = `
Create 5 short multiple-choice quiz questions (MCQs) from the following text.
Each question should include:
- "question": the question text
- "options": 4 answer choices
- "answer": the correct option text
Return the result as valid JSON array.

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
      const aiText =
        result?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const questions = JSON.parse(aiText.match(/\[.*\]/s)?.[0] || "[]");

      res.status(200).json({ questions });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "AI generation failed" });
    }
  });
}
