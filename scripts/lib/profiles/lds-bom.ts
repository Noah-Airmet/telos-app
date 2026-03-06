import * as cheerio from "cheerio";
import type { Profile, TelosDocument, Block, TocEntry, EpubSpineEntry } from "../types.js";
import { loadHtml } from "../epub-reader.js";
import type AdmZip from "adm-zip";

// The LDS Book of Mormon EPUB has beautifully structured HTML:
//   - Files named like `1-ne_3.xhtml` (book_chapter)
//   - Verses: <p class="verse" id="lds_1-ne_3_7"><span class="verseNumber">7 </span>text</p>
//   - Chapter summaries: <p class="studySummary">...</p>
//   - Chapter title: <p class="titleNumber">Chapter 3</p>
//   - Book header: <p class="runHead">1 Nephi</p>
//   - The IDs already encode the UVID: lds_1-ne_3_7

// Map LDS filename prefixes to their abbreviation
const LDS_BOOK_MAP: Record<string, string> = {
  "1-ne": "1-ne",
  "2-ne": "2-ne",
  "3-ne": "3-ne",
  "4-ne": "4-ne",
  "jacob": "jacob",
  "enos": "enos",
  "jarom": "jarom",
  "omni": "omni",
  "w-of-m": "w-of-m",
  "mosiah": "mosiah",
  "alma": "alma",
  "hel": "hel",
  "morm": "morm",
  "ether": "ether",
  "moro": "moro",
};

const LDS_BOOK_NAMES: Record<string, string> = {
  "1-ne": "1 Nephi",
  "2-ne": "2 Nephi",
  "3-ne": "3 Nephi",
  "4-ne": "4 Nephi",
  "jacob": "Jacob",
  "enos": "Enos",
  "jarom": "Jarom",
  "omni": "Omni",
  "w-of-m": "Words of Mormon",
  "mosiah": "Mosiah",
  "alma": "Alma",
  "hel": "Helaman",
  "morm": "Mormon",
  "ether": "Ether",
  "moro": "Moroni",
};

export const ldsBomProfile: Profile = {
  name: "lds-bom",
  translation: "LDS",
  type: "scripture",

  parse(zip: AdmZip, toc: TocEntry[], spine: EpubSpineEntry[]): TelosDocument[] {
    const documents: TelosDocument[] = [];

    // Process only chapter files (files with underscores like `1-ne_3.xhtml`)
    for (const entry of spine) {
      const filename = entry.href.split("/").pop() ?? "";
      const match = filename.match(/^([a-z0-9-]+)_(\d+)\.xhtml$/);
      if (!match) continue;

      const [, bookPrefix, chapterStr] = match;
      const abbrev = LDS_BOOK_MAP[bookPrefix];
      if (!abbrev) continue;

      const chapter = parseInt(chapterStr, 10);
      const bookName = LDS_BOOK_NAMES[bookPrefix] ?? bookPrefix;
      const $ = loadHtml(zip, entry.href);
      const blocks: Block[] = [];

      // Extract chapter summary
      $(".studySummary").each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          blocks.push({
            block_id: `bom-${abbrev}-${chapter}-summary`,
            type: "summary",
            text,
          });
        }
      });

      // Extract verses
      $(".verse, .verse-first").each((_, el) => {
        const verseNumEl = $(el).find(".verseNumber");
        const verseNum = parseInt(verseNumEl.text().trim(), 10);
        verseNumEl.remove();
        const text = $(el).text().trim();

        if (text && !isNaN(verseNum)) {
          blocks.push({
            block_id: `bom-${abbrev}-${chapter}-${verseNum}`,
            type: "verse",
            number: verseNum,
            text,
          });
        }
      });

      if (blocks.length > 0) {
        documents.push({
          document_id: `bom-${abbrev}-${chapter}`,
          title: `${bookName} ${chapter}`,
          type: "scripture",
          translation: "LDS",
          blocks,
        });
      }
    }

    // Handle single-chapter books (Enos, Jarom, Omni, Words of Mormon, 4 Nephi)
    for (const entry of spine) {
      const filename = entry.href.split("/").pop() ?? "";
      // Match files like `enos.xhtml` (no underscore = single-chapter book)
      const match = filename.match(/^([a-z0-9-]+)\.xhtml$/);
      if (!match) continue;

      const [, bookPrefix] = match;
      const abbrev = LDS_BOOK_MAP[bookPrefix];
      if (!abbrev) continue;

      const bookName = LDS_BOOK_NAMES[bookPrefix] ?? bookPrefix;
      const $ = loadHtml(zip, entry.href);

      // Check if this file actually contains verses (not just a book intro page)
      const verses = $(".verse, .verse-first");
      if (verses.length === 0) continue;

      const blocks: Block[] = [];

      $(".studySummary").each((_, el) => {
        const text = $(el).text().trim();
        if (text) {
          blocks.push({
            block_id: `bom-${abbrev}-1-summary`,
            type: "summary",
            text,
          });
        }
      });

      verses.each((_, el) => {
        const verseNumEl = $(el).find(".verseNumber");
        const verseNum = parseInt(verseNumEl.text().trim(), 10);
        verseNumEl.remove();
        const text = $(el).text().trim();

        if (text && !isNaN(verseNum)) {
          blocks.push({
            block_id: `bom-${abbrev}-1-${verseNum}`,
            type: "verse",
            number: verseNum,
            text,
          });
        }
      });

      if (blocks.length > 0) {
        documents.push({
          document_id: `bom-${abbrev}-1`,
          title: `${bookName} 1`,
          type: "scripture",
          translation: "LDS",
          blocks,
        });
      }
    }

    return documents;
  },
};
