# PROJECT CONCEPT NOTE: TripGuide AI

## 1. Project Title & Application Name
* **Application Name**: TripGuide AI
* **Project Title**: Building & Deploying a Streaming AI Travel Planner on AWS

## 2. Problem Statement & Objective
Planning travel is a time-consuming process. Users often spend hours cross-referencing websites to build a day-by-day itinerary that respects their budget, duration, and interests. 

**Objective**: TripGuide AI addresses this by providing a real-time, simple travel planner. It generates completely customized day-by-day itineraries, complete with local packing suggestions and travel hacks.

## 3. Target User & Use Case
* **The Busy Professional**: Needs a quick, comprehensive weekend trip itinerary without spending hours researching.
* **The Budget Backpacker**: Wants custom local tips, street-food recommendations, and low-cost transport routes.
* **The Experiential Traveler**: Wants themed trips (e.g., "Art History in Rome" or "Foodie Journey in Tokyo") tailored specifically to their taste.

## 4. LLM Model & API Integration
* **Model**: Google Gemini 1.5 Flash (`gemini-1.5-flash`)
* **API Details**: Integrated using the official Node.js `@google/generative-ai` SDK.
* **Response Architecture**: Built utilizing server-side HTTP streaming (Server-Sent Events) to stream text chunks dynamically to the client, solving the high-latency issue of traditional REST-based AI responses.

## 5. Key Features
* **Custom Parameter Selection**: User-selectable destination, duration (1-14 days), budget levels (Budget, Moderate, Luxury), and custom interests (e.g., nature, culinary, museums).
* **Real-time Streaming Output**: Progressive rendering of the itinerary with an animated spinner, preventing user fatigue.
* **Tailored Outputs**: Generates thematic daily blocks (Morning, Afternoon, Evening), personalized meal suggestions, a tailored packing list, and cultural tips.
* **One-Click Export**: Interactive printing/PDF generation designed specifically to look like a high-end printed travel guide.

## 6. Expected User Experience & Outcomes
Users experience a premium, glassmorphic UI with zero lag. Instead of waiting for a black-box API response, they watch their travel plan unfold line-by-line. They receive an actionable, exportable travel itinerary matching their exact needs, increasing confidence and reducing travel preparation time by over 90%.

---
### Public Deployment URL:
* **Live Deployment Link**: [https://tripguide.onrender.com/](https://tripguide.onrender.com/)
