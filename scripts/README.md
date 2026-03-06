# Telos Content Pipeline

One command to ingest any EPUB into the Telos UVID schema.

## Usage

```bash
npx tsx scripts/ingest.ts <epub-file> --profile <profile> [--output <dir>]
```

## Profiles

| Profile      | Source                         | Translation     | Output          |
|-------------|-------------------------------|-----------------|-----------------|
| `lds-bom`   | LDS Church official BoM EPUB  | LDS             | `data/lds-bom/` |
| `kjv`       | King James Bible EPUB         | KJV             | `data/kjv/`     |
| `nrsvue`    | NRSVue Bible EPUB             | NRSVue          | `data/nrsvue/`  |
| `hardy-bom` | Hardy Annotated BoM (Oxford)  | Hardy Annotated | `data/hardy-bom/` |

## Examples

```bash
# Ingest all four EPUBs
npx tsx scripts/ingest.ts scripts/book-of-mormon-2013.epub --profile lds-bom
npx tsx scripts/ingest.ts scripts/kjv.epub --profile kjv
npx tsx scripts/ingest.ts scripts/nrsvue.epub --profile nrsvue
npx tsx scripts/ingest.ts scripts/hardy-annotated-bom.epub --profile hardy-bom
```

## Output Format

Each chapter becomes a JSON file with the Telos schema:

```json
{
  "document_id": "gen-1",
  "title": "Genesis 1",
  "type": "scripture",
  "translation": "KJV",
  "blocks": [
    { "block_id": "gen-1-1", "type": "verse", "number": 1, "text": "In the beginning..." },
    { "block_id": "gen-1-2", "type": "verse", "number": 2, "text": "And the earth was..." }
  ]
}
```

Block IDs follow the Universal Verse ID (UVID) format: `[book]-[chapter]-[verse]`.
This enables parallel sync between translations — the same verse in KJV and NRSVue
shares the same `block_id`, so the UI can scroll both panes to the same verse.

## Adding a New Profile

Create a file in `scripts/lib/profiles/` that exports a `Profile` object:

```ts
import type { Profile } from "../types.js";

export const myProfile: Profile = {
  name: "my-profile",
  translation: "My Translation",
  type: "scripture",
  parse(zip, toc, spine) {
    // Return TelosDocument[]
  },
};
```

Then register it in `scripts/lib/profiles/index.ts`.
