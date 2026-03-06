# Changelog

All notable changes to the Telos Gospel Library project will be documented in this file.

## [Unreleased]

### Added
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
