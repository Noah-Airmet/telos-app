/**
 * Ingest The New Oxford Annotated Apocrypha from Marker-extracted Markdown.
 * Use to add study notes to the Apocrypha portion of oxford-study-bible.
 *
 * Prerequisites:
 *   1. Run: python3 scripts/extract_pdf.py "new-stuff/The New Oxford Annotated Apocrypha.pdf" ./output
 *   2. Locate the generated .md file in output/
 *
 * Usage:
 *   npx tsx scripts/ingest-oxford-apocrypha-from-markdown.ts <path-to-markdown.md> [--output data/oxford-study-bible]
 */
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(import.meta.dirname, "..", "data", "oxford-study-bible");

// Apocryphal book name -> canonical abbrev (from bible-books.ts)
const BOOK_ABBREVS: Record<string, string> = {
  "Tobit": "tob", "Judith": "jdt", "Additions to Esther": "add-esth",
  "Wisdom": "wis", "Wisdom of Solomon": "wis",
  "Sirach": "sir", "Ecclesiasticus": "sir",
  "Baruch": "bar", "Letter of Jeremiah": "let-jer",
  "Prayer of Azariah": "pr-azar", "Susanna": "sus", "Bel and the Dragon": "bel",
  "1 Maccabees": "1-macc", "2 Maccabees": "2-macc",
  "1 Esdras": "1-esd", "2 Esdras": "2-esd",
  "Prayer of Manasseh": "pr-man", "Psalm 151": "ps-151",
};

interface Block {
  block_id: string;
  type: "verse" | "heading" | "paragraph" | "commentary";
  number?: number;
  text: string;
  canonical_ref?: { work: string; book: string; chapter?: number; verse?: number };
  verse_start?: number;
  verse_end?: number;
}

interface TelosDocument {
  document_id: string;
  title: string;
  type: "study-bible";
  translation: "Oxford";
  work_id: string;
  canonical_book_id: string;
  blocks: Block[];
}

function normalizeBookName(name: string): string {
  const n = name.trim();
  return BOOK_ABBREVS[n] ?? n.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function parseMarkdown(md: string): Map<string, Map<number, Block[]>> {
  const byBook = new Map<string, Map<number, Block[]>>();
  const lines = md.split(/\r?\n/);

  let currentBook = "";
  let currentChapter = 0;
  let currentBlocks: Block[] = [];

  // Heuristic: book titles are often standalone lines or "Book Name Chapter N"
  const bookMatch = md.match(/(?:^|\n)([A-Za-z0-9\s]+(?:Maccabees|Esdras|Esther|Solomon|Jeremiah|Azariah|Manasseh)?)\s*(?:Chapter\s+)?(\d+)?/);
  // Simpler: split on "Chapter N" or "Ch. N" and infer book from context
  const chapterRe = /(?:^|\n)(?:Chapter|Ch\.?)\s*(\d+)\b/im;
  const verseRe = /^(\d{1,3})\s+(.+)$/m;

  // Fallback: treat entire doc as one book (Tobit or first), split by chapter
  const chapters = md.split(/(?:^|\n)(?:Chapter|Ch\.?)\s*(\d+)\b/im);
  const abbrev = "tob"; // Default; could parse from first heading
  if (!byBook.has(abbrev)) byBook.set(abbrev, new Map());

  for (let i = 1; i < chapters.length; i += 2) {
    const chNum = parseInt(chapters[i], 10);
    const content = chapters[i + 1] ?? "";
    const blocks: Block[] = [];
    const paraLines = content.split(/\n\n+/);
    for (const line of paraLines) {
      const vMatch = line.match(/^(\d{1,3})\s+(.+)$/);
      if (vMatch) {
        blocks.push({
          block_id: `oxford-apocrypha-${abbrev}-${chNum}-${vMatch[1]}`,
          type: "verse",
          number: parseInt(vMatch[1], 10),
          text: vMatch[2].trim(),
          canonical_ref: { work: "bible", book: abbrev, chapter: chNum, verse: parseInt(vMatch[1], 10) },
          verse_start: parseInt(vMatch[1], 10),
          verse_end: parseInt(vMatch[1], 10),
        });
      } else if (line.trim()) {
        blocks.push({
          block_id: `oxford-apocrypha-${abbrev}-${chNum}-p-${blocks.length}`,
          type: "paragraph",
          text: line.trim(),
          canonical_ref: { work: "bible", book: abbrev, chapter: chNum, verse: 1 },
          verse_start: 1,
          verse_end: 1,
        });
      }
    }
    if (blocks.length > 0) byBook.get(abbrev)!.set(chNum, blocks);
  }

  return byBook;
}

function main() {
  const args = process.argv.slice(2);
  let mdPath = "";
  let outputDir = OUTPUT_DIR;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) outputDir = args[++i];
    else if (!args[i].startsWith("-")) mdPath = args[i];
  }

  if (!mdPath) {
    console.error("Usage: npx tsx scripts/ingest-oxford-apocrypha-from-markdown.ts <path-to-markdown.md> [--output dir]");
    process.exit(1);
  }

  if (!fs.existsSync(mdPath)) {
    console.error(`File not found: ${mdPath}`);
    process.exit(1);
  }

  const md = fs.readFileSync(mdPath, "utf-8");
  const byBook = parseMarkdown(md);

  fs.mkdirSync(outputDir, { recursive: true });

  let docCount = 0;
  for (const [abbrev, chapters] of byBook) {
    for (const [chNum, blocks] of chapters) {
      const doc: TelosDocument = {
        document_id: `${abbrev}-${chNum}`,
        title: `${abbrev} ${chNum}`,
        type: "study-bible",
        translation: "Oxford",
        work_id: "bible",
        canonical_book_id: abbrev,
        blocks,
      };
      fs.writeFileSync(path.join(outputDir, `${doc.document_id}.json`), JSON.stringify(doc, null, 2));
      docCount++;
    }
  }

  console.log(`Wrote ${docCount} documents to ${outputDir}/`);
}

main();
