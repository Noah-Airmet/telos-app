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
// Derived by inspecting actual verse IDs (v[bookNum:2][chapter:3][verse:3]) in the EPUB.
// NT = 40-66, Deuterocanonical = 67-84. (Previous mapping had these swapped.)
const NRSVUE_BOOK_NUMBERS: Record<number, string> = {
  // Old Testament (01-39)
  1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
  6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
  11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
  15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
  20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Songs", 23: "Isaiah",
  24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
  28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah",
  33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah", 37: "Haggai",
  38: "Zechariah", 39: "Malachi",
  // New Testament (40-66)
  40: "Matthew", 41: "Mark", 42: "Luke", 43: "John",
  44: "Acts", 45: "Romans", 46: "1 Corinthians", 47: "2 Corinthians",
  48: "Galatians", 49: "Ephesians", 50: "Philippians", 51: "Colossians",
  52: "1 Thessalonians", 53: "2 Thessalonians",
  54: "1 Timothy", 55: "2 Timothy", 56: "Titus", 57: "Philemon",
  58: "Hebrews", 59: "James", 60: "1 Peter", 61: "2 Peter",
  62: "1 John", 63: "2 John", 64: "3 John", 65: "Jude",
  66: "Revelation",
  // Deuterocanonical (67-84)
  67: "Tobit", 68: "Judith", 69: "Esther (Greek)",
  70: "Wisdom of Solomon", 71: "Sirach", 72: "Baruch",
  73: "Letter of Jeremiah", 74: "Azariah and the Three Jews",
  75: "Susanna", 76: "Bel and the Dragon",
  77: "1 Maccabees", 78: "2 Maccabees", 79: "1 Esdras",
  80: "Prayer of Manasseh",
  // Book 81 = Psalm 151: EPUB encodes it as bookNum=81, chapter=151
  81: "Psalm 151",
  82: "3 Maccabees", 83: "2 Esdras", 84: "4 Maccabees",
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
        let chapter = parseInt(idMatch[2], 10);
        const verseNum = parseInt(idMatch[3], 10);

        const bookName = NRSVUE_BOOK_NUMBERS[bookNum];
        if (!bookName) return;

        // Psalm 151 is encoded as bookNum=81, chapter=151 in this EPUB.
        // Normalize to chapter=1 so its document_id is "ps-151-1".
        if (bookNum === 81 && chapter === 151) chapter = 1;

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
