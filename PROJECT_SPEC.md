# Project Specification: Tai Po Fire Support Platform (Lightweight)

## 1. Project Overview
**Goal:** Build a minimalist, low-bandwidth, high-performance information aggregation platform for the Tai Po fire incident.
**Purpose:** To provide real-time updates (government/media), resource needs, and collection point locations to the public.
**Key Philosophy:** "Text-First" design. No heavy images, no custom fonts, minimal JS. Prioritize speed and accessibility under unstable network conditions.

## 2. Tech Stack
- **Framework:** React 18 (Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Backend/DB:** Firebase v9 (Firestore, Auth, Hosting)
- **Icons:** `lucide-react` (SVG icons, lightweight)
- **Maps:** No embedded maps (iframe). Use direct external links to Google/Apple Maps to save bandwidth.

## 3. Design System (Low Bandwidth)
- **Font Stack:** System fonts only (`sans-serif` in Tailwind config). No Google Fonts imports.
- **Colors:**
  - Primary: `#dc2626` (red-600) for urgency/alerts.
  - Neutral: `#f9fafb` (gray-50) for background to reduce eye strain.
  - Text: `#111827` (gray-900) for high contrast readability.
- **Components:**
  - Cards with clear borders.
  - distinct "Status Badges" (e.g., "Urgent", "Fulfilled").
  - Skeleton loaders for data fetching.

## 4. Data Model (Firestore Schema)

### Collection: `announcements` (Public Read)
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated |
| `title` | string | Headline of the news |
| `content` | string | Short summary or full text |
| `source` | string | e.g., "GovHK", "Cable News", "Telegram Group" |
| `url` | string | Link to original source (optional) |
| `isUrgent` | boolean | Highlights the card in red |
| `timestamp` | timestamp | For sorting (descending) |

### Collection: `resources` (Public Read)
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Auto-generated |
| `locationName` | string | e.g., "Tai Po Community Centre" |
| `address` | string | Full address |
| `mapLink` | string | URL to Google Maps |
| `status` | string | 'open', 'closed', 'full' |
| `needs` | array<string> | List of needed items e.g., ["Water", "Towels"] |
| `contact` | string | Phone number or name |
| `updatedAt` | timestamp | To show how fresh the info is |

## 5. App Architecture & Routing

### Routes
1.  `/` **(Home)**:
    -   **Header**: Title + "Live Status" indicator.
    -   **Emergency Banner**: Sticky top for critical warnings (if any).
    -   **Tabs/Toggle**: Switch between "News Feed" and "Resource Points".
    -   **Feed Section**: List of `AnnouncementCard`.
    -   **Resource Section**: List of `ResourceCard`.
    -   **Footer**: Disclaimer + Emergency Numbers (999).
2.  `/admin` **(CMS)**:
    -   Simple Login (Firebase Auth - Email/Password).
    -   Dashboard to CRUD (Create, Read, Update, Delete) announcements and resources.
    -   *Crucial*: Quick "Mark as Full" button for resources to stop donations when not needed.

## 6. Component Specifications

### `components/layout/Header.tsx`
- Contains Logo (Text + Icon), Title.
- Shows a pulsing red dot if the situation is active.

### `components/feed/NewsCard.tsx`
- Props: `Announcement` object.
- If `isUrgent` is true: Red background (`bg-red-50`), Red border.
- Else: White background, gray border.
- Show `source` and `timestamp` clearly.

### `components/resources/ResourceCard.tsx`
- Props: `Resource` object.
- Display status badge:
  - Open: Green
  - Full: Yellow/Orange
  - Closed: Gray
- **Action Button**: "Open Map" (External Link). Do NOT load map tiles.

## 7. Implementation Steps for Cursor

1.  **Scaffold**: Initialize Vite + React + TS. Setup Tailwind.
2.  **Config**: Create `firebase.ts` and export `db` and `auth`.
3.  **Types**: Define TypeScript interfaces in `src/types/index.ts`.
4.  **UI**: Build the Header, Footer, and Layout components.
5.  **Logic**: Implement `useFirestore` hook for real-time data fetching.
6.  **Pages**: Build `HomePage` with the toggle view (News/Resources).
7.  **Admin**: Build a minimal `LoginPage` and `AdminDashboard`.
8.  **Optimization**: Ensure `tailwind.config.js` uses system fonts and purges unused styles.

## 8. Tailwind Config Override (Crucial for bandwidth)
```javascript
// tailwind.config.js
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system", "BlinkMacSystemFont", "Segoe UI", 
          "Roboto", "Helvetica", "Arial", "sans-serif"
        ],
      },
    },
  },
  plugins: [],
}