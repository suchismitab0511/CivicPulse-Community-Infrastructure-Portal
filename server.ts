import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set up body parsers with limits for large base64 image data
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ limit: "25mb", extended: true }));

  // API Endpoints
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy Endpoint for Gemini Vision API to securely analyze community issues
  app.post("/api/analyze-image", async (req: express.Request, res: express.Response) => {
    try {
      const { imageBase64, mimeType } = req.body;
      if (!imageBase64) {
        res.status(400).json({ error: "No image data provided" });
        return;
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        res.status(500).json({ error: "Gemini API key is not configured on the server" });
        return;
      }

      // Initialize the modern Google GenAI SDK
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      const imagePart = {
        inlineData: {
          mimeType: mimeType || "image/jpeg",
          data: imageBase64,
        },
      };

      const textPart = {
        text: "Analyze this image of a community infrastructure issue. Return JSON only with keys: category (one of: pothole, streetlight_damage, water_leak, garbage_overflow, road_damage, other), severity (one of: Low, Medium, High, Critical), description (one sentence explaining the issue), suggested_action (one sentence for authorities)",
      };

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: { parts: [imagePart, textPart] },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: "pothole, streetlight_damage, water_leak, garbage_overflow, road_damage, other",
              },
              severity: {
                type: Type.STRING,
                description: "Low, Medium, High, Critical",
              },
              description: {
                type: Type.STRING,
                description: "One sentence explaining the issue",
              },
              suggested_action: {
                type: Type.STRING,
                description: "One sentence of action for authorities",
              },
            },
            required: ["category", "severity", "description", "suggested_action"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        res.status(500).json({ error: "Failed to receive a valid text response from Gemini" });
        return;
      }

      const analysis = JSON.parse(text);
      res.json(analysis);
    } catch (error: any) {
      console.error("Image analysis error:", error);
      res.status(500).json({ error: error.message || "An error occurred during Gemini image analysis" });
    }
  });

  // Serve Frontend with Vite middleware in development or express.static in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
