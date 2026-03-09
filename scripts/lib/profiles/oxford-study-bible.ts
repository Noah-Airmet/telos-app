import * as cheerio from "cheerio";
import type { Profile, TelosDocument, Block, TocEntry, EpubSpineEntry } from "../types.js";
import { lookupAbbrev } from "../bible-books.js";
import type AdmZip from "adm-zip";

// The New Oxford Annotated Bible with Apocrypha (5th ed) EPUB:
//   - Spine: 012_part1*.xhtml (OT), 013_part2*.xhtml (Apocrypha), 014_part3*.xhtml (NT)
//   - Verse IDs: <a class="StartVersenum" id="gen1_1"> or <a class="dropcap" id="gen1_1"> — format {bookAbbrev}{chapter}_{verse}
//   - Footnote refs: <a id="r_obso-..." href="#obso-...-note-N"><sup>a</sup></a>
//   - Footnote content: <div class="refnote" id="obso-9780190276072-chapter-X-note-N">

// Oxford book abbrev → canonical (Oxford uses abbrevs like apos, apost, cori, matthew)
const OXFORD_ABBREV: Record<string, string> = {
  gen: "gen", ex: "ex", exod: "ex", lev: "lev", num: "num", deut: "deut",
  josh: "josh", judg: "judg", ruth: "ruth", "1-sam": "1-sam", "2-sam": "2-sam",
  "1-kgs": "1-kgs", "2-kgs": "2-kgs", "1-chr": "1-chr", "2-chr": "2-chr",
  ezra: "ezra", neh: "neh", esth: "esth", job: "job", ps: "ps", prov: "prov",
  eccl: "eccl", song: "song", isa: "isa", jer: "jer", lam: "lam", ezek: "ezek",
  dan: "dan", hos: "hos", joel: "joel", amos: "amos", obad: "obad", jonah: "jonah",
  mic: "mic", nah: "nahum", nahum: "nahum", hab: "hab", zeph: "zeph", hag: "hag",
  zech: "zech", mal: "mal",
  matt: "matt", matthew: "matt", mark: "mark", luke: "luke", john: "john",
  acts: "acts", apos: "acts", apost: "acts",
  rom: "rom", "1-cor": "1-cor", "2-cor": "2-cor", cori: "1-cor", cor1: "1-cor", cor2: "2-cor",
  gal: "gal", eph: "eph", phil: "phil", col: "col",
  "1-thess": "1-thess", "2-thess": "2-thess", onethess: "1-thess", twothess: "2-thess",
  "1-tim": "1-tim", "2-tim": "2-tim", "1tim": "1-tim", "2tim": "2-tim",
  titus: "titus", phlm: "phlm", heb: "heb", jas: "jas",
  "1-pet": "1-pet", "2-pet": "2-pet", "1pet": "1-pet", "2pet": "2-pet",
  "1-jn": "1-jn", "2-jn": "2-jn", "3-jn": "3-jn", "1jn": "1-jn", "2jn": "2-jn", "3jn": "3-jn",
  jude: "jude", rev: "rev",
  tob: "tob", jdt: "jdt", wis: "wis", sir: "sir", bar: "bar", "add-esth": "add-esth",
  "esth-gr": "esth-gr", "let-jer": "let-jer", "pr-azar": "pr-azar", sus: "sus",
  bel: "bel", "1-macc": "1-macc", "2-macc": "2-macc", "1-esd": "1-esd",
  "2-esd": "2-esd", "pr-man": "pr-man", "ps-151": "ps-151",
  "3-macc": "3-macc", "4-macc": "4-macc",
  oneesther: "add-esth", onekin: "1-kgs", twokin: "2-kgs",
  onechron: "1-chr", twochron: "2-chr", onesam: "1-sam", twosam: "2-sam",
};

function normalizeAbbrev(raw: string): string {
  return OXFORD_ABBREV[raw] ?? lookupAbbrev(raw.replace(/-/g, " ")) ?? raw;
}

function parseVerseId(id: string): { book: string; chapter: number; verse: number } | null {
  const m = id.match(/^(.+?)(\d+)_(\d+)$/);
  if (!m) return null;
  const book = normalizeAbbrev(m[1]);
  const chapter = parseInt(m[2], 10);
  const verse = parseInt(m[3], 10);
  return { book, chapter, verse };
}

function extractCanonicalRefFromHref(href: string): { book: string; chapter: number; verse?: number } | null {
  const frag = href.split("#")[1];
  if (!frag) return null;
  const info = parseVerseId(frag);
  return info ? { ...info, verse: info.verse } : null;
}

function parseSectionIntroEssay(zip: AdmZip, href: string, documentId: string, title: string): TelosDocument | null {
  const entry = zip.getEntry(href);
  if (!entry) return null;
  const html = entry.getData().toString("utf8");
  const $ = cheerio.load(html, { xml: true });
  const blocks: Block[] = [];
  $("div.partfm h1.h1ib, div.partfm p.parafl, div.partfm p.para").each((_, el) => {
    const $el = $(el);
    const tag = (el as cheerio.Element).tagName?.toLowerCase();
    const text = $el.text().replace(/\s+/g, " ").trim();
    if (!text) return;
    if (tag === "h1") {
      blocks.push({
        block_id: `${documentId}-heading-${blocks.length}`,
        type: "heading",
        text,
      });
    } else {
      const links: Array<{ href: string; canonical_ref: { book: string; chapter: number; verse?: number } }> = [];
      $el.find("a[href*='#']").each((_, a) => {
        const h = $(a).attr("href") ?? "";
        const ref = extractCanonicalRefFromHref(h);
        if (ref) links.push({ href: h, canonical_ref: ref });
      });
      blocks.push({
        block_id: `${documentId}-para-${blocks.length}`,
        type: "paragraph",
        text,
        ...(links.length > 0 && { compare_unit_ids: links.map((l) => `${l.canonical_ref.book}-${l.canonical_ref.chapter}-${l.canonical_ref.verse ?? ""}`) }),
      });
    }
  });
  if (blocks.length === 0) return null;
  return {
    document_id: documentId,
    title,
    type: "essay",
    translation: "Oxford",
    blocks,
  };
}

function parseGeneralEssaysFile(zip: AdmZip, href: string): TelosDocument[] {
  const entry = zip.getEntry(href);
  if (!entry) return [];
  const html = entry.getData().toString("utf8");
  const $ = cheerio.load(html, { xml: true });
  const documents: TelosDocument[] = [];
  $("div.chapter").each((_, el) => {
    const $chapter = $(el);
    const titleEl = $chapter.find("h1.chaptertitle").first();
    const title = titleEl.find("span.title, span.chaptertitle").text().trim() || titleEl.text().trim();
    if (!title) return;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const documentId = `oxford-essay-${slug}`;
    const blocks: Block[] = [];
    $chapter.find("h1.h1ib, p.parafl, p.para").each((_, child) => {
      const $child = $(child);
      const tag = (child as cheerio.Element).tagName?.toLowerCase();
      const text = $child.text().replace(/\s+/g, " ").trim();
      if (!text) return;
      if (tag === "h1") {
        blocks.push({
          block_id: `${documentId}-heading-${blocks.length}`,
          type: "heading",
          text,
        });
      } else {
        blocks.push({
          block_id: `${documentId}-para-${blocks.length}`,
          type: "paragraph",
          text,
        });
      }
    });
    if (blocks.length > 0) {
      documents.push({
        document_id: documentId,
        title,
        type: "essay",
        translation: "Oxford",
        blocks,
      });
    }
  });
  return documents;
}

function parseFile(
  zip: AdmZip,
  href: string,
  noteIdToText: Map<string, string>
): TelosDocument[] {
  const entry = zip.getEntry(href);
  if (!entry) return [];
  const html = entry.getData().toString("utf8");
  const $ = cheerio.load(html, { xml: true });

  // Extract footnotes before removing
  $("div.refnote").each((_, el) => {
    const id = $(el).attr("id");
    if (!id) return;
    const $el = $(el);
    const clone = $el.clone();
    clone.find("a").first().remove();
    const text = clone.text().replace(/\s+/g, " ").trim();
    if (text) noteIdToText.set(id, text);
  });

  // Extract long verse commentary from h1.h1kj (inside notegroup) before removing
  const h1kjCommentary: Array<{ first: { book: string; chapter: number; verse: number }; last: { book: string; chapter: number; verse: number } | null; text: string }> = [];
  $("h1.h1kj").each((_, el) => {
    const $el = $(el);
    let added = false;
    // Walk contents: each <b> may be followed by a text node (commentary)
    const contents = $el.contents().toArray();
    for (let i = 0; i < contents.length; i++) {
      const node = contents[i];
      if (node.type !== "tag" || (node as cheerio.Element).tagName?.toLowerCase() !== "b") continue;
      const $b = $(node);
      const hrefs: string[] = [];
      $b.find("a[href*='#']").each((_, a) => {
        const h = $(a).attr("href") ?? "";
        const frag = h.split("#")[1];
        if (frag) hrefs.push(frag);
      });
      if (hrefs.length === 0) continue;
      const first = parseVerseId(hrefs[0]);
      const last = parseVerseId(hrefs[hrefs.length - 1]);
      if (!first) continue;
      let text = $b.text().replace(/\s+/g, " ").trim();
      // Commentary often follows </b> as a text node
      let j = i + 1;
      while (j < contents.length) {
        const next = contents[j];
        if (next.type === "text") {
          const t = ((next as cheerio.Text).data ?? "").replace(/\s+/g, " ").trim();
          if (t) text = (text + " " + t).trim();
          j++;
        } else if (next.type === "tag" && (next as cheerio.Element).tagName?.toLowerCase() === "b") {
          break;
        } else {
          j++;
        }
      }
      if (!text) continue;
      h1kjCommentary.push({ first, last: last && last.book === first.book ? last : null, text });
      added = true;
    }
    // Standalone <a> (e.g. "24–25: Cattle...") - direct children of h1 not inside <b>
    if (!added) {
      $el.children("a[href*='#']").each((_, aEl) => {
        const $a = $(aEl);
        const href = $a.attr("href") ?? "";
        const frag = href.split("#")[1];
        const info = frag ? parseVerseId(frag) : null;
        if (!info) return;
        const nextText = ($a[0].nextSibling?.nodeType === 3 ? $a[0].nextSibling.textContent : "")?.replace(/^:\s*/, "").trim() ?? "";
        const fullText = ($a.text() + (nextText ? ": " + nextText : "")).trim();
        if (fullText) {
          h1kjCommentary.push({ first: info, last: info, text: fullText });
          added = true;
        }
      });
    }
    if (!added) {
      const firstLink = $el.find("a[href*='#']").first();
      const href = firstLink.attr("href") ?? "";
      const frag = href.split("#")[1];
      const info = frag ? parseVerseId(frag) : null;
      if (info) {
        const text = $el.text().replace(/\s+/g, " ").trim();
        if (text) h1kjCommentary.push({ first: info, last: info, text });
      }
    }
  });

  $("div.notegroup, div.footnotes, section.footnotes").remove();
  $("span[id^='page_']").remove();

  const chapterBlocks = new Map<string, Block[]>();
  const footnoteRefs: Array<{ book: string; chapter: number; verse: number; noteId: string }> = [];
  let currentBook = "";
  let currentChapter = 0;
  let currentVerseNum = 0;
  let verseTextAccumulator = "";

  function key(b: string, c: number) {
    return `${b}-${c}`;
  }

  function flushVerse() {
    if (!currentBook || currentVerseNum === 0) return;
    const text = verseTextAccumulator.replace(/\s+/g, " ").trim();
    verseTextAccumulator = "";
    if (!text) return;
    const k = key(currentBook, currentChapter);
    if (!chapterBlocks.has(k)) chapterBlocks.set(k, []);
    chapterBlocks.get(k)!.push({
      block_id: `oxford-${currentBook}-${currentChapter}-${currentVerseNum}`,
      type: "verse",
      number: currentVerseNum,
      text,
    });
    currentVerseNum = 0;
  }

  function getVerseFromNode(node: cheerio.AnyNode): { book: string; chapter: number; verse: number } | null {
    if (node.type !== "tag") return null;
    const el = node as cheerio.Element;
    if (el.tagName !== "a") return null;
    const id = $(el).attr("id");
    if (!id) return null;
    return parseVerseId(id);
  }

  function getFootnoteNoteId(node: cheerio.AnyNode): string | null {
    if (node.type !== "tag") return null;
    const el = node as cheerio.Element;
    if (el.tagName !== "a") return null;
    const href = $(el).attr("href") ?? "";
    if (!href.includes("-note-")) return null;
    return href.startsWith("#") ? href.slice(1) : href;
  }

  function processNode(node: cheerio.AnyNode): void {
    if (node.type === "text") {
      const text = (node as cheerio.Text).data ?? "";
      if (currentVerseNum > 0 && currentBook) verseTextAccumulator += text;
      return;
    }

    if (node.type !== "tag") return;
    const el = node as cheerio.Element;
    const tag = el.tagName.toLowerCase();

    // Footnote ref
    const noteId = getFootnoteNoteId(node);
    if (noteId !== null) {
      if (currentBook && currentVerseNum > 0) {
        footnoteRefs.push({ book: currentBook, chapter: currentChapter, verse: currentVerseNum, noteId });
      }
      return;
    }

    // Verse anchor (dropcap or StartVersenum)
    const verseInfo = getVerseFromNode(node);
    if (verseInfo !== null) {
      flushVerse();
      currentBook = verseInfo.book;
      currentChapter = verseInfo.chapter;
      currentVerseNum = verseInfo.verse;
      return;
    }

    if (tag === "sup") {
      for (const child of $(el).contents().toArray()) processNode(child);
      return;
    }

    if (tag === "h1" || tag === "h2" || tag === "h3") {
      const headingText = $(el).text().trim();
      if (headingText && currentBook && !$(el).hasClass("booktitle") && !$(el).hasClass("parttitle")) {
        flushVerse();
        const k = key(currentBook, currentChapter);
        if (!chapterBlocks.has(k)) chapterBlocks.set(k, []);
        chapterBlocks.get(k)!.push({
          block_id: `oxford-${currentBook}-${currentChapter}-heading-${headingText.substring(0, 30).replace(/\s+/g, "-").toLowerCase()}`,
          type: "heading",
          text: headingText,
        });
      }
      return;
    }

    if (tag === "img") return;

    if (tag === "p" || tag === "div") {
      const cls = $(el).attr("class") ?? "";
      if (cls.includes("refnote") || cls.includes("notegroup") || cls.includes("footnotes")) return;
      if (tag === "p" && currentVerseNum > 0 && verseTextAccumulator && !verseTextAccumulator.endsWith(" ")) {
        verseTextAccumulator += " ";
      }
      for (const child of $(el).contents().toArray()) processNode(child);
      if (tag === "p" && currentVerseNum > 0 && verseTextAccumulator && !verseTextAccumulator.endsWith(" ")) {
        verseTextAccumulator += " ";
      }
      return;
    }

    for (const child of $(el).contents().toArray()) processNode(child);
  }

  const body = $("body").first();
  for (const child of body.contents().toArray()) processNode(child);
  flushVerse();

  const bookNames: Record<string, string> = {
    gen: "Genesis", ex: "Exodus", lev: "Leviticus", num: "Numbers", deut: "Deuteronomy",
    josh: "Joshua", judg: "Judges", ruth: "Ruth", "1-sam": "1 Samuel", "2-sam": "2 Samuel",
    "1-kgs": "1 Kings", "2-kgs": "2 Kings", "1-chr": "1 Chronicles", "2-chr": "2 Chronicles",
    ezra: "Ezra", neh: "Nehemiah", esth: "Esther", job: "Job", ps: "Psalms", prov: "Proverbs",
    eccl: "Ecclesiastes", song: "Song of Solomon", isa: "Isaiah", jer: "Jeremiah",
    lam: "Lamentations", ezek: "Ezekiel", dan: "Daniel", hos: "Hosea", joel: "Joel",
    amos: "Amos", obad: "Obadiah", jonah: "Jonah", mic: "Micah", nahum: "Nahum",
    hab: "Habakkuk", zeph: "Zephaniah", hag: "Haggai", zech: "Zechariah", mal: "Malachi",
    matt: "Matthew", mark: "Mark", luke: "Luke", john: "John", acts: "Acts",
    rom: "Romans", "1-cor": "1 Corinthians", "2-cor": "2 Corinthians", gal: "Galatians",
    eph: "Ephesians", phil: "Philippians", col: "Colossians",
    "1-thess": "1 Thessalonians", "2-thess": "2 Thessalonians",
    "1-tim": "1 Timothy", "2-tim": "2 Timothy", titus: "Titus", phlm: "Philemon",
    heb: "Hebrews", jas: "James", "1-pet": "1 Peter", "2-pet": "2 Peter",
    "1-jn": "1 John", "2-jn": "2 John", "3-jn": "3 John", jude: "Jude", rev: "Revelation",
    tob: "Tobit", jdt: "Judith", wis: "Wisdom", sir: "Sirach", bar: "Baruch",
    "add-esth": "Additions to Esther", "esth-gr": "Esther (Greek)", "let-jer": "Letter of Jeremiah",
    "pr-azar": "Prayer of Azariah", sus: "Susanna", bel: "Bel and the Dragon",
    "1-macc": "1 Maccabees", "2-macc": "2 Maccabees", "1-esd": "1 Esdras", "2-esd": "2 Esdras",
    "pr-man": "Prayer of Manasseh", "ps-151": "Psalm 151", "3-macc": "3 Maccabees", "4-macc": "4 Maccabees",
  };

  const documents: TelosDocument[] = [];
  const CANONICAL_ORDER = "gen ex lev num deut josh judg ruth 1-sam 2-sam 1-kgs 2-kgs 1-chr 2-chr ezra neh esth job ps prov eccl song isa jer lam ezek dan hos joel amos obad jonah mic nahum hab zeph hag zech mal matt mark luke john acts rom 1-cor 2-cor gal eph phil col 1-thess 2-thess 1-tim 2-tim titus phlm heb jas 1-pet 2-pet 1-jn 2-jn 3-jn jude rev tob jdt add-esth esth-gr wis sir bar let-jer pr-azar sus bel 1-macc 2-macc 1-esd pr-man ps-151 3-macc 2-esd 4-macc".split(" ");
  const bookOrder = (b: string) => {
    const i = CANONICAL_ORDER.indexOf(b);
    return i >= 0 ? i : 9999;
  };

  const keys = Array.from(chapterBlocks.keys()).sort((a, b) => {
    const lastDashA = a.lastIndexOf("-");
    const bookA = a.slice(0, lastDashA);
    const chA = parseInt(a.slice(lastDashA + 1), 10);
    const lastDashB = b.lastIndexOf("-");
    const bookB = b.slice(0, lastDashB);
    const chB = parseInt(b.slice(lastDashB + 1), 10);
    if (bookA !== bookB) return bookOrder(bookA) - bookOrder(bookB);
    return chA - chB;
  });

  for (const k of keys) {
    const parts = k.split("-");
    const chapter = parseInt(parts[parts.length - 1], 10);
    const book = parts.slice(0, -1).join("-");
    const blocks = chapterBlocks.get(k)!;
    const verses = blocks.filter((b) => b.type === "verse").sort((a, b) => (a.number ?? 0) - (b.number ?? 0));
    const headings = blocks.filter((b) => b.type === "heading");

    const refsForChapter = footnoteRefs.filter((r) => r.book === book && r.chapter === chapter);
    const commentaryByVerse = new Map<number, Block[]>();
    let ci = 0;
    for (const ref of refsForChapter) {
      const text = noteIdToText.get(ref.noteId);
      if (!text) continue;
      ci += 1;
      commentaryByVerse.set(ref.verse, [
        ...(commentaryByVerse.get(ref.verse) ?? []),
        {
          block_id: `oxford-${book}-${chapter}-${ref.verse}-commentary-${ci}`,
          type: "commentary",
          text,
          canonical_ref: { work: "bible", book, chapter, verse: ref.verse },
          verse_start: ref.verse,
          verse_end: ref.verse,
        },
      ]);
    }

    // Add long verse commentary (h1.h1kj) - expand multi-chapter spans
    const maxVerse = verses.length ? Math.max(...verses.map((v) => v.number ?? 0)) : 0;
    const longCommentary: Block[] = [];
    for (const entry of h1kjCommentary) {
      const { first, last, text } = entry;
      if (first.book !== book) continue;
      const lastChap = last?.chapter ?? first.chapter;
      const lastVerse = last?.verse ?? first.verse;
      if (first.chapter > chapter || lastChap < chapter) continue;
      let vs: number, ve: number;
      if (first.chapter === chapter && lastChap === chapter) {
        vs = first.verse;
        ve = lastVerse;
      } else if (first.chapter === chapter) {
        vs = first.verse;
        ve = maxVerse;
      } else if (lastChap === chapter) {
        vs = 1;
        ve = lastVerse;
      } else {
        vs = 1;
        ve = maxVerse;
      }
      ci += 1;
      longCommentary.push({
        block_id: `oxford-${book}-${chapter}-h1kj-${ci}`,
        type: "commentary",
        text,
        canonical_ref: { work: "bible", book, chapter },
        verse_start: vs,
        verse_end: ve,
      });
    }

    const versesWithCommentary: Block[] = [];
    for (const v of verses) {
      versesWithCommentary.push(v);
      versesWithCommentary.push(...(commentaryByVerse.get(v.number ?? 0) ?? []));
      versesWithCommentary.push(...longCommentary.filter((c) => (c.verse_end ?? 0) === (v.number ?? 0)));
    }

    const displayName = bookNames[book] ?? book;
    documents.push({
      document_id: `${book}-${chapter}`,
      title: `${displayName} ${chapter}`,
      type: "study-bible",
      translation: "Oxford",
      blocks: [...headings, ...versesWithCommentary],
    });
  }

  return documents;
}

export const oxfordStudyBibleProfile: Profile = {
  name: "oxford-study-bible",
  translation: "Oxford",
  type: "study-bible",

  parse(zip: AdmZip, _toc: TocEntry[], _spine: EpubSpineEntry[]): TelosDocument[] {
    const noteIdToText = new Map<string, string>();
    const allDocuments: TelosDocument[] = [];
    const seenIds = new Set<string>();

    const partHrefs = zip
      .getEntries()
      .filter((e) => !e.isDirectory && e.entryName.match(/(012_part1|013_part2|014_part3)[a-z0-9]*\.xhtml$/))
      .map((e) => e.entryName)
      .sort();

    const sectionIntroMap: Record<string, { id: string; title: string }> = {
      "012_part1a.xhtml": { id: "oxford-essay-pentateuch", title: "Introduction to the Pentateuch" },
      "012_part1g.xhtml": { id: "oxford-essay-historical-books", title: "Introduction to the Historical Books" },
      "013_part2a.xhtml": { id: "oxford-essay-apocrypha", title: "Introduction to the Apocrypha" },
      "014_part3a.xhtml": { id: "oxford-essay-gospels", title: "Introduction to the Gospels" },
    };

    for (const href of partHrefs) {
      const baseName = href.split("/").pop() ?? href;
      const sectionIntro = sectionIntroMap[baseName];
      if (sectionIntro) {
        const doc = parseSectionIntroEssay(zip, href, sectionIntro.id, sectionIntro.title);
        if (doc && !seenIds.has(doc.document_id)) {
          seenIds.add(doc.document_id);
          allDocuments.push(doc);
        }
        continue;
      }
      const docs = parseFile(zip, href, noteIdToText);
      for (const doc of docs) {
        if (seenIds.has(doc.document_id)) continue;
        seenIds.add(doc.document_id);
        allDocuments.push(doc);
      }
    }

    const part5Entry = zip.getEntries().find((e) => !e.isDirectory && e.entryName.includes("100_part5.xhtml"));
    if (part5Entry) {
      const essays = parseGeneralEssaysFile(zip, part5Entry.entryName);
      for (const doc of essays) {
        if (!seenIds.has(doc.document_id)) {
          seenIds.add(doc.document_id);
          allDocuments.push(doc);
        }
      }
    }

    return allDocuments.sort((a, b) => {
      const [bookA, chA] = [a.document_id.replace(/-(\d+)$/, ""), parseInt(a.document_id.match(/-(\d+)$/)?.[1] ?? "0", 10)];
      const [bookB, chB] = [b.document_id.replace(/-(\d+)$/, ""), parseInt(b.document_id.match(/-(\d+)$/)?.[1] ?? "0", 10)];
      if (bookA !== bookB) return bookA < bookB ? -1 : 1;
      return chA - chB;
    });
  },
};
