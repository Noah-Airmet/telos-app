import * as cheerio from "cheerio";
import type { Profile, TelosDocument, Block, TocEntry, EpubSpineEntry } from "../types.js";
import { loadHtml } from "../epub-reader.js";
import type AdmZip from "adm-zip";

// "How We Got the Doctrine and Covenants" by Turley & Slaughter
// EPUB structure:
//   - 15 content files: OPS/chap_1.xml through OPS/chap_15.xml
//   - p.ChapNo = chapter number label (e.g. "Chapter One") — skip
//   - p.Chapter = chapter title (heading)
//   - p (no class) = regular paragraph
//   - p.Centered = centered text (treat as paragraph)
//   - p.Caption = image caption — skip
//   - p.Heading2 = "Notes" section header — skip
//   - p.Notes = footnote paragraphs — skip
//   - TOC maps chap_N.xml → title, in playOrder 1-15

const TOC_TITLES: Record<string, string> = {
  "chap_1.xml": "Preface",
  "chap_2.xml": "Prologue",
  "chap_3.xml": "The Original Manuscripts",
  "chap_4.xml": "Manuscript Revelation Books",
  "chap_5.xml": "The Evening and the Morning Star",
  "chap_6.xml": "The Book of Commandments, 1833",
  "chap_7.xml": "Evening and Morning Star",
  "chap_8.xml": "The Doctrine and Covenants, 1835",
  "chap_9.xml": "The Doctrine and Covenants, 1844",
  "chap_10.xml": "The Doctrine and Covenants, 1845",
  "chap_11.xml": "The Doctrine and Covenants, 1876",
  "chap_12.xml": "The Doctrine and Covenants, 1879",
  "chap_13.xml": "The Doctrine and Covenants, 1921",
  "chap_14.xml": "The Doctrine and Covenants, 1981",
  "chap_15.xml": "\u201cThe Voice of the Lord Is unto All\u201d",
};

export const turleyDcProfile: Profile = {
  name: "turley-dc",
  translation: "Turley",
  type: "commentary",

  parse(zip: AdmZip, toc: TocEntry[], spine: EpubSpineEntry[]): TelosDocument[] {
    const documents: TelosDocument[] = [];

    for (let n = 1; n <= 15; n++) {
      const filename = `chap_${n}.xml`;
      const href = `OPS/${filename}`;
      const title = TOC_TITLES[filename] ?? `Chapter ${n}`;
      const $ = loadHtml(zip, href);
      const blocks: Block[] = [];
      let blockIndex = 0;

      $("body").children().each((_, el) => {
        const tag = el.type === "tag" ? el.name : null;
        if (tag !== "p") return;

        const cls = $(el).attr("class") ?? "";

        // Chapter title → heading block
        if (cls === "Chapter") {
          const text = $(el).text().trim();
          if (text) {
            blocks.push({
              block_id: `turley-dc-${n}-heading-${blockIndex++}`,
              type: "heading",
              text,
            });
          }
          return;
        }

        // Skip: ChapNo (ordinal label), Heading2 ("Notes"), Notes (footnotes), Caption (image captions)
        if (cls === "ChapNo" || cls === "Heading2" || cls === "Notes" || cls === "Caption") {
          return;
        }

        // Regular paragraphs (no class) and Centered text → paragraph blocks
        if (cls === "" || cls === "Centered") {
          // Skip image-only paragraphs (contain only an img, no text)
          const text = $(el).text().trim();
          if (!text) return;

          // Strip footnote markers (superscript <a> anchors) — keep only prose text
          $(el).find("sup").remove();
          const cleanText = $(el).text().trim();
          if (!cleanText) return;

          blocks.push({
            block_id: `turley-dc-${n}-p-${blockIndex++}`,
            type: "paragraph",
            text: cleanText,
          });
          return;
        }

        // Any other unrecognized class: skip silently
      });

      if (blocks.length > 0) {
        documents.push({
          document_id: `turley-dc-${n}`,
          title,
          type: "commentary",
          translation: "Turley",
          blocks,
        });
      }
    }

    return documents;
  },
};
