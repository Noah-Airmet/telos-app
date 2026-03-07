import * as cheerio from "cheerio";
import type { Profile, TelosDocument, Block, TocEntry, EpubSpineEntry } from "../types.js";
import { loadHtml } from "../epub-reader.js";
import type AdmZip from "adm-zip";

// Pearl of Great Price EPUB structure:
//   _01.xhtml = Book of Moses (chapters 1–8)
//   _02.xhtml = Book of Abraham (chapters 1–5 + Facsimile headings)
//   _03.xhtml = JS-Matthew (single chapter)
//   _04.xhtml = JS-History (single chapter)
//   _05.xhtml = Articles of Faith (single chapter)
//
// Verse ID format: <span id="aa{ch}_{v}"> starts a paragraph, <span id="a{ch}_{v}"> is an
// inline verse continuation within the same paragraph. Both "aa" and "a" prefixed IDs are
// real verse numbers and must be emitted as separate verse blocks.
//
// Chapter boundaries are identified by <h3 id="sigil_toc_id_N"> elements, but we rely on
// the chapter number encoded in the span ID itself rather than tracking h3 position.

// Regex: matches aa{ch}_{v} or a{ch}_{v} (single-a only, not aa)
const VERSE_ID_RE = /^(aa?)(\d+)_(\d+)$/;

// Unique delimiter used to split multi-verse paragraphs
const DELIM_PREFIX = "|||VERSE:";
const DELIM_SUFFIX = "|||";
const DELIM_SPLIT_RE = /\|\|\|VERSE:[^|]+\|\|\|/;

interface VerseSpan {
  chapter: number;
  verse: number;
  text: string;
}

/**
 * Parse all verse spans from a Cheerio-loaded document.
 * Returns a map of chapter -> verse spans in DOM order.
 *
 * Strategy: walk every <p> element. For each paragraph, find all verse span IDs in order,
 * then split the paragraph text on those delimiters to extract per-verse text segments.
 */
function extractVersesByChapter($: cheerio.CheerioAPI): Map<number, VerseSpan[]> {
  const byChapter = new Map<number, VerseSpan[]>();

  $("body p").each((_, el) => {
    // Find all verse spans within this paragraph in DOM order
    const spans: Array<{ chap: number; verse: number; id: string }> = [];

    $(el)
      .find("span[id]")
      .each((_, spanEl) => {
        const id = $(spanEl).attr("id") ?? "";
        const m = id.match(VERSE_ID_RE);
        if (!m) return;
        const chap = parseInt(m[2], 10);
        const verse = parseInt(m[3], 10);
        spans.push({ chap, verse, id });
      });

    if (spans.length === 0) return;

    // Clone and clean the paragraph HTML for text extraction:
    // - Remove footnote reference superscripts
    // - Replace each verse span with a unique delimiter token
    const pHtml = $(el).html() ?? "";
    const $p = cheerio.load(`<p>${pHtml}</p>`);

    // Remove footnote sup elements (class="reference") and their anchor wrappers
    $p("sup.reference").each((_, sup) => {
      $p(sup).remove();
    });

    // Replace each verse span with a delimiter so we can split text segments
    $p("span[id]").each((_, s) => {
      const sid = $p(s).attr("id") ?? "";
      if (VERSE_ID_RE.test(sid)) {
        $p(s).replaceWith(`${DELIM_PREFIX}${sid}${DELIM_SUFFIX}`);
      }
    });

    const fullText = $p("p").text();

    // Split on delimiters: parts[0] is before first span (empty or preamble),
    // parts[1] is after first span, parts[2] after second, etc.
    const parts = fullText.split(DELIM_SPLIT_RE);

    spans.forEach((span, i) => {
      const rawText = (parts[i + 1] ?? "").trim();
      if (!rawText) return;

      const { chap, verse } = span;
      if (!byChapter.has(chap)) byChapter.set(chap, []);
      byChapter.get(chap)!.push({ chapter: chap, verse, text: rawText });
    });
  });

  return byChapter;
}

/**
 * Build TelosDocuments from a parsed chapter map.
 */
function buildDocuments(
  byChapter: Map<number, VerseSpan[]>,
  bookKey: string,
  chapterNames: Record<number, string>
): TelosDocument[] {
  const docs: TelosDocument[] = [];

  for (const [chap, verses] of [...byChapter.entries()].sort((a, b) => a[0] - b[0])) {
    const blocks: Block[] = [];
    const seenVerses = new Set<number>();

    for (const vs of verses) {
      if (seenVerses.has(vs.verse)) continue; // deduplicate
      seenVerses.add(vs.verse);
      blocks.push({
        block_id: `${bookKey}-${chap}-${vs.verse}`,
        type: "verse",
        number: vs.verse,
        text: vs.text,
      });
    }

    if (blocks.length === 0) continue;

    docs.push({
      document_id: `${bookKey}-${chap}`,
      title: chapterNames[chap] ?? `${bookKey} ${chap}`,
      type: "scripture",
      translation: "LDS",
      blocks,
    });
  }

  return docs;
}

export const ldsPogpProfile: Profile = {
  name: "lds-pogp",
  translation: "LDS",
  type: "scripture",

  parse(zip: AdmZip, _toc: TocEntry[], _spine: EpubSpineEntry[]): TelosDocument[] {
    const documents: TelosDocument[] = [];

    // --- Book of Moses (_01.xhtml, chapters 1–8) ---
    {
      const $ = loadHtml(zip, "OEBPS/Text/Pearl-of-Great-Price_01.xhtml");
      const byChapter = extractVersesByChapter($);
      // Filter to only chapters 1–8
      const filtered = new Map<number, VerseSpan[]>();
      for (const [ch, vs] of byChapter) {
        if (ch >= 1 && ch <= 8) filtered.set(ch, vs);
      }
      documents.push(
        ...buildDocuments(filtered, "moses", {
          1: "Moses 1",
          2: "Moses 2",
          3: "Moses 3",
          4: "Moses 4",
          5: "Moses 5",
          6: "Moses 6",
          7: "Moses 7",
          8: "Moses 8",
        })
      );
    }

    // --- Book of Abraham (_02.xhtml, chapters 1–5) ---
    {
      const $ = loadHtml(zip, "OEBPS/Text/Pearl-of-Great-Price_02.xhtml");
      const byChapter = extractVersesByChapter($);
      // Filter to chapters 1–5 (exclude facsimile/appendix content)
      const filtered = new Map<number, VerseSpan[]>();
      for (const [ch, vs] of byChapter) {
        if (ch >= 1 && ch <= 5) filtered.set(ch, vs);
      }
      documents.push(
        ...buildDocuments(filtered, "abr", {
          1: "Abraham 1",
          2: "Abraham 2",
          3: "Abraham 3",
          4: "Abraham 4",
          5: "Abraham 5",
        })
      );
    }

    // --- Joseph Smith—Matthew (_03.xhtml, single chapter, IDs: a1_{v}) ---
    {
      const $ = loadHtml(zip, "OEBPS/Text/Pearl-of-Great-Price_03.xhtml");
      const byChapter = extractVersesByChapter($);
      documents.push(
        ...buildDocuments(byChapter, "js-m", {
          1: "Joseph Smith—Matthew 1",
        })
      );
    }

    // --- Joseph Smith—History (_04.xhtml, single chapter, IDs: aa1_{v} and a1_{v}) ---
    {
      const $ = loadHtml(zip, "OEBPS/Text/Pearl-of-Great-Price_04.xhtml");
      const byChapter = extractVersesByChapter($);
      documents.push(
        ...buildDocuments(byChapter, "js-h", {
          1: "Joseph Smith—History 1",
        })
      );
    }

    // --- Articles of Faith (_05.xhtml, single chapter, IDs: a1_{v}) ---
    {
      const $ = loadHtml(zip, "OEBPS/Text/Pearl-of-Great-Price_05.xhtml");
      const byChapter = extractVersesByChapter($);
      documents.push(
        ...buildDocuments(byChapter, "aof", {
          1: "Articles of Faith 1",
        })
      );
    }

    return documents;
  },
};
