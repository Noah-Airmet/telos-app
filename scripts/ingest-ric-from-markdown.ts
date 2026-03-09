/**
 * Ingest Revelations in Context from Marker-extracted Markdown.
 * Each chapter anchors to the corresponding D&C section.
 *
 * Prerequisites:
 *   1. Run: python3 scripts/extract_pdf.py "new-stuff/Revelations in Context.pdf" ./output
 *   2. Locate the generated .md file in output/
 *
 * Usage:
 *   npx tsx scripts/ingest-ric-from-markdown.ts <path-to-markdown.md> [--output data/revelations-in-context]
 */
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(import.meta.dirname, "..", "data", "revelations-in-context");

interface Block {
  block_id: string;
  type: "heading" | "paragraph" | "commentary";
  text: string;
  canonical_ref?: { work: string; book: string; chapter?: number; verse?: number };
  verse_start?: number;
  verse_end?: number;
}

interface TelosDocument {
  document_id: string;
  title: string;
  type: "commentary";
  translation: "LDS";
  work_id: string;
  canonical_book_id: string;
  blocks: Block[];
}

// Match "Section 1", "D&C 1", "1.", "Section 1:", "SECTION 1"
const SECTION_RE = /^(?:Section\s+)?(?:D&C\s+)?(\d{1,3})(?:\.|:)?\s*(.*)$/im;

function parseMarkdown(md: string): Map<number, { title?: string; content: string }> {
  const sections = new Map<number, { title?: string; content: string }>();
  const lines = md.split(/\r?\n/);

  let currentSection = 0;
  let currentContent: string[] = [];
  let currentTitle: string | undefined;

  function flush() {
    if (currentSection > 0 && currentContent.length > 0) {
      const content = currentContent.join("\n").trim();
      if (content) sections.set(currentSection, { title: currentTitle, content });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Try section header
    const match = line.match(/^Section\s+(\d{1,3})\b/i)
      || line.match(/^D&C\s+(\d{1,3})\b/i)
      || line.match(/^(\d{1,3})\.\s+(.+)$/);
    if (match) {
      flush();
      currentSection = parseInt(match[1], 10);
      currentTitle = match[2]?.trim();
      currentContent = [];
      continue;
    }

    if (currentSection > 0) {
      currentContent.push(line);
    }
  }
  flush();

  return sections;
}

function contentToBlocks(content: string, sectionNum: number): Block[] {
  const blocks: Block[] = [];
  const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());

  let idx = 0;
  for (const para of paragraphs) {
    const text = para.trim();
    if (!text) continue;

    // First non-empty paragraph might be a heading (essay title)
    const isLikelyHeading = idx === 0 && text.length < 120 && !text.match(/^[a-z]/);
    blocks.push({
      block_id: `ric-${sectionNum}-${isLikelyHeading ? "heading" : "p"}-${idx}`,
      type: isLikelyHeading ? "heading" : "paragraph",
      text,
      canonical_ref: { work: "dc", book: "dc", chapter: sectionNum, verse: 1 },
      verse_start: 1,
      verse_end: 1,
    });
    idx++;
  }

  return blocks;
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
    console.error("Usage: npx tsx scripts/ingest-ric-from-markdown.ts <path-to-markdown.md> [--output dir]");
    process.exit(1);
  }

  if (!fs.existsSync(mdPath)) {
    console.error(`File not found: ${mdPath}`);
    process.exit(1);
  }

  const md = fs.readFileSync(mdPath, "utf-8");
  const sections = parseMarkdown(md);

  fs.mkdirSync(outputDir, { recursive: true });

  for (const [sectionNum, { title, content }] of sections) {
    const blocks = contentToBlocks(content, sectionNum);
    const docTitle = title ? `Section ${sectionNum}: ${title}` : `Section ${sectionNum}`;

    const doc: TelosDocument = {
      document_id: `ric-${sectionNum}`,
      title: docTitle,
      type: "commentary",
      translation: "LDS",
      work_id: "dc",
      canonical_book_id: "dc",
      blocks: [
        ...(title ? [{ block_id: `ric-${sectionNum}-title`, type: "heading" as const, text: title }] : []),
        ...blocks,
      ],
    };

    fs.writeFileSync(
      path.join(outputDir, `ric-${sectionNum}.json`),
      JSON.stringify(doc, null, 2)
    );
  }

  console.log(`Wrote ${sections.size} commentary documents to ${outputDir}/`);
}

main();
