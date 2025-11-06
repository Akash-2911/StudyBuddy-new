import fs from "fs";
import path from "path";
import formidable from "formidable";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import officeParser from "officeparser"; // ✅ Handles PPTX + DOCX
import fetch from "node-fetch";

// Disable Next.js body parsing
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // 🧩 1. Parse file upload
    const form = formidable({ multiples: false });
    const [fields, files] = await form.parse(req);
    const file = files.file?.[0] || files.file;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filePath = file.filepath || file.path;
    const ext = path.extname(file.originalFilename || file.name).toLowerCase().replace(".", "");
    let textContent = "";

    // 🧠 2. Extract text based on file type
    if (ext === "pdf") {
      const data = await pdfParse(await fs.promises.readFile(filePath));
      textContent = data.text;
    }

    else if (ext === "docx" || ext === "pptx") {
      try {
        const text = await officeParser.parseOfficeAsync(filePath);
        textContent = text;
      } catch (err) {
        console.error("OfficeParser error:", err);
        textContent = `⚠️ Unable to extract text from ${ext.toUpperCase()} file.`;
      }
    }

    else if (ext === "txt") {
      textContent = await fs.promises.readFile(filePath, "utf8");
    }

    else {
      return res.status(400).json({ error: `Unsupported file type: ${ext}` });
    }

    // 🧩 3. Send extracted text to Gemini API
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Summarize this study material in clear, concise bullet points for students:\n\n" +
                    textContent,
                },
              ],
            },
          ],
        }),
      }
    );

    const geminiData = await geminiResponse.json();
    const summary =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ No summary generated. Please check your file.";

    // 🧩 4. Return summary
    return res.status(200).json({ summary });
  } catch (err) {
    console.error("Error generating summary:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
}
