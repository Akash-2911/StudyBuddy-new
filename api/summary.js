import fs from "fs";
import path from "path";
import formidable from "formidable";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import officeParser from "officeparser"; // ✅ Handles PPTX + DOCX
import fetch from "node-fetch";
import JSZip from "jszip";
import { parseStringPromise } from "xml2js";

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

  // DOCX / PPTX Extraction
else if (ext === "docx" || ext === "pptx") {
  try {
    let text = "";

    // 1️⃣ Try officeparser first
    try {
      text = await officeParser.parseOfficeAsync(filePath);
    } catch (e) {
      console.warn("officeparser failed:", e.message);
    }

    // 2️⃣ Fallback: Mammoth for DOCX
    if ((!text || text.trim().length < 50) && ext === "docx") {
      try {
        const mammothResult = await mammoth.extractRawText({ path: filePath });
        text = mammothResult.value;
      } catch (e) {
        console.warn("mammoth failed:", e.message);
      }
    }

    // 3️⃣ Final fallback: Direct unzip + XML read (guaranteed)
    if (!text || text.trim().length < 50) {
      console.log("🧩 Using JSZip fallback for DOCX text extraction...");
      const buffer = await fs.promises.readFile(filePath);
      const zip = await JSZip.loadAsync(buffer);
      let combinedText = "";

      for (const fileName of Object.keys(zip.files)) {
        if (fileName.endsWith(".xml") && fileName.includes("word/")) {
          const xmlContent = await zip.files[fileName].async("string");
          const parsed = await parseStringPromise(xmlContent);
          combinedText += JSON.stringify(parsed);
        }
      }

      // Strip XML tags & compress whitespace
      text = combinedText.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 100000);
    }

    textContent = text;
  } catch (err) {
    console.error("DOCX extraction error:", err);
    textContent = "";
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
  "Summarize the following academic or study material accurately. Focus on key points, concepts, and structure:\n\n" +
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
