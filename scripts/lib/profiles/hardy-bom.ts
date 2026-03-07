import * as cheerio from "cheerio";
import type { Profile, TelosDocument, Block, TocEntry, EpubSpineEntry } from "../types.js";
import type AdmZip from "adm-zip";

// The Hardy "Annotated Book of Mormon" (Oxford University Press):
//
// Book detection:
//   - ONLY 2 of 15 books use h1.chaptertitle in the EPUB (2 Nephi, Moroni).
//   - The rest are identified from the EPUB TOC (toc.ncx), where top-level
//     entries (no fragment anchor) map filenames to book titles.
//   - We build a filename → bookInfo map from the TOC first, then apply it
//     at the start of each spine file.
//
// Chapter structure:
//   - Chapter labels appear in span.label inside content paragraphs: "1", "2", "[II] 3"
//     The trailing digit is the chapter number.
//   - Section headings (h1.h1, h2.h2, h2.h2a) appear inline between verse paragraphs.
//   - Verse numbers appear as the first numeric <sup> in a paragraph (not inside span.label).
//   - The chapter-label paragraph often carries verse 1 with no explicit sup — auto-assign.
//   - Commentary paragraphs have labels ending in ":"  or "." or ranges like "1–4:".

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
  // "The Book of Mormon" (book named Mormon) — careful: also matches EPUB-level intro
  // Safe because intro files have no chapter labels and emit no documents.
  "The Book of Mormon": { abbrev: "morm", name: "Mormon" },
  "The Book of Ether": { abbrev: "ether", name: "Ether" },
  "The Book of Moroni": { abbrev: "moro", name: "Moroni" },
};

const CONTENT_PARA_CLASSES = new Set([
  "parafl", "para", "paraind", "paft", "paftfl", "pf", "paraflt",
]);

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
    // Commentary labels end in ":", ".", or contain ranges like "1–4:"
    if (/[:.]\s*$/.test(labelText) || /\d+\s*[–-]\s*\d+\s*:/.test(labelText)) {
      result.isCommentary = true;
    } else {
      // Chapter label: "[I]1", "[II] 3", "2", etc. — extract trailing digit
      const chapterMatch = labelText.match(/(\d+)\s*$/);
      if (chapterMatch) {
        result.chapterLabel = parseInt(chapterMatch[1], 10);
      }
    }
  }

  // Find verse number: first numeric <sup> not nested inside span.label
  if (!result.isCommentary) {
    $el.find("sup").each((_, sup) => {
      if (result.verseNumber !== null) return;
      if ($(sup).closest("span.label").length > 0) return;
      const t = $(sup).text().trim();
      if (/^\d+$/.test(t)) {
        const num = parseInt(t, 10);
        if (num > 0 && num < 300) result.verseNumber = num;
      }
    });
  }

  // Clean text: strip labels, verse-number sup, footnote links, empty id spans
  const $clone = $el.clone();
  $clone.find("span.label").remove();
  const firstSup = $clone.find("sup").first();
  if (firstSup.length && /^\d+$/.test(firstSup.text().trim())) {
    const parent = firstSup.parent();
    if (parent.is("a[href*='note']")) {
      parent.remove();
    } else {
      firstSup.remove();
    }
  }
  $clone.find("a[href*='note']").remove();
  $clone.find("span[id]").each((_, s) => {
    if (!$(s).text().trim()) $(s).remove();
  });
  result.text = $clone.text().replace(/\s+/g, " ").trim();

  return result;
}

/** Build filename → bookInfo from EPUB TOC (top-level entries only, no fragments). */
function buildFileBookMap(
  toc: TocEntry[]
): Map<string, { abbrev: string; name: string }> {
  const map = new Map<string, { abbrev: string; name: string }>();
  for (const entry of toc) {
    // Skip section anchors (fragments)
    if (entry.src.includes("#")) continue;
    const filename = entry.src.split("/").pop() ?? "";
    if (!filename || map.has(filename)) continue;

    for (const [pattern, info] of Object.entries(HARDY_BOOK_MAP)) {
      if (entry.label.includes(pattern)) {
        map.set(filename, info);
        break;
      }
    }
  }
  return map;
}

export const hardyBomProfile: Profile = {
  name: "hardy-bom",
  translation: "Hardy Annotated",
  type: "study-bible",

  parse(zip: AdmZip, toc: TocEntry[], spine: EpubSpineEntry[]): TelosDocument[] {
    const documents: TelosDocument[] = [];
    const fileBookMap = buildFileBookMap(toc);

    let currentBook = { abbrev: "1-ne", name: "1 Nephi" };
    let currentChapter = 0;
    let chapterBlocks: Block[] = [];
    let lastVerseId = "bom-1-ne-0-0";
    let commentaryCount = 0;

    function flushChapter() {
      if (currentChapter > 0 && chapterBlocks.length > 0) {
        // Strip trailing headings — they appear before the NEXT chapter label in
        // the DOM, so they introduce the next chapter, not the current one.
        let trailingStart = chapterBlocks.length;
        while (trailingStart > 0 && chapterBlocks[trailingStart - 1].type === "heading") {
          trailingStart--;
        }
        const trailingHeadings = chapterBlocks.splice(trailingStart);

        if (chapterBlocks.length > 0) {
          documents.push({
            document_id: `bom-${currentBook.abbrev}-${currentChapter}`,
            title: `${currentBook.name} ${currentChapter}`,
            type: "study-bible",
            translation: "Hardy Annotated",
            blocks: chapterBlocks,
          });
        }
        // Carry the orphaned headings forward as the start of the next chapter
        chapterBlocks = trailingHeadings;
      }
      commentaryCount = 0;
    }

    for (const entry of spine) {
      const filename = entry.href.split("/").pop() ?? "";
      const html = zip.getEntry(entry.href)?.getData().toString("utf8") ?? "";
      if (!html) continue;

      // ── Book detection via TOC ──────────────────────────────────────────
      const tocBook = fileBookMap.get(filename);
      if (tocBook && tocBook.abbrev !== currentBook.abbrev) {
        flushChapter();
        currentBook = tocBook;
        currentChapter = 0;
        lastVerseId = `bom-${tocBook.abbrev}-0-0`;
        commentaryCount = 0;
      }

      const $ = cheerio.load(html);

      // Process all relevant elements in DOM order
      const selector = [
        "h1.h1",
        "h2.h2",
        "h2.h2a",
        "p.parafl",
        "p.para",
        "p.paraind",
        "p.paft",
        "p.paftfl",
        "p.pf",
        "p.paraflt",
      ].join(", ");

      $(selector).each((_, el) => {
        const tag = el.tagName ?? "";
        const cls = (el as cheerio.Element).attribs?.class ?? "";

        // ── Section headings (inline with chapter content) ──────────────
        if (
          (tag === "h1" && cls === "h1") ||
          (tag === "h2" && (cls === "h2" || cls === "h2a"))
        ) {
          // Convert <sub>N</sub> person disambiguators to Unicode subscript
          // digits (e.g. Nephi<sub>1</sub> → Nephi₁) before extracting text.
          const $hClone = $(el).clone();
          $hClone.find("sub").each((_, sub) => {
            const subscripted = $(sub).text().replace(/\d/g, d => "₀₁₂₃₄₅₆₇₈₉"[+d]);
            $(sub).replaceWith(subscripted);
          });
          const title = $hClone.find("span.title").text().trim() || $hClone.text().trim();
          if (title) {
            chapterBlocks.push({
              block_id: `bom-${currentBook.abbrev}-${currentChapter || "intro"}-heading-${chapterBlocks.length}`,
              type: "heading",
              text: title,
            });
          }
          return;
        }

        // ── Content paragraphs ─────────────────────────────────────────
        if (CONTENT_PARA_CLASSES.has(cls)) {
          const parsed = parseParagraph($, el);

          // New chapter detected
          if (parsed.chapterLabel !== null && parsed.chapterLabel !== currentChapter) {
            flushChapter();
            currentChapter = parsed.chapterLabel;
            lastVerseId = `bom-${currentBook.abbrev}-${currentChapter}-0`;
            commentaryCount = 0;

            // Chapter-label paragraph with text but no explicit verse number → verse 1
            if (parsed.verseNumber === null && parsed.text && parsed.text.length > 20) {
              parsed.verseNumber = 1;
            }
          }

          if (parsed.isCommentary) {
            if (parsed.text && parsed.text.length > 5) {
              commentaryCount++;
              chapterBlocks.push({
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
              chapterBlocks.push({
                block_id: blockId,
                type: "verse",
                number: parsed.verseNumber,
                text: parsed.text,
              });
            }
          } else if (parsed.text && parsed.text.length > 10) {
            commentaryCount++;
            chapterBlocks.push({
              block_id: `${lastVerseId}-commentary-${commentaryCount}`,
              type: "commentary",
              text: parsed.text,
            });
          }
        }
      });
    }

    flushChapter();
    return documents;
  },
};
