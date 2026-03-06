# Power User Feature Review & Roadmap

Telos already has good foundations for a serious study app: a local-first PWA shell, a content pipeline that normalizes sources into UVID-keyed JSON, a side-by-side reading layout, and basic local highlights and notes.

The main architectural question is no longer "can we add power-user features at all?" but "which ones fit the current `block_id`-centric model, and which ones require a richer content schema, local index, or real sync layer?"

## Current Baseline

- **Already working:** multiple content profiles, chapter navigation, block-level rendering, commentary blocks, range highlights, phrase-anchored notes, two-pane synced reading, first-pass diff highlighting, and private dictionary import with click-to-lookup.
- **Already designed for growth:** UVID-based alignment across editions, canonicalized manifest metadata, tokenized blocks, profile-based ingestion, and a repository abstraction that can run in local-only or synced mode.
- **Current hard limits:** textual variants, formal indices, and imported private resources are not yet first-class synced datasets; Firestore sync is intentionally scoped to notes, highlights, and reading state.

## Feasibility Review

| Requested feature | Feasibility | Architectural impact | Notes |
| --- | --- | --- | --- |
| Various editions of the text (`Book of Commandments`, multiple `D&C` editions, multiple `BoM` editions) | High | Moderate | This is the cleanest fit for the current pipeline. We already ingest multiple profiles and sync by UVID. The main work is better canonical metadata, edition-family mappings, and ingestion of new source texts. |
| Textual variant footnotes between editions | Medium | Significant schema and pipeline expansion | This is feasible, but not as a simple UI feature. We need a way to store variant anchors, the reading range they apply to, the source edition, and the alternate reading itself. That means extending the normalized block format beyond plain `text`. |
| Text comparison tool with differences highlighted | High | Moderate | Telos now has canonicalized manifest matching, side-by-side comparison, fallback handling for mismatched texts, and a first-pass diff view. A deeper token-aware diff engine is still future enhancement work. |
| Click a word for `1828` Webster's dictionary | High | Moderate data-model and UI work | The app now supports user-imported private dictionary JSON plus click-to-lookup on tokenized text. The next step is better import tooling and richer dictionary formats. |
| Additional dictionaries such as `OED` | Low to Medium | Mostly external licensing/product risk | The technical pattern is similar to Webster's, but `OED` is primarily a rights and distribution question, not just an engineering one. If local redistribution is not allowed, this likely becomes an external API or user-provided resource feature. |
| Better indices: names, topics, places, quotations/allusions | Medium | Moderate to significant indexing work | This is feasible if we treat indices as curated or generated secondary datasets. Names/topics/places are straightforward compared with quotation/allusion detection, which usually needs editorial curation or careful heuristics. |
| More highlighting options | High | Low to Moderate | The current highlight model already stores ranges and colors. Adding more colors, underline styles, labels, or highlight filters is incremental work. |
| Better note-taking | High | Moderate | Richer notes are very feasible, but the current note model is only block-linked. Word- or phrase-anchored notes, backlinks, notebooks, and transclusion all require a richer anchor model and better note metadata. |
| Sync between devices | Medium-High | Major architectural change already started | Google OAuth + Firestore are now in place for notes, highlights, and reading state. The remaining work is mostly around deployment, security rules, sync UX, and expanding the set of synced entities. |

## Recommended Product Interpretation

Not all of these requests should be treated the same way.

- **Edition support** and **basic comparison** should be considered near-term product work.
- **Variant footnotes**, **dictionary lookups**, and **formal indices** should be treated as a "richer study data model" project.
- **Cross-device sync** should be treated as a separate platform initiative, not bundled into annotation polish.

## Suggested Implementation Order

### Phase 1: Sync Foundation And Reliable Comparison

- Keep Google OAuth + Firestore sync focused on notes, highlights, and reading state.
- Expand sync UX with status indicators, errors, and deployed security rules.
- Keep hardening manifest metadata so books/works/editions can be matched canonically.
- Improve compare mode wherever imported or irregular study editions cannot align cleanly.

### Phase 2: Richer Study Schema

- Extend the content model to support footnote markers, variant records, and structured cross-references.
- Promote imported/private dictionary data from a basic JSON lookup table to a richer local library model.
- Introduce index datasets for people, places, topics, and scripture quotations.

### Phase 3: Heavier Local Query Layer

- Add SQLite WASM + OPFS when local search, indexing, and complex study queries outgrow simple browser storage.
- Use that query layer for filtered search, notebooks, backlinks, and advanced index navigation.

### Phase 4: Expand Sync Scope

- Decide which additional entities should sync: imported private resources, notebooks, saved layouts, or planner data.
- Add explicit conflict-resolution and auditability for richer synced study objects.
- Keep the app usable offline even when sync is enabled.

## Data Model Changes Worth Planning For Now

To avoid painting ourselves into a corner, future schema design should assume we will eventually need:

- **Canonical references:** a work/book/chapter/verse identity that is independent from display names and edition-specific labels.
- **Anchors inside a block:** character offsets today, but likely token ranges or normalized word IDs later.
- **Structured study apparatus:** footnotes, textual variants, cross-references, and commentary as first-class records, not just free text.
- **Secondary indices:** lookup tables for names, places, topics, quotations, and dictionary entries.
- **Durable study storage:** a path beyond `localStorage` for large note libraries and future sync.

## Fit With Existing Roadmap

The earlier roadmap items still make sense, but they should now be grouped by dependency:

- **Can build soon on current architecture:** improved compare view, more highlight styles, richer note UI, saved layouts, lesson-planner UX.
- **Need richer schema/indexing first:** word-anchored notes, textual variants, Strong's-style lexical tools, dictionaries, advanced indices, advanced search filters.
- **Need a platform shift:** cross-device sync and any feature that depends on multi-device conflict-free replication.

## Bottom Line

Most of the requested power-user features are feasible for Telos without a massive rewrite.

The main exception is **cross-device sync**, which is a true architecture project.

The other "Logos-like" asks are better understood as **content-model and indexing upgrades**. They are substantial, but they build naturally on the UVID-based ingestion pipeline that already exists.
