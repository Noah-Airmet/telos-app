import * as cheerio from "cheerio";
import type { Profile, TelosDocument, Block, TocEntry, EpubSpineEntry } from "../types.js";
import { lookupAbbrev } from "../bible-books.js";
import type AdmZip from "adm-zip";

// The Jewish Study Bible (Oxford, 2nd Edition) EPUB:
//   - 50 spine chapter files (016_chapter1.xhtml through 058_chapter39.xhtml for biblical text)
//     Plus part dividers (015, 021, 031, 044, 048, 058_part4) and essays (059+) — skip these.
//   - Each chapter file = ONE ENTIRE BIBLICAL BOOK (one file = Genesis, etc.)
//   - Chapter boundaries: <span id="obso-...-chapter-{book_seq}-dropcap-{ch_num}"/>
//     followed by <span class="dropcap">{ch_num}</span>
//   - Verse numbers: <sup><span class="StartVersenum">{v_num}</span></sup>
//     sometimes wrapped in <a> anchors, sometimes bare
//   - Footnote markers: <sup>*</sup> or <sup><i>-a</i></sup> — strip these
//   - Poetry: <p class="line"> (still contains StartVersenum spans)
//   - Book title: <h1 class="chaptertitle"><a><span class="title">Hebrew English</span></a></h1>

// Map from book title text (English portion extracted from bilingual heading) → canonical abbrev
// We handle the The Song of Songs → song, and strip "The " prefix variants.
const TITLE_TO_ABBREV: Record<string, string> = {
  "Genesis": "gen",
  "Exodus": "exod",
  "Leviticus": "lev",
  "Numbers": "num",
  "Deuteronomy": "deut",
  "Joshua": "josh",
  "Judges": "judg",
  "1 Samuel": "1-sam",
  "2 Samuel": "2-sam",
  "1 Kings": "1-kgs",
  "2 Kings": "2-kgs",
  "Isaiah": "isa",
  "Jeremiah": "jer",
  "Ezekiel": "ezek",
  "Hosea": "hos",
  "Joel": "joel",
  "Amos": "amos",
  "Obadiah": "obad",
  "Jonah": "jonah",
  "Micah": "mic",
  "Nahum": "nah",
  "Habakkuk": "hab",
  "Zephaniah": "zeph",
  "Haggai": "hag",
  "Zechariah": "zech",
  "Malachi": "mal",
  "Psalms": "ps",
  "Proverbs": "prov",
  "Job": "job",
  "The Song of Songs": "song",
  "Song of Songs": "song",
  "Ruth": "ruth",
  "Lamentations": "lam",
  "Ecclesiastes": "eccl",
  "Esther": "esth",
  "Daniel": "dan",
  "Ezra": "ezra",
  "Nehemiah": "neh",
  "1 Chronicles": "1-chr",
  "2 Chronicles": "2-chr",
};

// Human-readable book names for document titles
const ABBREV_TO_DISPLAY: Record<string, string> = {
  "gen": "Genesis", "exod": "Exodus", "lev": "Leviticus", "num": "Numbers",
  "deut": "Deuteronomy", "josh": "Joshua", "judg": "Judges",
  "1-sam": "1 Samuel", "2-sam": "2 Samuel", "1-kgs": "1 Kings", "2-kgs": "2 Kings",
  "isa": "Isaiah", "jer": "Jeremiah", "ezek": "Ezekiel",
  "hos": "Hosea", "joel": "Joel", "amos": "Amos", "obad": "Obadiah",
  "jonah": "Jonah", "mic": "Micah", "nah": "Nahum", "hab": "Habakkuk",
  "zeph": "Zephaniah", "hag": "Haggai", "zech": "Zechariah", "mal": "Malachi",
  "ps": "Psalms", "prov": "Proverbs", "job": "Job", "song": "Song of Songs",
  "ruth": "Ruth", "lam": "Lamentations", "eccl": "Ecclesiastes",
  "esth": "Esther", "dan": "Daniel", "ezra": "Ezra", "neh": "Nehemiah",
  "1-chr": "1 Chronicles", "2-chr": "2 Chronicles",
};

// Biblical chapter files to process — only the 39 OT books (skip part dividers and essays)
const CHAPTER_FILES = [
  // Torah
  "016_chapter1.xhtml",  // Genesis
  "017_chapter2.xhtml",  // Exodus
  "018_chapter3.xhtml",  // Leviticus
  "019_chapter4.xhtml",  // Numbers
  "020_chapter5.xhtml",  // Deuteronomy
  // Nevi'im (Prophets)
  "022_chapter6.xhtml",  // Joshua
  "023_chapter7.xhtml",  // Judges
  "024_chapter8.xhtml",  // 1 Samuel
  "025_chapter9.xhtml",  // 2 Samuel
  "026_chapter10.xhtml", // 1 Kings
  "027_chapter11.xhtml", // 2 Kings
  "028_chapter12.xhtml", // Isaiah
  "029_chapter13.xhtml", // Jeremiah
  "030_chapter14.xhtml", // Ezekiel
  // The Twelve (minor prophets)
  "032_chapter15.xhtml", // Hosea
  "033_chapter16.xhtml", // Joel
  "034_chapter17.xhtml", // Amos
  "035_chapter18.xhtml", // Obadiah
  "036_chapter19.xhtml", // Jonah
  "037_chapter20.xhtml", // Micah
  "038_chapter21.xhtml", // Nahum
  "039_chapter22.xhtml", // Habakkuk
  "040_chapter23.xhtml", // Zephaniah
  "041_chapter24.xhtml", // Haggai
  "042_chapter25.xhtml", // Zechariah
  "043_chapter26.xhtml", // Malachi
  // Kethuvim (Writings)
  "045_chapter27.xhtml", // Psalms
  "046_chapter28.xhtml", // Proverbs
  "047_chapter29.xhtml", // Job
  // Five Megillot
  "049_chapter30.xhtml", // Song of Songs
  "050_chapter31.xhtml", // Ruth
  "051_chapter32.xhtml", // Lamentations
  "052_chapter33.xhtml", // Ecclesiastes
  "053_chapter34.xhtml", // Esther
  // Remaining Kethuvim
  "054_chapter35.xhtml", // Daniel
  "055_chapter36.xhtml", // Ezra
  "056_chapter37.xhtml", // Nehemiah
  "057_chapter38.xhtml", // 1 Chronicles
  "058_chapter39.xhtml", // 2 Chronicles
];

/**
 * Extract the English book name from the bilingual chaptertitle span.
 * The span content is like: "בראשית <br/> Genesis" or "שיר השירים<br/> The Song of Songs"
 * We grab the portion after the <br/> (or after the Hebrew text) and strip whitespace.
 */
function extractEnglishTitle($: cheerio.CheerioAPI): string {
  const titleSpan = $("h1.chaptertitle span.title");
  if (!titleSpan.length) return "";
  // Get the raw HTML of the span to find English after <br/>
  const html = titleSpan.html() ?? "";
  // Split on <br> variants
  const parts = html.split(/<br\s*\/?>/i);
  if (parts.length >= 2) {
    // Strip tags from the last part (the English)
    return parts[parts.length - 1].replace(/<[^>]+>/g, "").trim();
  }
  // Fallback: get full text and try to extract ASCII portion
  const full = titleSpan.text();
  const asciiMatch = full.match(/[A-Za-z].+/);
  return asciiMatch ? asciiMatch[0].trim() : full.trim();
}

/**
 * Parse a single chapter file (which contains one entire biblical book).
 * Returns TelosDocuments — one per biblical chapter.
 */
function parseBookFile(zip: AdmZip, href: string): TelosDocument[] {
  const entry = zip.getEntry(href);
  if (!entry) return [];
  const html = entry.getData().toString("utf8");
  // Must use xml:true because this is XHTML with self-closing <span/> elements.
  // Without xml:true, cheerio (HTML mode) treats <span id="page_7"/> as an open tag,
  // nesting all subsequent content inside it, breaking the DOM walk.
  const $ = cheerio.load(html, { xml: true });

  // Get book identity
  const englishTitle = extractEnglishTitle($);
  const abbrev = TITLE_TO_ABBREV[englishTitle] ?? lookupAbbrev(englishTitle);
  const displayName = ABBREV_TO_DISPLAY[abbrev] ?? englishTitle;

  // Extract footnotes BEFORE removing — build noteId -> text map
  const noteIdToText = new Map<string, string>();
  $("div.notegroup p.refnote, div.footnotes p.refnote, section.footnotes p.refnote").each((_, el) => {
    const id = $(el).attr("id");
    if (!id) return;
    // Strip label/marker from text: <a><span class="label">*</span></a> followed by actual note
    const $el = $(el);
    const clone = $el.clone();
    clone.find("a").first().remove(); // Remove the back-link
    const text = clone.text().replace(/\s+/g, " ").trim();
    if (text) noteIdToText.set(id, text);
  });

  // Remove chapterfrontmatter (book intro — skip for now)
  $("div.chapterfrontmatter").remove();

  // Remove the droptoc nav div
  $("div.droptoc").remove();

  // Remove footnote/notegroup sections (after extracting)
  $("div.notegroup, div.footnotes, section.footnotes").remove();

  // Remove page number spans
  $("span[id^='page_']").remove();

  // We parse the HTML linearly to track chapters and verses.
  // Strategy: process the body HTML as a string, splitting on dropcap spans and verse spans.
  //
  // Chapter boundary: <span id="obso-...-dropcap-{N}"/>
  //   followed somewhere by <span class="dropcap">{N}</span>
  //   We use the dropcap-N in the id to know which biblical chapter we're entering.
  //
  // Verse marker: <sup><span class="StartVersenum">{V}</span></sup>
  //   (sometimes inside an <a>, sometimes bare)

  // Collect all chapter data: Map<chapterNum, Block[]>
  const chapterBlocks = new Map<number, Block[]>();
  const footnoteRefs: Array<{ chapter: number; verse: number; noteId: string }> = [];
  let currentChapter = 0;
  let currentVerseNum = 0;
  let verseTextAccumulator = "";
  let headingAccumulator = "";

  function flushVerse() {
    if (currentChapter === 0 || currentVerseNum === 0) return;
    const text = verseTextAccumulator.replace(/\s+/g, " ").trim();
    verseTextAccumulator = "";
    if (!text) return;
    if (!chapterBlocks.has(currentChapter)) chapterBlocks.set(currentChapter, []);
    chapterBlocks.get(currentChapter)!.push({
      block_id: `jsb-${abbrev}-${currentChapter}-${currentVerseNum}`,
      type: "verse",
      number: currentVerseNum,
      text,
    });
    currentVerseNum = 0;
  }

  function flushHeading(text: string) {
    if (currentChapter === 0) return;
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    if (!chapterBlocks.has(currentChapter)) chapterBlocks.set(currentChapter, []);
    const existing = chapterBlocks.get(currentChapter)!;
    existing.push({
      block_id: `jsb-${abbrev}-${currentChapter}-heading-${existing.length}`,
      type: "heading",
      text: cleaned,
    });
  }

  // Walk the DOM nodes of the body in document order
  // We need a flat traversal. Use cheerio's each on all body descendants.
  // But cheerio processes them in nested order. Instead, work with the body's children
  // recursively, treating the document as a token stream.

  function getTextOfNode(node: cheerio.AnyNode): string {
    if (node.type === "text") {
      return (node as cheerio.Text).data ?? "";
    }
    if (node.type === "tag") {
      const el = node as cheerio.Element;
      return $(el).children().toArray().map(getTextOfNode).join("");
    }
    return "";
  }

  // Is this node a dropcap span (chapter boundary)?
  // <span id="obso-...-dropcap-N"/>
  function getDropcapChapter(node: cheerio.AnyNode): number | null {
    if (node.type !== "tag") return null;
    const el = node as cheerio.Element;
    if (el.tagName !== "span") return null;
    const id = $(el).attr("id") ?? "";
    const m = id.match(/chapter-\d+-dropcap-(\d+)$/);
    if (m) return parseInt(m[1], 10);
    return null;
  }

  // Is this node a dropcap text span (the visual large chapter number)?
  function isDropcapText(node: cheerio.AnyNode): boolean {
    if (node.type !== "tag") return false;
    const el = node as cheerio.Element;
    return el.tagName === "span" && $(el).hasClass("dropcap");
  }

  // Is this a footnote anchor (links to a note)? Returns the note ID (without #) or null.
  function getFootnoteNoteId(node: cheerio.AnyNode): string | null {
    if (node.type !== "tag") return null;
    const el = node as cheerio.Element;
    if (el.tagName !== "a") return null;
    const href = $(el).attr("href") ?? "";
    if (!href.includes("-note-")) return null;
    return href.startsWith("#") ? href.slice(1) : href;
  }

  // Is this a StartVersenum element? Returns verse number or null.
  function getVerseNum(node: cheerio.AnyNode): number | null {
    if (node.type !== "tag") return null;
    const el = node as cheerio.Element;
    // Pattern: <sup><span class="StartVersenum">N</span></sup>
    if (el.tagName === "sup") {
      const child = $(el).children("span.StartVersenum").first();
      if (child.length) {
        const n = parseInt(child.text().trim(), 10);
        if (!isNaN(n)) return n;
      }
    }
    return null;
  }

  // Is this an <a> that wraps only a verse number (not a footnote ref)?
  // <a href="#obso-...-verse-..." id="r_obso-...-verse-..."><sup><span class="StartVersenum">N</span></sup></a>
  function getWrappedVerseNum(node: cheerio.AnyNode): number | null {
    if (node.type !== "tag") return null;
    const el = node as cheerio.Element;
    if (el.tagName !== "a") return null;
    const href = $(el).attr("href") ?? "";
    if (!href.includes("-verse-")) return null;
    // Check it contains a StartVersenum
    const sup = $(el).children("sup").first();
    if (!sup.length) return null;
    const child = sup.children("span.StartVersenum").first();
    if (!child.length) return null;
    const n = parseInt(child.text().trim(), 10);
    return isNaN(n) ? null : n;
  }

  // Recursively process a DOM node, accumulating verse text
  // Returns text contribution from this node (for inline content)
  function processNode(node: cheerio.AnyNode): void {
    if (node.type === "text") {
      const text = (node as cheerio.Text).data ?? "";
      if (currentVerseNum > 0 && currentChapter > 0) {
        verseTextAccumulator += text;
      }
      return;
    }

    if (node.type !== "tag") return;
    const el = node as cheerio.Element;
    const tag = el.tagName.toLowerCase();

    // Skip chapterfrontmatter, droptoc, footnote sections
    const cls = $(el).attr("class") ?? "";
    if (cls === "chapterfrontmatter" || cls === "droptoc") return;

    // Check if this is a dropcap span (chapter boundary marker)
    const dropcapChNum = getDropcapChapter(node);
    if (dropcapChNum !== null) {
      // Flush current verse before switching chapters
      flushVerse();
      currentChapter = dropcapChNum;
      currentVerseNum = 0;
      verseTextAccumulator = "";
      return;
    }

    // Skip dropcap text spans (the large visual chapter number)
    if (isDropcapText(node)) return;

    // Footnote ref anchors: record for commentary blocks, then skip
    const noteId = getFootnoteNoteId(node);
    if (noteId !== null) {
      if (currentChapter > 0 && currentVerseNum > 0) {
        footnoteRefs.push({ chapter: currentChapter, verse: currentVerseNum, noteId });
      }
      return;
    }

    // Check if this is an anchor wrapping a verse number
    const wrappedVerse = getWrappedVerseNum(node);
    if (wrappedVerse !== null) {
      flushVerse();
      currentVerseNum = wrappedVerse;
      return;
    }

    // Check if this is a bare <sup><span class="StartVersenum"> verse marker
    if (tag === "sup") {
      const verseNum = getVerseNum(node);
      if (verseNum !== null) {
        flushVerse();
        currentVerseNum = verseNum;
        return;
      }
      // Non-verse sup (footnote marker like <sup>*</sup> or <sup><i>-a</i></sup>)
      // Strip it — don't recurse into it
      return;
    }

    // Block-level elements: headings become heading blocks
    if (tag === "h2" || tag === "h3") {
      flushVerse();
      const headingText = $(el).text().trim();
      if (headingText) flushHeading(headingText);
      return;
    }

    // Skip empty h1 headings used as structural dividers
    if (tag === "h1") {
      // Only emit if it has real content (not the chaptertitle we already processed)
      // and not the empty structural dividers
      const headingText = $(el).text().trim();
      const cls = $(el).attr("class") ?? "";
      if (headingText && cls !== "chaptertitle" && cls !== "chaptertitle1" && cls !== "chaptertitles") {
        flushVerse();
        flushHeading(headingText);
      }
      return;
    }

    // Images: skip
    if (tag === "img") return;

    // For block elements (p, div), process children
    if (tag === "p" || tag === "div") {
      // Add a space between paragraphs when accumulating verse text
      if (tag === "p" && currentVerseNum > 0 && verseTextAccumulator && !verseTextAccumulator.endsWith(" ")) {
        verseTextAccumulator += " ";
      }
      for (const child of $(el).contents().toArray()) {
        processNode(child);
      }
      // Add trailing space after paragraph for word boundary
      if (tag === "p" && currentVerseNum > 0 && verseTextAccumulator && !verseTextAccumulator.endsWith(" ")) {
        verseTextAccumulator += " ";
      }
      return;
    }

    // Inline elements: recurse into children and collect text
    for (const child of $(el).contents().toArray()) {
      processNode(child);
    }
  }

  // Process all body children
  const body = $("body").first();
  for (const child of body.contents().toArray()) {
    processNode(child);
  }

  // Flush the last verse
  flushVerse();

  // Build TelosDocuments, one per biblical chapter
  const documents: TelosDocument[] = [];
  const chapterNums = Array.from(chapterBlocks.keys()).sort((a, b) => a - b);

  for (const chNum of chapterNums) {
    const blocks = chapterBlocks.get(chNum)!;
    // Only emit chapters that have at least one verse
    const hasVerses = blocks.some(b => b.type === "verse");
    if (!hasVerses) continue;

    // Sort: headings before verses, verses sorted by number
    const headings = blocks.filter(b => b.type === "heading");
    const verses = blocks.filter(b => b.type === "verse").sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

    // Build commentary blocks from footnote refs for this chapter
    const refsForChapter = footnoteRefs.filter((r) => r.chapter === chNum);
    const commentaryByVerse = new Map<number, Block[]>();
    let commentaryIndex = 0;
    for (const ref of refsForChapter) {
      const text = noteIdToText.get(ref.noteId);
      if (!text) continue;
      commentaryIndex += 1;
      const commBlock: Block = {
        block_id: `jsb-${abbrev}-${chNum}-${ref.verse}-commentary-${commentaryIndex}`,
        type: "commentary",
        text,
        canonical_ref: { work: "bible", book: abbrev, chapter: chNum, verse: ref.verse },
        verse_start: ref.verse,
        verse_end: ref.verse,
      };
      const list = commentaryByVerse.get(ref.verse) ?? [];
      list.push(commBlock);
      commentaryByVerse.set(ref.verse, list);
    }

    // Interleave: for each verse, [verse, ...commentary for that verse]
    const versesWithCommentary: Block[] = [];
    for (const verse of verses) {
      versesWithCommentary.push(verse);
      const comm = commentaryByVerse.get(verse.number ?? 0) ?? [];
      versesWithCommentary.push(...comm);
    }

    documents.push({
      document_id: `${abbrev}-${chNum}`,
      title: `${displayName} ${chNum}`,
      type: "study-bible",
      translation: "NJPS",
      blocks: [...headings, ...versesWithCommentary],
    });
  }

  return documents;
}

export const jsbProfile: Profile = {
  name: "jsb",
  translation: "NJPS",
  type: "study-bible",

  parse(zip: AdmZip, _toc: TocEntry[], _spine: EpubSpineEntry[]): TelosDocument[] {
    const allDocuments: TelosDocument[] = [];

    for (const filename of CHAPTER_FILES) {
      const href = "OEBPS/" + filename;
      const docs = parseBookFile(zip, href);
      allDocuments.push(...docs);
    }

    return allDocuments;
  },
};
