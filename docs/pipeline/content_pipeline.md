# Content Pipeline

The ingestion pipeline converts raw EPUB files into the Telos normalization schema — structured JSON with Universal Verse IDs (UVIDs) that enable parallel translation syncing.

## 1. Data Sources

1. **LDS Standard Works:** Official `.epub` files from the Church website.
2. **Alternate Translations:** User-supplied `.epub` (KJV, NRSVue, JSB, etc.).
3. **Study Bibles:** Academic editions with interleaved commentary (e.g., Hardy Annotated BoM).
4. **PDFs:** Complex multi-column PDFs extracted via Marker to Markdown first.

## 2. The Normalization Schema (The "Telos" Format)

Every ingested document becomes a JSON file following this structure:

```json
{
  "document_id": "bom-1-ne-3",
  "title": "1 Nephi 3",
  "type": "scripture",
  "translation": "LDS",
  "blocks": [
    {
      "block_id": "bom-1-ne-3-summary",
      "type": "summary",
      "text": "Lehi's sons return to Jerusalem to obtain the plates of brass..."
    },
    {
      "block_id": "bom-1-ne-3-1",
      "type": "verse",
      "number": 1,
      "text": "And it came to pass that I, Nephi, returned from speaking with the Lord..."
    },
    {
      "block_id": "bom-1-ne-3-7",
      "type": "verse",
      "number": 7,
      "text": "And it came to pass that I, Nephi, said unto my father: I will go and do..."
    }
  ]
}
```

### Block Types

| Type          | Description                                          | Example ID                        |
|--------------|------------------------------------------------------|-----------------------------------|
| `verse`      | A single scripture verse                              | `bom-1-ne-3-7`                   |
| `heading`    | Section heading within a chapter                      | `gen-1-heading-0`                |
| `summary`    | Chapter summary (LDS editions)                        | `bom-1-ne-3-summary`            |
| `paragraph`  | Non-verse prose (general conference, manuals)          | `conf-oct24-oaks-p1`            |
| `commentary` | Study notes anchored to preceding verse               | `bom-1-ne-3-7-commentary-1`     |

### UVID Format

All block IDs follow the Universal Verse ID convention: `[work]-[book]-[chapter]-[verse]`

- Book of Mormon: `bom-1-ne-3-7`, `bom-alma-32-21`
- Bible: `gen-1-1`, `john-3-16`, `rev-22-21`
- Commentary: `bom-1-ne-3-7-commentary-1` (anchored to verse it explains)

This enables parallel sync — the same verse in KJV and NRSVue shares the same `block_id`.

## 3. Pipeline Steps

1. **Parse EPUB:** Read `content.opf` for spine order, `toc.ncx` for book boundaries
2. **Extract content:** Profile-specific cheerio parsers extract verses, headings, commentary
3. **Generate UVIDs:** Assign canonical block IDs using `scripts/lib/bible-books.ts` mappings
4. **Write JSON:** One file per chapter to `data/<profile>/`

## 4. Running the Pipeline

```bash
npx tsx scripts/ingest.ts <epub-file> --profile <profile-name> [--output <dir>]
```

See `scripts/README.md` for full usage and examples.

## 5. Tools

- **EPUB Parsing:** `adm-zip` (unzip) + `cheerio` (HTML extraction)
- **PDF Parsing:** [Marker](https://github.com/VikParuchuri/marker) for AI-powered PDF-to-Markdown
- **Book Mappings:** `scripts/lib/bible-books.ts` — 120+ canonical book name → abbreviation mappings
