import * as cheerio from "cheerio";
import type { Profile, TelosDocument, Block, TocEntry, EpubSpineEntry } from "../types.js";
import { loadHtml } from "../epub-reader.js";
import { lookupAbbrev, BIBLE_BOOK_ABBREVS } from "../bible-books.js";
import type AdmZip from "adm-zip";

// The NRSVue EPUB (Calibre-converted):
//   - Split files like `part0007_split_000.html` through `part0007_split_031.html`
//   - Verse IDs encode book+chapter+verse: <span class="ver" id="v01002001">1</span>
//     where 01=book number (Genesis), 002=chapter, 001=verse
//   - Also: <span class="ver-f" id="v01001001">1</span> (first verse in section)
//   - Section headings: <p class="ah1">Another Account of the Creation</p>
//   - Footnote refs: <a class="fnref"> (we strip these)
//   - LORD rendered as: <span class="sm">Lord</span>

// NRSVue book number → canonical name mapping
const NRSVUE_BOOK_NUMBERS: Record<number, string> = {
  1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
  6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
  11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
  15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
  20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Songs", 23: "Isaiah",
  24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
  28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah",
  33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah", 37: "Haggai",
  38: "Zechariah", 39: "Malachi",
  // Deuterocanonical (numbered 40-54 in this EPUB)
  40: "Tobit", 41: "Judith", 42: "Esther (Greek)",
  43: "Wisdom of Solomon", 44: "Sirach", 45: "Baruch",
  46: "Letter of Jeremiah", 47: "Azariah and the Three Jews",
  48: "Susanna", 49: "Bel and the Dragon",
  50: "1 Maccabees", 51: "2 Maccabees", 52: "1 Esdras",
  53: "Prayer of Manasseh", 54: "Psalm 151",
  55: "3 Maccabees", 56: "2 Esdras", 57: "4 Maccabees",
  // New Testament (numbered 60+ in NRSVue IDs)
  60: "Matthew", 61: "Mark", 62: "Luke", 63: "John",
  64: "Acts", 65: "Romans", 66: "1 Corinthians", 67: "2 Corinthians",
  68: "Galatians", 69: "Ephesians", 70: "Philippians", 71: "Colossians",
  72: "1 Thessalonians", 73: "2 Thessalonians",
  74: "1 Timothy", 75: "2 Timothy", 76: "Titus", 77: "Philemon",
  78: "Hebrews", 79: "James", 80: "1 Peter", 81: "2 Peter",
  82: "1 John", 83: "2 John", 84: "3 John", 85: "Jude",
  86: "Revelation",
};

export const nrsvueProfile: Profile = {
  name: "nrsvue",
  translation: "NRSVue",
  type: "scripture",

  parse(zip: AdmZip, toc: TocEntry[], spine: EpubSpineEntry[]): TelosDocument[] {
    // Collect all verses across all HTML files, grouped by book+chapter
    const chapterMap = new Map<string, { bookName: string; abbrev: string; chapter: number; blocks: Block[] }>();

    for (const entry of spine) {
      const href = entry.href;
      if (!href.endsWith(".html")) continue;

      const html = zip.getEntry(href)?.getData().toString("utf8") ?? "";
      if (!html) continue;

      const $ = cheerio.load(html);

      // Remove footnote references to get clean text
      $("a.fnref").remove();

      // Find all verse spans
      $("span.ver, span.ver-f").each((_, el) => {
        const id = $(el).attr("id") ?? "";
        // ID format: v[bookNum:2][chapter:3][verse:3]  e.g., v01002001
        const idMatch = id.match(/^v(\d{2})(\d{3})(\d{3})$/);
        if (!idMatch) return;

        const bookNum = parseInt(idMatch[1], 10);
        const chapter = parseInt(idMatch[2], 10);
        const verseNum = parseInt(idMatch[3], 10);

        const bookName = NRSVUE_BOOK_NUMBERS[bookNum];
        if (!bookName) return;

        const abbrev = lookupAbbrev(bookName);
        const key = `${abbrev}-${chapter}`;

        if (!chapterMap.has(key)) {
          chapterMap.set(key, { bookName, abbrev, chapter, blocks: [] });
        }

        // Get the text content from this verse span to the next verse span
        // The verse number span is inline in a paragraph with other verses
        // We need to extract text between this span and the next
        const verseSpan = $(el);
        let text = "";

        // Walk siblings and text nodes after this span until next verse span
        let node = el.nextSibling;
        while (node) {
          if (node.type === "tag") {
            const tagEl = node as cheerio.Element;
            if ($(tagEl).is("span.ver, span.ver-f")) break;
            // Include text from inline elements (like <span class="sm">)
            text += $(tagEl).text();
          } else if (node.type === "text") {
            text += (node as cheerio.Text).data ?? "";
          }
          node = node.nextSibling;
        }

        text = text.replace(/\s+/g, " ").trim();

        if (text) {
          chapterMap.get(key)!.blocks.push({
            block_id: `${abbrev}-${chapter}-${verseNum}`,
            type: "verse",
            number: verseNum,
            text,
          });
        }
      });

      // Extract section headings
      $("p.ah1, p.ahaft1, p.ah2").each((_, el) => {
        const text = $(el).text().trim();
        if (!text) return;

        // Try to associate heading with the next verse's chapter
        const nextVerse = $(el).nextAll("p").find("span.ver, span.ver-f").first();
        const nextId = nextVerse.attr("id") ?? "";
        const m = nextId.match(/^v(\d{2})(\d{3})/);
        if (m) {
          const bookNum = parseInt(m[1], 10);
          const chapter = parseInt(m[2], 10);
          const bookName = NRSVUE_BOOK_NUMBERS[bookNum];
          if (bookName) {
            const abbrev = lookupAbbrev(bookName);
            const key = `${abbrev}-${chapter}`;
            if (!chapterMap.has(key)) {
              chapterMap.set(key, { bookName, abbrev, chapter, blocks: [] });
            }
            chapterMap.get(key)!.blocks.push({
              block_id: `${abbrev}-${chapter}-heading-${text.substring(0, 20).replace(/\s+/g, "-").toLowerCase()}`,
              type: "heading",
              text,
            });
          }
        }
      });
    }

    // Convert to documents, sorted by canonical order
    const documents: TelosDocument[] = [];
    for (const [, data] of chapterMap) {
      // Sort verses by number
      const verses = data.blocks.filter(b => b.type === "verse").sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
      const headings = data.blocks.filter(b => b.type === "heading");

      documents.push({
        document_id: `${data.abbrev}-${data.chapter}`,
        title: `${data.bookName} ${data.chapter}`,
        type: "scripture",
        translation: "NRSVue",
        blocks: [...headings, ...verses],
      });
    }

    return documents;
  },
};
