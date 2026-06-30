# CivicPulse — Smart Community Infrastructure Platform

CivicPulse is an AI-powered, real-time public portal that lets citizens instantly report, track, and triage local infrastructure issues — potholes, streetlight outages, water leaks, road damage — using a photo. Gemini AI auto-detects the category, severity, and a recommended action plan for authorities.

---

## 1. Problem Statement

Reporting civic infrastructure failures today is slow and fragmented:

- **Reporting fatigue** — long forms and manual category/severity selection discourage people from reporting at all.
- **Delayed classification** — municipalities receive thousands of unstructured reports; sorting and dispatching crews takes days or weeks.
- **No transparency** — citizens get no live status updates, which erodes trust in local government.
- **No community alignment** — there's no way to merge duplicate reports or surface the most urgent issues through neighborhood consensus.

## 2. Solution Overview

CivicPulse closes this gap with a zero-friction reporting flow plus a live community tracker:

```
Citizen takes photo
        ↓
Gemini 3.5 Flash → auto-classifies category, severity, drafts suggested action
        ↓
Live interactive map → real-time visualization and coordinate plotting
        ↓
Real-time community feed → upvoting, status updates, leaderboard
```

- **Instant AI triage** — drop a photo; Gemini 3.5 Flash returns structured JSON: category, severity (Low/Medium/High/Critical), one-line description, and a suggested action for dispatch crews.
- **Auto-location detection** — browser Geolocation API captures coordinates and resolves them to a street address.
- **Live sync** — Firestore subscriptions keep the map and feed updated across all clients in real time, supporting upvotes and moderation.

## 3. Key Features

### Intelligent AI Reporting Form
- Drag-and-drop image upload with client-side canvas compression for fast uploads.
- Browser Geolocation API + OpenStreetMap reverse geocoding for human-readable addresses.
- Gemini Vision auto-fills category and severity, marked with an "AI Verified" badge.

### Live Heatmap & Interactive Map
- Color-coded markers: Critical (red), High (orange), Medium (yellow), Low (green).
- Popup cards with thumbnail, details, upvotes, and live status changes.
- Filter by category or severity.

### Live Community Feed
- Sort by newest or most upvoted.
- Upvote high-priority issues; discourages duplicate reports.
- Toggle status between Open, In Progress, and Resolved.

### Impact Analytics Dashboard
- Real-time total submission counter.
- Bar chart (Chart.js) of issues by category.
- Pie chart (Chart.js) of severity distribution.

### Neighborhood Gamification
- Anonymous session usernames (e.g. "Citizen #4082"), persisted via `localStorage`.
- +10 points for a validated report, +2 points for an upvote.
- Live leaderboard showing the top three contributors.

## 4. Architecture

```
Client Browser
   │  HTTP POST (base64 image)        │  Firestore sync       │  Reverse geocoding
   ▼                                   ▼                        ▼
Express Node Server  ──SDK call──►  Gemini 3.5 Flash      Firebase Firestore    OpenStreetMap API
```

**Reporting flow:**

```
Select image → compress on canvas → call /api/analyze-image
   → parse structured JSON → auto-fill form
   → submit → write to Firestore → award points → update feed/map
```

## 5. Technologies Used

**Frontend**
- Single-page application architecture
- Tailwind CSS for layout and theming
- Leaflet for interactive mapping
- Chart.js for analytics charts
- Lucide icons

**Backend**
- Node.js + Express (REST API proxy)
- Vite (dev server, hot reload)
- dotenv (secure environment config)

## 6. Google Technologies Utilized

### Gemini 3.5 Flash
- Integrated via the `@google/genai` TypeScript SDK.
- Enforces a strict JSON output schema (`responseMimeType: "application/json"`).
- Prompt: analyze the uploaded image and return `category` (pothole, streetlight_damage, water_leak, garbage_overflow, road_damage, other), `severity` (Low/Medium/High/Critical), `description`, and `suggested_action`.

### Firebase Firestore
- Firebase SDK v9+ (modular).
- `onSnapshot()` listeners keep data synced live across browsers.
- Atomic point increments and upvote-array updates without table locking.

## 7. Setup & Configuration

### Prerequisites
Set your Gemini API key in `.env`:
```env
GEMINI_API_KEY="AIzaSy..."
```

### Installation
```bash
npm install
npm run build
npm start
```
The app runs on port `3000`.
