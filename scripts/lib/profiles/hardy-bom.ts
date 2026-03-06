import * as cheerio from "cheerio";
import type { Profile, TelosDocument, Block, TocEntry, EpubSpineEntry } from "../types.js";
import type AdmZip from "adm-zip";

// The Hardy "Annotated Book of Mormon" (Oxford University Press):
//
// Structure:
//   - <span class="label">N</span> → CHAPTER marker (N=chapter number)
//   - <span class="label">[VII] N</span> → Section + CHAPTER marker
//   - Verse numbers appear as <sup>N</sup> (often inside <a> footnote wrappers)
//   - Labels with colons like "1–2:", "Preface." → commentary headers
//   - Each _chapter file contains an entire BoM book
//   - Example: <span class="label">3</span> <sup>1</sup> text = Chapter 3, Verse 1

const HARDY_BOOK_MAP: Record<string, { abbrev: string; name: string }> = {
  "The First Book of Nephi": { abbrev: "1-ne", name: "1 Nephi" },
  "The Second Book of Nephi": { abbrev: "2-ne", name: "2 Nephi" },
  "The Book of Jacob": { abbrev: "jacob", name: "Jacob" },
  "The Book of Enos": { abbrev: "enos", name: "Enos" },
  "The Book of Jarom": { abbrev: "jarom", name: "Jarom" },
  "The Book of Omni": { abbrev: "omni", name: "Omni" },
  "The Words of Mormon": { abbrev: "w-of-m", name: "Words of Mormon" },
  "The Book of Mosiah": { abbrev: "mosiah", name: "Mosiah" },
  "The Book of Alma": { abbrev: "alma", name: "Alma" },
  "The Book of Helaman": { abbrev: "hel", name: "Helaman" },
  "Third Nephi": { abbrev: "3-ne", name: "3 Nephi" },
  "Fourth Nephi": { abbrev: "4-ne", name: "4 Nephi" },
  "The Book of Mormon": { abbrev: "morm", name: "Mormon" },
  "The Book of Ether": { abbrev: "ether", name: "Ether" },
  "The Book of Moroni": { abbrev: "moro", name: "Moroni" },
};

interface ParsedParagraph {
  chapterLabel: number | null;
  verseNumber: number | null;
  isCommentary: boolean;
  text: string;
}

function parseParagraph($: cheerio.CheerioAPI, el: cheerio.Element): ParsedParagraph {
  const $el = $(el);
  const result: ParsedParagraph = {
    chapterLabel: null,
    verseNumber: null,
    isCommentary: false,
    text: "",
  };

  const label = $el.find("span.label");
  if (label.length > 0) {
    const labelText = label.text().trim();

    // Commentary labels: contain colons, periods, en-dashes with colons
    if (/[:.]\s*$/.test(labelText) || /\d+\s*[–-]\s*\d+\s*:/.test(labelText)) {
      result.isCommentary = true;
    } else {
      // Chapter label: extract trailing number from "[VII] 22" or "3"
      const chapterMatch = labelText.match(/(\d+)\s*$/);
      if (chapterMatch) {
        result.chapterLabel = parseInt(chapterMatch[1], 10);
      }
    }
  }

  // Find verse number from <sup>N</sup> elements
  // Hardy nests elements deeply: <p><a><span><span><label>...</span></span></a> <sup>N</sup>
  // or <p><span><span><label>...</span> <sup>N</sup></span></span>
  // So we search ALL <sup> descendants for the first numeric one that isn't inside the label
  if (!result.isCommentary) {
    $el.find("sup").each((_, sup) => {
      if (result.verseNumber !== null) return; // already found
      // Skip sups that are part of the label bracket markers ([, I, ])
      if ($(sup).closest("span.label").length > 0) return;
      const text = $(sup).text().trim();
      if (/^\d+$/.test(text)) {
        const num = parseInt(text, 10);
        if (num > 0 && num < 200) {
          result.verseNumber = num;
        }
      }
    });
  }

  // Clean text: remove labels, sup verse markers, footnote links, empty spans
  const $clone = $el.clone();
  $clone.find("span.label").remove();
  // Remove the first <sup> (verse number) — but only the very first one
  const firstSup = $clone.find("sup").first();
  if (firstSup.length && /^\d+$/.test(firstSup.text().trim())) {
    // Only remove if it's the verse-number sup, not a footnote letter
    const parent = firstSup.parent();
    if (parent.is("a[href*='note']")) {
      parent.remove();
    } else {
      firstSup.remove();
    }
  }
  // Remove remaining footnote links
  $clone.find("a[href*='note']").remove();
  // Remove empty id-marker spans
  $clone.find("span[id]").each((_, s) => {
    if (!$(s).text().trim()) $(s).remove();
  });
  result.text = $clone.text().replace(/\s+/g, " ").trim();

  return result;
}

export const hardyBomProfile: Profile = {
  name: "hardy-bom",
  translation: "Hardy Annotated",
  type: "study-bible",

  parse(zip: AdmZip, toc: TocEntry[], spine: EpubSpineEntry[]): TelosDocument[] {
    const documents: TelosDocument[] = [];

    let currentBook = { abbrev: "1-ne", name: "1 Nephi" };
    let currentChapter = 1;

    for (const entry of spine) {
      const html = zip.getEntry(entry.href)?.getData().toString("utf8") ?? "";
      if (!html) continue;

      const $ = cheerio.load(html);
      const blocks: Block[] = [];

      // Detect book from chapter title
      $("h1.chaptertitle1").each((_, el) => {
        const titleText = $(el).find(".title").text().trim();
        for (const [pattern, info] of Object.entries(HARDY_BOOK_MAP)) {
          if (titleText.includes(pattern)) {
            currentBook = info;
            currentChapter = 1;
            break;
          }
        }
      });

      // Extract section headings
      $("h1.h1, h1.chaptersubt").each((_, el) => {
        const title = $(el).text().replace(/\s+/g, " ").trim();
        if (title) {
          blocks.push({
            block_id: `bom-${currentBook.abbrev}-${currentChapter}-heading-${blocks.length}`,
            type: "heading",
            text: title,
          });
        }
      });

      // Process content paragraphs
      let lastVerseId = `bom-${currentBook.abbrev}-${currentChapter}-0`;
      let commentaryCount = 0;

      $("p.parafl, p.para, p.paraind, p.paft, p.paftfl, p.pf").each((_, el) => {
        const parsed = parseParagraph($, el);

        // Update chapter
        if (parsed.chapterLabel !== null) {
          currentChapter = parsed.chapterLabel;
          commentaryCount = 0;

          // When a chapter label has text but no explicit verse number,
          // the text IS verse 1 (Hardy starts each chapter paragraph with v1)
          if (parsed.verseNumber === null && parsed.text && parsed.text.length > 20) {
            parsed.verseNumber = 1;
          }
        }

        if (parsed.isCommentary) {
          if (parsed.text && parsed.text.length > 5) {
            commentaryCount++;
            blocks.push({
              block_id: `${lastVerseId}-commentary-${commentaryCount}`,
              type: "commentary",
              text: parsed.text,
            });
          }
          return;
        }

        if (parsed.verseNumber !== null) {
          const blockId = `bom-${currentBook.abbrev}-${currentChapter}-${parsed.verseNumber}`;
          lastVerseId = blockId;
          commentaryCount = 0;

          if (parsed.text) {
            blocks.push({
              block_id: blockId,
              type: "verse",
              number: parsed.verseNumber,
              text: parsed.text,
            });
          }
        } else if (parsed.text && parsed.text.length > 10) {
          // No verse marker = commentary or continuation
          commentaryCount++;
          blocks.push({
            block_id: `${lastVerseId}-commentary-${commentaryCount}`,
            type: "commentary",
            text: parsed.text,
          });
        }
      });

      if (blocks.length > 0) {
        const filename = entry.href.split("/").pop()?.replace(".xhtml", "") ?? "unknown";
        documents.push({
          document_id: `bom-${currentBook.abbrev}-hardy-${filename}`,
          title: `${currentBook.name} (Hardy Annotated)`,
          type: "study-bible",
          translation: "Hardy Annotated",
          blocks,
        });
      }
    }

    return documents;
  },
};
