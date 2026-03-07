# Changelog

All notable changes to the Telos Gospel Library project will be documented in this file.

## [Unreleased]

## [0.4.0] - Library, N-Pane Windowing & Navigation Overhaul

### Added
- **Library sidebar redesign:** Left sidebar rebuilt as a Logos-style resource library with six collapsible collections (Standard Works, Bible Translations, Commentaries, Conference Talks, Manuals, BYO Imports). Live works coexist with styled placeholder entries to communicate the app's intended scope. Includes text search across all works, filter pills (Canonical, Study, Commentary, All), and a settings drawer.
- **N-pane windowing system:** Replaced the fixed primary/secondary pane model with a `PaneState[]` array in `App.tsx`. Any number of panes can be open side by side. Each pane independently tracks its own profile, book, and chapter. `activePaneId` tracks focus; sidebar navigation always targets the focused pane.
- **Add/close pane controls:** Each pane header exposes an "Add" button (opens a new pane to the right, auto-selecting the next unused translation and matching book/chapter) and a "Close" button (hidden on the last remaining pane).
- **Breadcrumb header with stepper:** Pane headers display a `Translation · Book · ‹ Ch. N ›` breadcrumb. Prev/next chapter arrows are grouped tight against the chapter label as a stepper unit rather than on the far outer edges of the header.
- **Chapter picker in sidebar:** Clicking a book in the sidebar now expands an inline chapter grid below it (6-column, keyboard arrow-navigable). Selecting a chapter navigates the active pane directly.
- **Chapter grid picker in header:** Clicking `Ch. N` in the breadcrumb opens a chapter number grid via portal dropdown.

### Fixed
- **Dropdown pickers were non-functional:** `backdrop-filter: blur()` on `.glass-header` creates a CSS stacking context, trapping absolutely-positioned dropdowns inside the header's `z-20` layer. Fixed by rendering all picker dropdowns via `React.createPortal` to `document.body` at `fixed` coordinates derived from `getBoundingClientRect()`. Transparent backdrop overlay handles close-on-outside-click.
- **Inactive pane opacity made glass header look broken:** `opacity-80` on the entire `<main>` plus `opacity-70` on the header doubly dimmed the glassmorphism effect, making it appear visually buggy. Fixed by removing opacity from `<main>` and the header entirely — only the scroll content area (`overflow-y-auto` div) is dimmed (`opacity-60`) on inactive panes.
- **Scroll position jolt on pane switch:** When switching active panes, the previously active pane briefly re-scrolled due to the `syncBlockId` effect firing on `isActivePane` change. Fixed with `useLayoutEffect` + refs tracking `lastVisibleBlockId` and `wasActivePane` to skip redundant scroll-syncs.

### Changed
- **Translation label:** LDS Book of Mormon edition renamed from `"LDS"` to `"2013 BoM"` across `data/manifest.json`, all 239 chapter JSON files, and the `lds-bom` ingest profile.
- **Pane activation:** Panes activate on click, not hover.

## [0.3.0] - Pipeline Repair & AI Inspection Tooling

### Fixed
- **NRSVue profile — wrong book number mapping:** The entire NT/Deuterocanonical mapping was
  guessed incorrectly. In this EPUB, NT books are numbered 40–66 (Matthew–Revelation) and
  Deuterocanonical books are 67–84 (Tobit–4 Maccabees). The previous mapping had them swapped,
  causing every NT book to silently output wrong content (e.g. "2 Peter 151" was actually Psalm 151).
  Fixed by inspecting actual verse IDs (`v[bookNum:2][chapter:3][verse:3]`) in the EPUB HTML.
- **NRSVue profile — Psalm 151 chapter normalization:** The EPUB encodes Psalm 151 as bookNum=81,
  chapter=151. Added normalization so it stores as `ps-151-1` with title "Psalm 151 1".
- **Hardy profile — wrong CSS selector for book detection:** `h1.chaptertitle1` (nonexistent)
  replaced with the correct `h1.chaptertitle`, which only exists for 2 of 15 books anyway.
- **Hardy profile — book detection for 13 of 15 books was absent:** Only 2 Nephi and Moroni have
  `h1.chaptertitle`. All other books (1 Nephi, Jacob, Enos, Mosiah, Alma, etc.) are only
  identifiable from the EPUB TOC. Replaced HTML-scraping book detection with a TOC-derived
  `filename → bookInfo` map built at parse time from `toc.ncx` entries.
- **Hardy profile — one document per spine file instead of per chapter:** A spine file can contain
  all 22 chapters of 1 Nephi. The old parser emitted one giant document per file (38 total).
  Restructured to split on chapter-label paragraphs (`span.label`), emitting one TelosDocument
  per chapter (226 total, matching LDS BoM structure and ID format `bom-{abbrev}-{chapter}`).
- **Hardy profile — section headings stacked at top of chapter:** Global `$("h1.h1").each()`
  pre-extracted all headings into a flat array prepended to every chapter. Fixed by processing
  all elements in DOM order so headings appear inline between the verse groups they introduce.
- **Hardy profile — trailing headings assigned to wrong chapter:** Headings in DOM order appear
  before the chapter-label paragraph that opens the next chapter. When flushing a chapter,
  trailing heading blocks are now stripped and carried forward as the opening blocks of the
  next chapter.
- **Hardy profile — preface/intro essays leaking into chapter 1:** Front-matter files (editor's
  preface, book introductions) had no chapter labels, so their text accumulated in `chapterBlocks`
  with `currentChapter=0` and silently became part of chapter 1. Fixed: when `currentChapter=0`,
  discard all non-heading accumulated blocks on flush.
- **Hardy profile — person disambiguator subscripts rendered as plain digits:** Hardy uses
  `<sub>1</sub>` to distinguish people sharing a name (e.g. Nephi¹ vs the later Nephi). The text
  extractor concatenated these inline as "Nephi1". Fixed by converting `<sub>` digit elements to
  Unicode subscript characters (₀₁₂₃₄₅₆₇₈₉) before extracting heading text.

### Added
- **`scripts/inspect-epub.ts`** — EPUB structure inspector to run before writing any new profile.
  Outputs: top-level TOC entries (book boundaries), spine file list, all heading CSS classes,
  NRSVue-style verse ID book mapping (auto-detected), paragraph class frequencies, and a DOM
  sample. Paste output into Claude/Gemini to generate a profile. Usage:
  `npx tsx scripts/inspect-epub.ts path/to/book.epub`
- **`docs/pipeline/ai_pipeline_strategy.md`** — Rewritten with the correct 4-step agent workflow:
  inspect → AI generates profile → validate → regenerate manifest. Documents the four named EPUB
  structure archetypes, rules for profile authors (human or AI), and the lesson that book
  boundaries must come from the TOC, not heading elements.

### Changed
- Updated block/document counts across all profiles:
  - NRSVue: 1,380 → 1,398 chapters, 39,809 → 40,263 blocks (correct NT + Apocrypha books)
  - Hardy: 38 → 226 chapters, 3,162 → 3,643 blocks (per-chapter split, all 15 books correct)

### Added
- **Firebase Hosting & Deployment:**
  - Added `firebase.json` with SPA hosting config (serves from `dist/`, rewrites all routes to `index.html`, aggressive cache headers on `/assets/**` and `/data/**`).
  - Added `.firebaserc` linking the project to `telos-app-51401`.
  - Added `deploy` and `deploy:preview` npm scripts — `npm run deploy` builds and ships to production, `npm run deploy:preview` creates a shareable Firebase Hosting preview channel.
  - Updated `.gitignore` to exclude `.firebase/` cache dir and `.firebaserc`.
- **Landing Page — Feature Declarations Section:**
  - Inserted a new section between "Gospel Library deserves an Upgrade" and "Introducing TELOS" showcasing six killer features as typographic declaration blocks (index number + massive keyword + monospace description).
  - Features: COMPARE (parallel translations), COMMAND (Cmd+K palette), PLAN (notes & lesson planning), CONTEXT (commentaries & study bibles), LOOKUP (importable dictionaries), KEYBOARD (desktop-first shortcuts).
  - Blocks alternate left/right/center alignment across ~360vh of scroll depth, each revealing via the existing IntersectionObserver scroll-reveal system with staggered delays.
  - Added a slow horizontal marquee ticker (30s loop) as a visual divider before the TELOS wordmark.
  - Added CSS: `.feature-index`, `.feature-desc`, `.reveal-delay-1/2`, `.marquee-track`, `@keyframes marquee-scroll`, `.marquee-word`, and `prefers-reduced-motion` override.
  - Recalibrated background grayscale→color scroll trigger from `0.25` to `0.12` to account for the extended page length.
- **Landing Page — Announcement Card & Alpha Access Slide-out:**
  - Converted the "Entrance [ System ]" box from a login form into a public beta announcement card: "PUBLIC BETA / March 14, 2025" with a one-liner teaser.
  - Moved the Google Sign-In button into a hidden alpha access card that slides down from below the main card when "Request Access_" is clicked (toggles open/closed).
  - Alpha card header reads "Alpha Testing Now Available / Invite Only".
  - Slide animation uses CSS `grid-template-rows: 0fr → 1fr` + opacity fade with the same `cubic-bezier(0.19, 1, 0.22, 1)` easing as the rest of the page.
  - Added `showAlpha` state and `.alpha-card-wrapper` / `.alpha-card-wrapper.open` CSS classes.
- **Mobile Experience & Loading:**
  - Added a cinematic initializing screen that counts to 100 on mount while the hero image loads.
  - Implemented dynamic user-agent and viewport detection to intercept mobile users on the Landing Page, hiding the Google Sign-in Alpha card and replacing it with a "Desktop Only" requirement message.
  - Fixed mobile Safari UI interactions by replacing `100vh` with `100dvh` globally.
  - Added `<meta name="theme-color" content="#050505" />` and `viewport-fit=cover` to `index.html`.
  - Applied `-webkit-mask-image` to the main scrolling container to seamlessly fade text out before it overlaps with the top fixed edge indicators.

### Added
- **Landing Page & Authentication:**
  - Implemented a cinematic landing page (`src/components/LandingPage.tsx`) featuring a dithered background parallax effect with the "Christ in the Storm" painting.
  - Added a custom interactive crosshair cursor (`src/components/LandingPage.css`) that gracefully trails the native mouse pointer with dynamic gradient intersections.
  - Integrated Google Sign-in entrance flow via the `AuthContext`.
- **Phase 2 Study Tools:**
  - **Text Selection & Highlighting:** Persistent local storage of custom colored highlights on verse blocks via a floating popover.
  - **Notes & Tagging:** Contextual note-taking in the right sidebar (`src/components/NotesPanel.tsx`) with custom comma-separated tags linking directly to verse blocks.
  - **Side-by-Side Reading:** Dual-pane layout allowing simultaneous synchronized reading of divergent translations using UVID block identification.
  - **Command Palette Search:** Quick fuzzy search navigation across all books and chapters (`src/components/CommandPalette.tsx`) triggered globally via `Cmd+K`.
- **MVP Reading Experience (Phase 1):** Fully functional scripture reader with real data.
  - **Data loading** (`src/lib/scripture.ts`): Fetches manifest and chapter JSON at runtime with in-memory cache.
  - **VerseBlock component** (`src/components/VerseBlock.tsx`): Renders verses (hover verse numbers), headings, summaries, and commentary blocks with distinct styling and highlight layering.
  - **ReadingPane component** (`src/components/ReadingPane.tsx`): Scrollable reading canvas with glassmorphism header, prev/next chapter navigation, intersection observing for scroll alignment, text selection, and keyboard arrow key support.
  - **Sidebar component** (`src/components/Sidebar.tsx`): Translation tabs (LDS, KJV, NRSVue, Hardy) and scrollable book list with chapter counts. Click any book to jump to its first chapter.
  - **Manifest generator** (`scripts/generate-manifest.ts`): Indexes all data files into `data/manifest.json` (4 translations, 2,858 chapters).
  - Data served via symlink: `public/data → data/`.

### Changed
- **App.tsx** transformed to support dual document rendering and sync scrolling between side-by-side panes. Defaults to 1 Nephi 1 (LDS) on load.

## [0.2.0] - Content Pipeline

### Added
- **Unified content pipeline** (`scripts/ingest.ts`): Single CLI that ingests any EPUB into the Telos UVID schema via profile-based parsers.
  - `lds-bom` profile: 239 chapters, 6,843 blocks from official LDS Book of Mormon EPUB.
  - `kjv` profile: 1,189 chapters, 34,320 blocks from King James Bible EPUB.
  - `nrsvue` profile: 1,380 chapters, 39,809 blocks from NRSVue Bible EPUB.
  - `hardy-bom` profile: 38 documents, 3,162 blocks from Hardy Annotated BoM (Oxford UP) with interleaved commentary.
- Bible book abbreviation mappings (`scripts/lib/bible-books.ts`): 120+ canonical book names covering OT, NT, Deuterocanonical, BoM, D&C, and Pearl of Great Price.
- Generic EPUB reader (`scripts/lib/epub-reader.ts`): Parses content.opf, toc.ncx, and spine ordering for any EPUB.
- Shared types (`scripts/lib/types.ts`): Block, TelosDocument, Profile interfaces.
- Pre-ingested JSON data in `data/` directory for all four sources.

### Changed
- Replaced old multi-step pipeline (unzip_epub.ts + ingest_epub.ts + manual AI prompts) with unified single-command system.
- Updated all documentation to reflect actual codebase state.
- Reorganized docs: canonical versions live in `docs/`, removed root-level duplicates.
- Updated MVP roadmap to mark completed items.

### Removed
- `scripts/unzip_epub.ts` (functionality absorbed into ingest.ts).
- `scripts/ingest_epub.ts` (replaced by profile-based system).
- `src/App.css` (unused Vite boilerplate).
- Root-level duplicate markdown files (canonical docs in `docs/`).

## [0.1.0] - Phase 1 Scaffolding

### Added
- Vite + React + TypeScript + Tailwind CSS project scaffold.
- Design system tokens in `src/index.css` (colors, fonts, dark mode).
- Three-pane app shell (`src/App.tsx`) with sidebar, reading canvas, notes panel.
- File System Access API hook (`src/hooks/useFileSystem.ts`).
- SQLite WASM + OPFS database stub (`src/db/db.ts`).
- PDF extraction helper (`scripts/extract_pdf.py`) using Marker.
- Comprehensive documentation across `docs/` directory.
