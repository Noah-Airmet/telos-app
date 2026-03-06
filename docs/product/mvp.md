# Minimum Viable Product (MVP)

The MVP proves the core value proposition: a superior desktop reading experience with real scripture data, chapter navigation, and the foundation for study tools.

## Phase 1: Core Reading Experience

- [x] **Content Ingestion:** Unified pipeline ingests 4 EPUBs (BoM, KJV, NRSVue, Hardy) into UVID-keyed JSON.
- [x] **Design System:** CSS tokens, dark mode, serif reading typography, glassmorphism header.
- [x] **App Shell:** Three-pane layout (sidebar, reading canvas, notes panel).
- [x] **Data Loading:** Manifest + per-chapter JSON fetched at runtime (`src/lib/scripture.ts`), cached in memory.
- [x] **Chapter Navigation:** Sidebar book list, prev/next arrows, keyboard left/right, cross-book boundary navigation.
- [x] **Basic Reading Experience:** VerseBlock component with serif typography, hover verse numbers, summary/heading/commentary styling.
- [x] **Text Selection & Highlighting:** Select text, apply colors, persist through the study repository.

## Phase 2: Study Tools

- [x] **Side-by-Side Reading:** Two panes synced by UVID with comparison fallbacks and first-pass diff highlighting.
- [x] **Basic Notes:** Create notes linked to verses or selected text anchors.
- [ ] **Tagging System:** Apply multiple tags to highlights or notes.
- [ ] **Search:** Full-text search across all loaded translations.
- [x] **Command Palette:** `Cmd+K` fuzzy search for fast navigation.
- [x] **Google Sign-In + Sync Foundation:** Optional Firebase-backed auth and sync for notes, highlights, and reading state.
- [x] **Private Dictionary Import:** Import a personal JSON dictionary and click a word in the reader to look it up.

## Phase 3: Lesson Planner

- [ ] **Canvas/Outline View:** Drag-and-drop outliner to build lesson plans from highlighted verses.
- [ ] **Export:** Export lesson plans to Markdown or PDF.

## Deferred From Current Milestone

- Mobile apps (iOS/Android).
- Full LDS catalog (General Conference, manuals) — standard works only.
- Social sharing or collaborative study.
- Rich synced notebooks/backlinks.
- Full textual-variant apparatus and curated indices.
