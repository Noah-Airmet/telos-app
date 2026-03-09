/**
 * Ingest Doctrine and Covenants from Marker-extracted Markdown.
 *
 * Prerequisites:
 *   1. Run: python3 scripts/extract_pdf.py new-stuff/doctrine-and-covenants.pdf ./output
 *   2. Locate the generated .md file in output/doctrine-and-covenants/
 *
 * Usage:
 *   npx tsx scripts/ingest-dc-from-markdown.ts <path-to-markdown.md> [--output data/lds-dc]
 */
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(import.meta.dirname, "..", "data", "lds-dc");

interface Block {
  block_id: string;
  type: "verse" | "paragraph" | "heading";
  number?: number;
  text: string;
  canonical_ref?: { work: string; book: string; chapter?: number; verse?: number };
  verse_start?: number;
  verse_end?: number;
}

interface TelosDocument {
  document_id: string;
  title: string;
  type: "scripture";
  translation: "LDS";
  work_id: string;
  canonical_book_id: string;
  blocks: Block[];
}

// Section header patterns: "Section 1", "SECTION 1", "1.", "D&C 1", etc.
const SECTION_HEADER_RE = /^(?:Section\s+)?(\d{1,3})(?:\.|:)?\s*(.*)$/im;
const VERSE_LINE_RE = /^(\d{1,3})\s+(.+)$/m;

function parseMarkdown(md: string): Map<number, { title?: string; verses: Array<{ num: number; text: string }> }> {
  const sections = new Map<number, { title?: string; verses: Array<{ num: number; text: string }> }>();
  let currentSection = 0;
  let currentVerses: Array<{ num: number; text: string }> = [];
  let currentTitle: string | undefined;

  const lines = md.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Try section header: "Section 1" or "1. Title"
    const sectionMatch = line.match(/^Section\s+(\d{1,3})\b/i) || line.match(/^(\d{1,3})\.\s+(.+)$/);
    if (sectionMatch) {
      if (currentSection > 0 && currentVerses.length > 0) {
        sections.set(currentSection, { title: currentTitle, verses: currentVerses });
      }
      currentSection = parseInt(sectionMatch[1], 10);
      currentTitle = sectionMatch[2]?.trim();
      currentVerses = [];
      continue;
    }

    // Verse line: "1 Text of verse..."
    const verseMatch = line.match(/^(\d{1,3})\s+(.+)$/);
    if (verseMatch && currentSection > 0) {
      const num = parseInt(verseMatch[1], 10);
      const text = verseMatch[2].trim();
      if (text) currentVerses.push({ num, text });
      continue;
    }

    // Continuation of previous verse (no leading number)
    if (currentSection > 0 && currentVerses.length > 0 && line.trim()) {
      const last = currentVerses[currentVerses.length - 1];
      last.text += " " + line.trim();
    }
  }

  if (currentSection > 0 && currentVerses.length > 0) {
    sections.set(currentSection, { title: currentTitle, verses: currentVerses });
  }

  return sections;
}

function markdownToDocuments(md: string): TelosDocument[] {
  const sections = parseMarkdown(md);
  const documents: TelosDocument[] = [];

  for (const [sectionNum, { title, verses }] of sections) {
    const blocks: Block[] = [];

    if (title) {
      blocks.push({
        block_id: `dc-${sectionNum}-heading`,
        type: "heading",
        text: title,
      });
    }

    for (const v of verses) {
      blocks.push({
        block_id: `dc-${sectionNum}-${v.num}`,
        type: "verse",
        number: v.num,
        text: v.text,
        canonical_ref: { work: "dc", book: "dc", chapter: sectionNum, verse: v.num },
        verse_start: v.num,
        verse_end: v.num,
      });
    }

    const sectionTitle = title ? `Section ${sectionNum}: ${title}` : `Section ${sectionNum}`;
    documents.push({
      document_id: `dc-${sectionNum}`,
      title: sectionTitle,
      type: "scripture",
      translation: "LDS",
      work_id: "dc",
      canonical_book_id: "dc",
      blocks,
    });
  }

  return documents;
}

function main() {
  const args = process.argv.slice(2);
  let mdPath = "";
  let outputDir = OUTPUT_DIR;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) {
      outputDir = args[++i];
    } else if (!args[i].startsWith("-")) {
      mdPath = args[i];
    }
  }

  if (!mdPath) {
    console.error("Usage: npx tsx scripts/ingest-dc-from-markdown.ts <path-to-markdown.md> [--output dir]");
    process.exit(1);
  }

  if (!fs.existsSync(mdPath)) {
    console.error(`File not found: ${mdPath}`);
    process.exit(1);
  }

  const md = fs.readFileSync(mdPath, "utf-8");
  const documents = markdownToDocuments(md);

  fs.mkdirSync(outputDir, { recursive: true });

  for (const doc of documents) {
    const filePath = path.join(outputDir, `${doc.document_id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2));
  }

  console.log(`Wrote ${documents.length} documents to ${outputDir}/`);
}

main();
