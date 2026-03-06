import * as cheerio from "cheerio";
import type { Profile, TelosDocument, Block, TocEntry, EpubSpineEntry } from "../types.js";
import { loadHtml } from "../epub-reader.js";
import { lookupAbbrev } from "../bible-books.js";
import type AdmZip from "adm-zip";

// The KJV EPUB (Calibre-exported from biblos.com):
//   - 1189 numbered .htm files, one per chapter (0.htm = TOC)
//   - Title tag: "Genesis 1 KJV"
//   - Verses: <span class="reftext">1</span> inline in <p class="reg"> paragraphs
//   - Section headings: <p class="hdg">The Beginning</p>
//   - Multiple verses can share a single <p> tag
//   - toc.ncx maps book names to starting file numbers

export const kjvProfile: Profile = {
  name: "kjv",
  translation: "KJV",
  type: "scripture",

  parse(zip: AdmZip, toc: TocEntry[], spine: EpubSpineEntry[]): TelosDocument[] {
    const documents: TelosDocument[] = [];

    // Build a map of file path → { book, chapterInBook }
    // from the TOC. The TOC tells us where each book starts.
    const bookBoundaries = toc
      .filter(e => e.label !== "Table of Contents")
      .map(e => ({
        name: e.label,
        abbrev: lookupAbbrev(e.label),
        startFile: e.src,
      }));

    // Map each spine entry to its book
    for (let i = 0; i < spine.length; i++) {
      const href = spine[i].href;
      const filename = href.split("/").pop() ?? "";

      // Skip non-chapter files
      if (filename === "0.htm" || filename === "cover.xhtml") continue;

      // Find which book this file belongs to
      let bookIdx = -1;
      for (let b = bookBoundaries.length - 1; b >= 0; b--) {
        const boundaryFile = bookBoundaries[b].startFile.split("/").pop() ?? "";
        const boundaryNum = parseInt(boundaryFile.replace(".htm", ""), 10);
        const fileNum = parseInt(filename.replace(".htm", ""), 10);
        if (!isNaN(boundaryNum) && !isNaN(fileNum) && fileNum >= boundaryNum) {
          bookIdx = b;
          break;
        }
      }

      if (bookIdx === -1) continue;

      const book = bookBoundaries[bookIdx];
      const startFile = book.startFile.split("/").pop() ?? "";
      const startNum = parseInt(startFile.replace(".htm", ""), 10);
      const fileNum = parseInt(filename.replace(".htm", ""), 10);
      if (isNaN(startNum) || isNaN(fileNum)) continue;

      const chapter = fileNum - startNum + 1;
      const $ = loadHtml(zip, href);
      const blocks: Block[] = [];

      // Extract section headings
      $("p.hdg").each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          blocks.push({
            block_id: `${book.abbrev}-${chapter}-heading-${blocks.length}`,
            type: "heading",
            text,
          });
        }
      });

      // Extract verses from <p class="reg"> containing <span class="reftext">
      // KJV packs multiple verses into single <p> tags, separated by reftext spans
      const allText = $("body").html() ?? "";
      const verseRegex = /<span class="reftext">(\d+)<\/span>([\s\S]*?)(?=<span class="reftext">|\s*<\/p>|\s*<p class="hdg")/g;
      let m: RegExpExecArray | null;

      while ((m = verseRegex.exec(allText)) !== null) {
        const verseNum = parseInt(m[1], 10);
        // Strip HTML tags and clean up whitespace
        const rawText = m[2]
          .replace(/<[^>]+>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        if (rawText && !isNaN(verseNum)) {
          blocks.push({
            block_id: `${book.abbrev}-${chapter}-${verseNum}`,
            type: "verse",
            number: verseNum,
            text: rawText,
          });
        }
      }

      // Sort blocks: headings first (in order), then verses by number
      const headings = blocks.filter(b => b.type === "heading");
      const verses = blocks.filter(b => b.type === "verse").sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

      // Interleave headings with verses based on original DOM order
      // For simplicity, just put all verses in order (headings are positional context)
      const sortedBlocks = [...headings, ...verses];

      if (verses.length > 0) {
        documents.push({
          document_id: `${book.abbrev}-${chapter}`,
          title: `${book.name} ${chapter}`,
          type: "scripture",
          translation: "KJV",
          blocks: sortedBlocks,
        });
      }
    }

    return documents;
  },
};
