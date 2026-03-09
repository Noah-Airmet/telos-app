/**
 * Generate stub Revelations in Context documents (ric-1 through ric-138).
 * Creates minimal structure so the commentary pane can load.
 *
 * Run Marker extraction and ingest-ric-from-markdown to replace with full content:
 *   python3 scripts/extract_pdf.py "new-stuff/Revelations in Context.pdf" ./output
 *   npx tsx scripts/ingest-ric-from-markdown.ts "output/Revelations in Context/Revelations in Context.md"
 *
 * Usage: npx tsx scripts/generate-ric-stubs.ts [--output data/revelations-in-context]
 */
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(import.meta.dirname, "..", "data", "revelations-in-context");

function main() {
  const args = process.argv.slice(2);
  let outputDir = OUTPUT_DIR;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) outputDir = args[++i];
  }

  fs.mkdirSync(outputDir, { recursive: true });

  for (let section = 1; section <= 138; section++) {
    const doc = {
      document_id: `ric-${section}`,
      title: `Section ${section}`,
      type: "commentary",
      translation: "LDS",
      work_id: "dc",
      canonical_book_id: "dc",
      blocks: [
        {
          block_id: `ric-${section}-p-0`,
          type: "paragraph",
          text: `[Revelations in Context Section ${section} — Import from PDF using Marker and ingest-ric-from-markdown.ts]`,
          canonical_ref: { work: "dc", book: "dc", chapter: section, verse: 1 },
          verse_start: 1,
          verse_end: 1,
        },
      ],
    };
    fs.writeFileSync(
      path.join(outputDir, `ric-${section}.json`),
      JSON.stringify(doc, null, 2)
    );
  }

  console.log(`Generated 138 stub commentary documents in ${outputDir}/`);
}

main();
