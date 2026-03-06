# Content Pipeline Strategy

## Overview

All content ingestion is handled by a single unified CLI:

```bash
npx tsx scripts/ingest.ts <epub-file> --profile <profile-name> [--output <dir>]
```

Each EPUB format has a **profile** — a TypeScript module in `scripts/lib/profiles/` that
understands the specific HTML structure of that publisher's EPUB and extracts verses,
headings, summaries, and commentary into the Telos UVID schema.

## Current Profiles

| Profile      | Source                         | Translation     | Blocks Extracted |
|-------------|-------------------------------|-----------------|------------------|
| `lds-bom`   | LDS Church official BoM EPUB  | LDS             | 6,843            |
| `kjv`       | King James Bible EPUB         | KJV             | 34,320           |
| `nrsvue`    | NRSVue Bible EPUB             | NRSVue          | 39,809           |
| `hardy-bom` | Hardy Annotated BoM (Oxford)  | Hardy Annotated | 3,162            |

## Adding New Sources

To import a new EPUB:

1. Unzip it and inspect the HTML structure (use `adm-zip` or rename to `.zip`)
2. Identify the verse marker pattern (CSS classes, IDs, inline spans, etc.)
3. Create a new profile in `scripts/lib/profiles/`
4. Register it in `scripts/lib/profiles/index.ts`
5. Run: `npx tsx scripts/ingest.ts path/to/new.epub --profile new-profile`

## PDF Sources

For PDFs (like complex study bibles):

1. Convert PDF to Markdown using [Marker](https://github.com/VikParuchuri/marker): `pip install marker-pdf && marker_single input.pdf --output_dir ./output/`
2. Write a profile that parses the resulting Markdown
3. The `scripts/extract_pdf.py` helper automates step 1

## Output Schema

See `content_pipeline.md` for the full Telos normalization schema.
All output uses Universal Verse IDs (UVIDs) as defined in `navigation_ux.md`.
