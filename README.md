# Telos - Power User Gospel Library

A local-first, desktop-class study app for LDS scholars and teachers. Multi-translation parallel reading, deep annotation, and lesson planning — all running offline in the browser.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173` — you'll see a working scripture reader with 4 translations, synced comparison mode, notes/highlights, and keyboard controls (arrow keys for prev/next chapter).

## Optional Firebase Setup

The app can run in local-only mode without any backend. To enable Google sign-in and synced notes/highlights/reading state, add these Vite env vars:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

If these are missing, the app automatically falls back to local-only study data.

## Project Structure

```
src/
  App.tsx                  # Root component — wires sidebar, reader, and notes panel
  context/
    AuthContext.tsx        # Chooses local or cloud-backed study repository
  components/
    Sidebar.tsx            # Translation tabs + book list
    ReadingPane.tsx         # Main reading canvas with compare/diff, lookup, and chapter navigation
    VerseBlock.tsx          # Renders individual verse/heading/summary/commentary blocks
  lib/
    firebase.ts            # Firebase bootstrapping for optional sync mode
    studyRepository.ts     # Local/cloud study data abstraction
    studyTools.ts          # Imported dictionary/index helpers
    scripture.ts           # Manifest normalization + chapter JSON fetch with caching
  db/
    db.ts                  # Study/content types plus local storage helpers
  hooks/
    useFileSystem.ts       # File System Access API for future local notes export
  index.css                # Design tokens, dark mode, serif reading typography

data/                      # Pre-ingested scripture JSON (one file per chapter)
  manifest.json            # Index of all translations, books, and chapters
  lds-bom/                 # 239 chapters (Book of Mormon, LDS edition)
  kjv/                     # 1,189 chapters (King James Bible)
  nrsvue/                  # 1,380 chapters (NRSVue Bible)
  hardy-bom/               # 38 documents (Hardy Annotated BoM with commentary)

scripts/
  ingest.ts                # EPUB → JSON pipeline CLI
  generate-manifest.ts     # Generates data/manifest.json from data/ directory
  lib/                     # Pipeline internals (epub-reader, profiles, bible-books)
```

## Content Ingestion

Scripture data is pre-ingested from EPUB files into JSON:

```bash
npx tsx scripts/ingest.ts <epub-file> --profile <name>
npx tsx scripts/generate-manifest.ts   # Regenerate manifest after ingestion
```

Available profiles: `lds-bom`, `kjv`, `nrsvue`, `hardy-bom`. Output goes to `data/<profile>/` as one JSON file per chapter, keyed by Universal Verse IDs (UVIDs).

Imported private dictionaries should be treated as user-owned local JSON files, not redistributed app content.

## Documentation

- **Product:** `docs/product/prd.md`, `mvp.md`, `design_system.md`
- **Architecture:** `docs/architecture/architecture.md`, `navigation_ux.md`, `power_user_features.md`
- **Auth & Sync:** `docs/architecture/auth_sync.md`
- **Pipeline:** `docs/pipeline/content_pipeline.md`, `ai_pipeline_strategy.md`

## Tech Stack

- React 19 + TypeScript + Vite 7
- Tailwind CSS 4 with design tokens
- Firebase Auth + Firestore (optional sync mode)
- Content pipeline: adm-zip + cheerio
- Future: Radix UI (headless components), Lucide Icons, SQLite WASM
