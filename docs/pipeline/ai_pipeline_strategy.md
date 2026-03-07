# AI-Assisted Ingestion Pipeline Strategy

## The Problem With Manual Profile Writing

Manual profiles written by guessing at EPUB structure are fragile and error-prone.
Real examples of what goes wrong:
- **NRSVue**: NT books (Matthew-Revelation) were mapped to wrong book numbers (60-86 assumed; actually 40-66). Psalm 151 showed up as "2 Peter 151" in the UI.
- **Hardy BoM**: Only 2 of 15 books have `h1.chaptertitle` — the rest require TOC-based detection. The wrong selector (`h1.chaptertitle1` vs `h1.chaptertitle`) silently failed. Output was 38 files (one per EPUB spine file) instead of 228 per-chapter files.

The fix: **inspect the actual EPUB structure first, then generate the profile from evidence.**

---

## The Correct Workflow for Adding a New Source

### Step 1 — Run the Inspector

```bash
npx tsx scripts/inspect-epub.ts path/to/new.epub > reports/my-source-inspection.txt
```

This produces a structured report covering:
- Full TOC (top-level book boundaries vs. section anchors)
- Spine file list
- All heading tag+class combinations
- Verse ID patterns (detects NRSVue-style `v[bookNum:2][chapter:3][verse:3]` automatically)
- Paragraph CSS classes with counts
- DOM structure sample from a mid-spine file

### Step 2 — Paste Report into Claude/Gemini

Paste the inspection report and give this prompt:

> "Here is an EPUB inspection report for [book title]. The output schema is in docs/pipeline/content_pipeline.md. The profile interface is in scripts/lib/profiles/index.ts and types in scripts/lib/types.ts. Generate a TypeScript profile file for this EPUB that extracts all verses, headings, and commentary into TelosDocument objects with correct UVIDs."

The AI will generate a profile tailored to the actual EPUB structure. This avoids all guesswork.

### Step 3 — Validate Against Canon

After running the profile, verify:

```bash
npx tsx scripts/ingest.ts path/to/new.epub --profile my-profile
```

Spot-check against known verses:
- First verse of book 1 (e.g., Genesis 1:1)
- A well-known middle verse (John 3:16, 1 Nephi 3:7)
- Last chapter of last book
- Total document count vs. expected chapter count

### Step 4 — Regenerate Manifest

```bash
npx tsx scripts/generate-manifest.ts
```

---

## Rules for Profile Authors (Human or AI)

1. **Use the TOC for book/file boundaries, not heading elements.**
   Heading classes vary wildly between publishers. The EPUB TOC (`toc.ncx`) is always the reliable source of what file belongs to what book.
   See: `scripts/lib/epub-reader.ts` — `parseToc()` returns `TocEntry[]` with `.label` and `.src`.

2. **Derive all mappings from the EPUB itself, never guess.**
   If a book mapping table is needed (like NRSVue's `NRSVUE_BOOK_NUMBERS`), derive it by running the inspector and checking first-verse text per book number. Never assume NT is at offset 40 or 60.

3. **Emit one TelosDocument per chapter, not per spine file.**
   Some EPUBs pack an entire book into one file. The parser must split on chapter boundary markers (chapter labels, heading patterns, etc.).

4. **Process headings inline in DOM order.**
   Never pre-extract all headings globally then prepend them. Headings appear between the verse groups they introduce. Process the DOM sequentially.

5. **Validate against known verse counts.**
   KJV: 1,189 chapters. NRSVue: ~1,398 (including Apocrypha). LDS BoM: 239 chapters.
   A parser that emits significantly fewer is missing something.

---

## Current Ingestion Commands

```bash
# Ingest all 4 sources
npx tsx scripts/ingest.ts scripts/book-of-mormon-2013.epub --profile lds-bom
npx tsx scripts/ingest.ts scripts/kjv.epub --profile kjv
npx tsx scripts/ingest.ts scripts/nrsvue.epub --profile nrsvue
npx tsx scripts/ingest.ts scripts/hardy-annotated-bom.epub --profile hardy-bom

# Regenerate manifest after any ingest
npx tsx scripts/generate-manifest.ts
```

---

## Common EPUB Structure Patterns

### Pattern A: ID-encoded verse coordinates (NRSVue)
```
<span class="ver" id="v40001001">1</span>
```
`v[bookNum:2][chapter:3][verse:3]` — book 40 = Matthew in this EPUB (not 60!).
Always verify book numbers with the inspector before writing the mapping table.

### Pattern B: One file per chapter, filename encodes book+chapter (LDS BoM)
```
OEBPS/1-ne_3.xhtml  → 1 Nephi chapter 3
```
Filename regex: `([a-z0-9-]+)_(\d+)\.xhtml`

### Pattern C: Verse numbers as inline `<span class="reftext">` (KJV)
```
<p class="reg"><span class="reftext">1</span> In the beginning...
```

### Pattern D: Chapter labels in `span.label`, verse numbers in `<sup>` (Hardy BoM)
```
<p class="parafl"><span class="label">[I]1</span> <sup>1</sup>text...
```
Book boundaries ONLY detectable via TOC — most books have no heading marker.

---

## PDF Sources

For PDFs (multi-column study bibles, conference talks, etc.):

1. Convert with [Marker](https://github.com/VikParuchuri/marker):
   ```bash
   pip install marker-pdf
   marker_single input.pdf --output_dir ./output/
   ```
2. Run the resulting Markdown through Claude with a prompt describing the schema.
3. Claude generates a parsing script (not a cheerio profile — use regex/line patterns on Markdown).
