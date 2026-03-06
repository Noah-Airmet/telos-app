# Product Requirements Document (PRD)

## 1. Project Overview
A desktop-class, power-user focused Gospel Library application tailored for members of the LDS church. Unlike the current mobile app which is optimized for casual reading and basic study, this app is designed from the ground up for serious scholars, teachers, and lesson planners (e.g., Elders Quorum, Relief Society, Gospel Doctrine).

## 2. Target Audience
- Gospel doctrine teachers
- Elders Quorum and Relief Society instructors
- Serious gospel scholars and students
- Users who need complex cross-referencing, multi-translation study, and advanced note-taking.

## 3. Core Problems to Solve
- The standard mobile/web Gospel Library is too simplistic for complex lesson planning.
- Study tools (tags, notebooks, linking) are basic and difficult to manage at scale.
- Lack of alternate Bible translations side-by-side (e.g., NRSVue, Jewish Study Bible) limits deep scriptural exegesis.

## 4. Key Features & Requirements

### 4.1. Advanced Study Tools
- **Deep Tagging & Notebooks:** Hierarchical tags, nested notebooks, and bi-directional linking (Obsidian/Roam style) for scriptures and quotes.
- **Phrase-Anchored Notes:** Notes should be attachable to a specific selected span inside a verse, not only to the verse as a whole.
- **Private Dictionary Lookup:** Users should be able to import personal dictionary data and click a word in the text to view local definitions.
- **Lesson Planner Board:** A dedicated workspace to drag and drop scriptures, conference talks, and manual excerpts into a structured lesson outline.

### 4.2. Content & Translations
- **Standard Works +:** Full LDS Standard works, general conference, and manuals.
- **Alternate Translations:** Support for importing and side-by-side syncing of alternate text (NRSVue, Jewish Study Bible, etc.).
- **Edition Families:** Support multiple editions of the same work when canonical references can be aligned reliably.
- **Text Comparison:** Side-by-side reading should support first-pass difference highlighting between comparable texts.
- **BYO Content:** Ability to import standard `.epub` files and annotate them alongside official church materials.

### 4.3. User Experience
- **Desktop-First:** Heavy utilization of keyboard shortcuts, multiple panes, tabs, and wide-screen layouts.
- **Local-First & Fast:** Data should be stored locally for instantaneous search and offline availability, avoiding web-lag during church meetings.
- **Sync For Early Testing:** Users should be able to sign in with Google and sync personal study data across devices without giving up offline reading.

## 5. Technical Stack
- **Platform:** Local-First PWA (React + Vite + TypeScript).
- **Styling:** Tailwind CSS with design tokens, Radix UI for accessible headless components.
- **Auth & Sync:** Firebase Authentication (Google OAuth) + Cloud Firestore for synced study data.
- **Storage:** Static JSON for scripture content, repository-backed local/cloud study data today, with future migration path to SQLite WASM + OPFS for heavier local query/index workloads.
- **Content Pipeline:** `scripts/ingest.ts` — unified EPUB-to-JSON pipeline with profile-based parsers.
