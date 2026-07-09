require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Initialize Gemini API (safely fall back if key is missing)
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY environment variable is not set.");
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
};

// Streaming API Endpoint
app.post("/api/generate-itinerary", async (req, res) => {
  const { destination, days, budget, interests } = req.body;

  if (!destination || !days) {
    return res.status(400).json({ error: "Destination and days are required." });
  }

  const client = getGeminiClient();
  if (!client) {
    return res.status(500).json({
      error: "Gemini API key is not configured on the server. Please set the GEMINI_API_KEY environment variable."
    });
  }

  // Set up SSE headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const model = client.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Detailed prompt designed for beautifully formatted markdown structure
    const prompt = `
      You are an expert travel planner and local tour guide. Generate a detailed, engaging travel itinerary based on these details:
      - Destination: ${destination}
      - Duration: ${days} days
      - Budget Tier: ${budget} (e.g. Budget, Moderate, Luxury)
      - Travel Style & Interests: ${interests || "General sightseeing, culture, local food"}

      Requirements:
      1. Provide a brief, welcoming introduction.
      2. For each day, use this structure:
         ### Day X: Day Title
         * 09:00 - Stop Name: One-line note about morning activities.
         * 13:00 - Stop Name: One-line note about afternoon activities and lunch.
         * 19:00 - Stop Name: One-line note about evening plans and dinner.
      3. Provide a practical packing checklist using the checklist format "- [ ] Item" (e.g. "- [ ] Sunglasses").
      4. Provide 3-4 local tips (transportation hacks, cultural etiquette, safety, or budgeting advice).

      Format the output cleanly. For days, use "### Day X: Day Title" and for stops, use the "* HH:MM - Stop Name: Note" format precisely. Avoid raw HTML tags. Start directly with the itinerary introduction.
    `;

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      // Send SSE data format
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Error generating content stream:", error);
    // Send error message through the stream so the UI can display it
    res.write(`data: ${JSON.stringify({ error: error.message || "Failed to generate itinerary due to an internal server error." })}\n\n`);
    res.end();
  }
});

// Fallback to index.html for SPA routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to test.`);
});
