# CivicPulse — Smart Community Infrastructure Platform

CivicPulse is an AI-powered, real-time public portal designed to empower citizens to instantly report, track, and triage local infrastructure issues (such as potholes, streetlight outages, water leaks, and road damage). By leveraging modern web technologies and Google’s Gemini AI, the platform automates category detection, triage priority, and public authority action-plan generation directly from an uploaded photo.

---

## 1. Problem Statement Selected

### The Challenge of Civic Friction & Slow Resolution
In modern municipalities, reporting local infrastructure failures is highly fragmented, slow, and tedious. Citizens face several friction points:
1. **Reporting Fatigue:** Filling out long forms, manually selecting complex categories, and determining appropriate severity levels requires effort, leading to low reporting rates.
2. **Delayed Classification:** City councils and municipal departments receive thousands of unstructured reports daily. Sorting, triaging, and dispatching crews takes days or weeks.
3. **Lack of Transparency:** Once a report is submitted, citizens rarely receive live feedback on whether their issue is being addressed, leading to distrust in local government.
4. **No Community Alignment:** There is no centralized mechanism to aggregate duplicate reports or coordinate neighborhood upvotes to highlight highly critical issues.

---

## 2. Solution Overview

**CivicPulse** bridges the gap between citizens and local authorities by creating an intelligent, zero-friction reporting flow coupled with a live community tracker:

```
[ Citizen takes Photo ] 
         │
         ▼
[ Gemini 2.0 / 3.5 Flash ] ──► Auto-Classifies Category, Severity & Drafts Suggested Action
         │
         ▼
[ Live Interactive Map ] ──► Real-time Visualization & Coordinate Plotting
         │
         ▼
[ Real-Time Community Feed ] ──► Neighborhood Upvoting, Status Updates & Leaderboard Engagement
```

- **Instant AI Triage:** Citizens simply drop a photo of the issue. The app’s backend calls the **Gemini 3.5 Flash** model with structural schema outputs. The AI instantly returns structured metadata: Category, Severity (Low/Medium/High/Critical), a one-sentence descriptive summary, and an actionable resolution instruction for dispatch crews.
- **Auto-Location Detection:** Built-in Geolocation API support captures coordinates and translates them into street addresses in real time.
- **Collaborative Persistence:** Multi-client Firestore subscriptions keep maps and feeds synchronized live, enabling upvoting mechanisms and instant community moderation.

---

## 3. Key Features

### 🛠️ Feature 1: Intelligent AI Reporting Form
- **Drag-and-Drop Image Uploader:** Supports instant file upload with automatic client-side canvas-based image compression to guarantee rapid uploads.
- **Browser Geolocation API Integration:** Captures latitude and longitude. Automatically queries OpenStreetMap reverse-geocoding APIs to resolve human-readable street names.
- **Gemini Vision Engine Analysis:** Calls standard server-side APIs to inspect image pixels and auto-fill categories and severity fields, displaying a green **AI Verified** badge.

### 🗺️ Feature 2: Live Heatmap & Interactive Canvas
- **Color-Coded Leaflet Map Markers:** Critical (Red), High (Orange), Medium (Yellow), and Low (Green) pins make hot spots instantly visible.
- **Interactive Popup Cards:** Click any map marker to preview the thumbnail, details, community upvotes, and change resolution states dynamically.
- **Multi-Level Filtering:** Instantly filter map markers by category type or severity level.

### 💬 Feature 3: Live Community Feed
- **Dynamic Sorting Options:** Toggle feed cards by **Newest Submissions** or **Popularity** (total upvotes).
- **Interactive Upvoting:** Boost high-priority issues to grab the attention of civic authorities. Prevents duplicate reports by allowing community alignment.
- **Actionable Status Toggler:** Toggle statuses between *Open*, *In Progress*, and *Resolved* on the fly to see real-time color badge changes.

### 📊 Feature 4: Impact Analytics Dashboard
- **Total Submissions Tracking:** Real-time counters showing system-wide reported counts.
- **Responsive Bar Chart (Chart.js):** Displays live distributions of issues across different infrastructure categories.
- **Triage Breakdown Pie Chart (Chart.js):** Showcases severe/critical vs low-priority distributions.

### 🏆 Feature 5: Neighborhood Gamification
- **Anonymous Session Memory:** Auto-generates unique local usernames (e.g., *Citizen #4082*) and remembers points across visits via `localStorage`.
- **Engagement Point System:** Award citizens **+10 Pts** for submitting validated reports and **+2 Pts** for active neighborhood upvoting.
- **Real-Time Leaderboard:** Shows the top three community contributors live in the sidebar layout.

---

## 4. Workflows & Architecture Diagrams

### System Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│                             Client Browser                             │
└──────┬───────────────────▲─────────────────────▲─────────────────▲──────┘
       │                   │                     │                 │
       │ HTTP POST         │ Firestore Sync      │ Firestore Sync  │ Reverse-Geocoding
       │ (Base64 Image)    │ (Live Issues)       │ (Leaderboard)   │ API Call
       ▼                   │                     │                 │
┌──────────────────────────┴─┐         ┌─────────┴──────────┐      │
│     Express Node Server    │         │ Firebase Firestore │      │
└──────┬─────────────────────┘         └────────────────────┘      │
       │                                                           │
       │ SDK Session API                                           │
       ▼                                                           │
┌────────────────────────────┐                                     ▼
│      Gemini 3.5 Flash      │                        ┌────────────────────────┐
│    (Structured Schema)     │                        │ OpenStreetMap API      │
└────────────────────────────┘                        └────────────────────────┘
```

### Reporting & Analysis Flow Chart
```
[User Selects Image] ──► [Compress Image on Canvas] ──► [Trigger Analyze Button]
                                                               │
                                                               ▼
[Auto-Fill Form Fields] ◄── [Parse Structured JSON] ◄── [Call /api/analyze-image]
          │
          ▼
[User Submits Form] ──► [Add Doc to Firestore] ──► [Add Points & Update UI Feed/Map]
```

---

## 5. Technologies Used

- **Frontend Architecture:**
  - **Single Page Application Structure:** Entire application embedded into a high-performance viewport.
  - **Tailwind CSS:** Modern grid layout, custom responsive sidebars, cards, and custom CSS color variables.
  - **Leaflet Map SDK:** Lightweight, highly interactive visual mapping engine rendering smooth community markers.
  - **Chart.js Engine:** Direct canvas rendering of real-time community statistics.
  - **Lucide Icons:** SVG indicators for intuitive visual navigation.

- **Backend Architecture:**
  - **NodeJS & Express Framework:** Handles secure REST API proxy routing.
  - **Vite Integration Middleware:** Blazing-fast development server bundler with hot reload bypass.
  - **Dotenv Module:** Secure environment configurations preventing API secret leakages.

---

## 6. Google Technologies Utilized

### 🧠 Google Gemini 3.5 Flash Model
- Integrates the modern `@google/genai` TypeScript SDK.
- Configured to enforce strict output schema validation (`responseMimeType: "application/json"`) utilizing explicit Type validation properties.
- **Prompt Specification:**
  > *"Analyze this image of a community infrastructure issue. Return JSON only with keys: category (one of: pothole, streetlight_damage, water_leak, garbage_overflow, road_damage, other), severity (one of: Low, Medium, High, Critical), description (one sentence explaining the issue), suggested_action (one sentence for authorities)"*

### 🔥 Firebase Firestore Database
- Utilizes the modern, modular **Firebase SDK v9+**.
- Listens to real-time collections using `onSnapshot()` pipelines to maintain continuous data sync across different user browsers.
- Automatically handles increments of points and appends unique arrays for upvoted user accounts without locking tables.

---

## 7. How to Setup & Configure

### Prerequisites
Make sure you have your environment variables defined in your Secrets manager or `.env` file:
```env
# Secure Gemini API Key
GEMINI_API_KEY="AIzaSy..."
```

### Installation
1. Install project dependencies:
   ```bash
   npm install
   ```
2. Build the application:
   ```bash
   npm run build
   ```
3. Start the server:
   ```bash
   npm start
   ```
   The application will boot and run on port `3000`.
