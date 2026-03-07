/**
 * Ingestion script for Come, Follow Me 2026 Old Testament PDF.
 * Reads /tmp/cfm2026.txt (pre-extracted via pdftotext) and outputs
 * TelosDocument JSON files to data/cfm-2026/.
 *
 * Usage:
 *   pdftotext new-stuff/2026_come_follow_me_for_home_and_church_old_testament.pdf /tmp/cfm2026.txt
 *   npx tsx scripts/ingest-cfm-pdf.ts
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import type { TelosDocument, Block } from "./lib/types.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PDF_PATH = path.join(
  import.meta.dirname,
  "..",
  "new-stuff",
  "2026_come_follow_me_for_home_and_church_old_testament.pdf"
);
const TXT_PATH = "/tmp/cfm2026.txt";
const OUT_DIR = path.join(import.meta.dirname, "..", "data", "cfm-2026");

// ---------------------------------------------------------------------------
// Step 1: Extract text if needed
// ---------------------------------------------------------------------------

if (!fs.existsSync(TXT_PATH)) {
  console.log("Extracting PDF text via pdftotext...");
  execSync(`pdftotext "${PDF_PATH}" "${TXT_PATH}"`, { stdio: "inherit" });
}

const rawText = fs.readFileSync(TXT_PATH, "utf-8");
const lines = rawText.split("\n");

// ---------------------------------------------------------------------------
// Step 2: Document boundary detection
//
// Real lesson headers are ALL-CAPS lines like:
//   "DECEMBER 29–JANUARY 4: THE FIRST TESTAMENT OF JESUS CHRIST"
//   "JANUARY 5 –11: " THIS IS MY WORK AND MY GLORY ""
//
// Mixed-case running page headers like "June 2 2–28" are noise and must NOT
// be treated as lesson boundaries.
//
// A line is a real lesson header iff:
//   - Every alpha character in it is uppercase
//   - It starts with a month name (all-caps)
//   - It contains a date-range pattern (digits and en-dash)
// ---------------------------------------------------------------------------

type DocType = "intro" | "tkm" | "lesson" | "appendix";

interface DocBoundary {
  lineIndex: number;
  docType: DocType;
  id: string;
  title: string;
}

// Matches ALL-CAPS month at start of line (the real lesson headers)
// e.g. "DECEMBER 29–JANUARY 4:", "JANUARY 5 –11:", "MAY 4 –10:"
const LESSON_HEADER_RE =
  /^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+\d/;

function isAllCaps(s: string): boolean {
  // Every alpha character must be uppercase
  return s === s.toUpperCase();
}

const TKM_RE = /^THOUGHTS TO KEEP IN MIND\s*$/;
const APPENDIX_RE = /^APPENDIX\s+([A-D])\s*$/;

// Known intro article titles (plain-cased, appear after the TOC)
const INTRO_TITLES = [
  { title: "Conversion Is Our Goal", id: "cfm-2026-intro-1" },
  {
    title: "Using Come, Follow Me\u2014For Home and Church",
    id: "cfm-2026-intro-2",
  },
  {
    title: "Ideas to Improve Learning at Home and at Church",
    id: "cfm-2026-intro-3",
  },
];

// Canonical lesson list in calendar order (used to assign stable IDs 1-53)
// Built from the TOC. We'll match detected headers to this list.
const CANONICAL_LESSONS: Array<{ datePrefix: string; scriptureRef: string }> =
  [
    {
      datePrefix: "DECEMBER 29",
      scriptureRef: "Introduction to the Old Testament",
    },
    { datePrefix: "JANUARY 5", scriptureRef: "Moses 1; Abraham 3" },
    {
      datePrefix: "JANUARY 12",
      scriptureRef: "Genesis 1\u20132; Moses 2\u20133; Abraham 4\u20135",
    },
    {
      datePrefix: "JANUARY 19",
      scriptureRef: "Genesis 3\u20134; Moses 4\u20135",
    },
    { datePrefix: "JANUARY 26", scriptureRef: "Genesis 5; Moses 6" },
    { datePrefix: "FEBRUARY 2", scriptureRef: "Moses 7" },
    { datePrefix: "FEBRUARY 9", scriptureRef: "Genesis 6\u201311; Moses 8" },
    {
      datePrefix: "FEBRUARY 16",
      scriptureRef: "Genesis 12\u201317; Abraham 1\u20132",
    },
    { datePrefix: "FEBRUARY 23", scriptureRef: "Genesis 18\u201323" },
    { datePrefix: "MARCH 2", scriptureRef: "Genesis 24\u201333" },
    { datePrefix: "MARCH 9", scriptureRef: "Genesis 37\u201341" },
    { datePrefix: "MARCH 16", scriptureRef: "Genesis 42\u201350" },
    { datePrefix: "MARCH 23", scriptureRef: "Exodus 1\u20136" },
    { datePrefix: "MARCH 30", scriptureRef: "Easter" },
    { datePrefix: "APRIL 6", scriptureRef: "Exodus 7\u201313" },
    { datePrefix: "APRIL 13", scriptureRef: "Exodus 14\u201318" },
    {
      datePrefix: "APRIL 20",
      scriptureRef: "Exodus 19\u201320; 24; 31\u201334",
    },
    {
      datePrefix: "APRIL 27",
      scriptureRef: "Exodus 35\u201340; Leviticus 1; 4; 16; 19",
    },
    {
      datePrefix: "MAY 4",
      scriptureRef: "Numbers 11\u201314; 20\u201324; 27",
    },
    {
      datePrefix: "MAY 11",
      scriptureRef: "Deuteronomy 6\u20138; 15; 18; 29\u201330; 34",
    },
    { datePrefix: "MAY 18", scriptureRef: "Joshua 1\u20138; 23\u201324" },
    {
      datePrefix: "MAY 25",
      scriptureRef: "Judges 2\u20134; 6\u20138; 13\u201316",
    },
    { datePrefix: "JUNE 1", scriptureRef: "Ruth; 1 Samuel 1\u20137" },
    {
      datePrefix: "JUNE 8",
      scriptureRef: "1 Samuel 8\u201310; 13; 15\u201316",
    },
    {
      datePrefix: "JUNE 15",
      scriptureRef: "1 Samuel 17\u201318; 24\u201326; 2 Samuel 5\u20137",
    },
    {
      datePrefix: "JUNE 22",
      scriptureRef: "2 Samuel 11\u201312; 1 Kings 3; 6\u20139; 11",
    },
    {
      datePrefix: "JUNE 29",
      scriptureRef: "1 Kings 12\u201313; 17\u201322",
    },
    { datePrefix: "JULY 6", scriptureRef: "2 Kings 2\u20137" },
    { datePrefix: "JULY 13", scriptureRef: "2 Kings 16\u201325" },
    {
      datePrefix: "JULY 20",
      scriptureRef: "2 Chronicles 14\u201320; 26; 30",
    },
    {
      datePrefix: "JULY 27",
      scriptureRef: "Ezra 1; 3\u20137; Nehemiah 2; 4\u20136; 8",
    },
    { datePrefix: "AUGUST 3", scriptureRef: "Esther" },
    {
      datePrefix: "AUGUST 10",
      scriptureRef: "Job 1\u20133; 12\u201314; 19; 21\u201324; 38\u201340; 42",
    },
    {
      datePrefix: "AUGUST 17",
      scriptureRef: "Psalms 1\u20132; 8; 19\u201333; 40; 46",
    },
    {
      datePrefix: "AUGUST 24",
      scriptureRef: "Psalms 49\u201351; 61\u201366; 69\u201372; 77\u201378; 85\u201386",
    },
    {
      datePrefix: "AUGUST 31",
      scriptureRef:
        "Psalms 102\u2013103; 110; 116\u2013119; 127\u2013128; 135\u2013139; 146\u2013150",
    },
    {
      datePrefix: "SEPTEMBER 7",
      scriptureRef:
        "Proverbs 1\u20134; 15\u201316; 22; 31; Ecclesiastes 1\u20133; 11\u201312",
    },
    { datePrefix: "SEPTEMBER 14", scriptureRef: "Isaiah 1\u201312" },
    {
      datePrefix: "SEPTEMBER 21",
      scriptureRef: "Isaiah 13\u201314; 22; 24\u201330; 35",
    },
    { datePrefix: "SEPTEMBER 28", scriptureRef: "Isaiah 40\u201349" },
    { datePrefix: "OCTOBER 5", scriptureRef: "Isaiah 50\u201357" },
    { datePrefix: "OCTOBER 12", scriptureRef: "Isaiah 58\u201366" },
    {
      datePrefix: "OCTOBER 19",
      scriptureRef: "Jeremiah 1\u20133; 7; 16\u201318; 20",
    },
    {
      datePrefix: "OCTOBER 26",
      scriptureRef:
        "Jeremiah 31\u201333; 36\u201338; Lamentations 1; 3",
    },
    {
      datePrefix: "NOVEMBER 2",
      scriptureRef: "Ezekiel 1\u20133; 33\u201334; 36\u201337; 47",
    },
    { datePrefix: "NOVEMBER 9", scriptureRef: "Daniel 1\u20137" },
    {
      datePrefix: "NOVEMBER 16",
      scriptureRef: "Hosea 1\u20136; 10\u201314; Joel",
    },
    { datePrefix: "NOVEMBER 23", scriptureRef: "Amos; Obadiah; Jonah" },
    {
      datePrefix: "NOVEMBER 30",
      scriptureRef: "Micah; Nahum; Habakkuk; Zephaniah",
    },
    {
      datePrefix: "DECEMBER 7",
      scriptureRef: "Haggai 1\u20132; Zechariah 1\u20134; 7\u201314",
    },
    { datePrefix: "DECEMBER 14", scriptureRef: "Malachi" },
    { datePrefix: "DECEMBER 21", scriptureRef: "Christmas" },
  ];

// Build lookup: normalised date prefix → canonical lesson index (1-based)
const lessonByPrefix = new Map<string, number>();
CANONICAL_LESSONS.forEach((l, idx) => {
  lessonByPrefix.set(l.datePrefix, idx + 1);
});

function normaliseDatePrefix(line: string): string {
  // "JANUARY 5 –11:" → "JANUARY 5"
  // "DECEMBER 29–JANUARY 4:" → "DECEMBER 29"
  // "JULY 6 –12:" → "JULY 6"
  const m = line.match(
    /^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+(\d{1,2})/
  );
  if (!m) return line;
  return `${m[1]} ${m[2]}`;
}

function detectBoundaries(): DocBoundary[] {
  const boundaries: DocBoundary[] = [];
  const introFound = new Set<string>();
  const appendixFound = new Set<string>();
  const lessonsFound = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // ---- Intro articles (plain-cased title lines) ----
    for (const intro of INTRO_TITLES) {
      if (!introFound.has(intro.id) && line === intro.title) {
        // Confirm not in TOC: TOC lines are followed by dotted leaders
        const next = (lines[i + 1] || "").trim();
        if (!next.startsWith(".")) {
          introFound.add(intro.id);
          boundaries.push({
            lineIndex: i,
            docType: "intro",
            id: intro.id,
            title: intro.title,
          });
        }
      }
    }

    // ---- Thoughts to Keep in Mind ----
    if (TKM_RE.test(line)) {
      // Title is on the next non-empty line
      let titleLine = "";
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const t = lines[j].trim();
        if (t) {
          titleLine = t;
          break;
        }
      }
      const tkmN = boundaries.filter((b) => b.docType === "tkm").length + 1;
      boundaries.push({
        lineIndex: i,
        docType: "tkm",
        id: `cfm-2026-tkm-${tkmN}`,
        title: titleLine || `Thoughts to Keep in Mind ${tkmN}`,
      });
    }

    // ---- Weekly lessons — ALL-CAPS headers only ----
    if (LESSON_HEADER_RE.test(line) && isAllCaps(line)) {
      const prefix = normaliseDatePrefix(line);
      const lessonN = lessonByPrefix.get(prefix);
      if (lessonN && !lessonsFound.has(lessonN)) {
        lessonsFound.add(lessonN);
        // Title = date range (clean) + scripture reference from next non-empty line
        const colonIdx = line.indexOf(":");
        const dateRange = colonIdx > 0 ? line.slice(0, colonIdx).trim() : line;
        const cleanDate = smartTitleCase(dateRange);

        // Next non-empty line is the scripture reference
        let scriptureRef = "";
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const t = lines[j].trim();
          if (t) {
            // Use the canonical scripture ref for clean punctuation
            scriptureRef = CANONICAL_LESSONS[lessonN - 1].scriptureRef;
            break;
          }
        }

        const fullTitle = scriptureRef
          ? `${cleanDate}: ${scriptureRef}`
          : cleanDate;

        boundaries.push({
          lineIndex: i,
          docType: "lesson",
          id: `cfm-2026-lesson-${lessonN}`,
          title: fullTitle,
        });
      }
    }

    // ---- Appendixes ----
    const appendixMatch = line.match(APPENDIX_RE);
    if (appendixMatch) {
      const letter = appendixMatch[1].toUpperCase();
      if (!appendixFound.has(letter)) {
        appendixFound.add(letter);
        const n = letter.charCodeAt(0) - "A".charCodeAt(0) + 1;
        // Title is next non-empty line
        let titleLine = "";
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const t = lines[j].trim();
          if (t) {
            titleLine = t;
            break;
          }
        }
        // Collect multi-line title (runs until blank line)
        let fullTitle = "";
        for (let k = i + 1; k < Math.min(i + 6, lines.length); k++) {
          const t = lines[k].trim();
          if (!t) { if (fullTitle) break; continue; }
          fullTitle = fullTitle ? fullTitle + " " + t : t;
        }
        boundaries.push({
          lineIndex: i,
          docType: "appendix",
          id: `cfm-2026-appendix-${n}`,
          title: fullTitle
            ? `Appendix ${letter}: ${fullTitle}`
            : `Appendix ${letter}`,
        });
      }
    }
  }

  // Sort by line index
  boundaries.sort((a, b) => a.lineIndex - b.lineIndex);
  return boundaries;
}

// Convert an all-caps date-range string to title-cased.
// "DECEMBER 29–JANUARY 4" → "December 29–January 4"
// "JANUARY 5 –11" → "January 5–11"
// "AUGUST 31–SEPTEMBER 6" → "August 31–September 6"
function smartTitleCase(s: string): string {
  // Capitalise first letter of each word; leave digits and punctuation alone.
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (ch) => ch.toUpperCase())
    .replace(/\s*–\s*/g, "\u2013"); // normalise space around em-dash
}

// ---------------------------------------------------------------------------
// Step 3: Noise detection
// ---------------------------------------------------------------------------

// Running page-header patterns to skip. These appear as single lines in the
// extracted text at the top or bottom of PDF pages.
const NOISE_PATTERNS: RegExp[] = [
  // Spaced-out running headers (typeset large): "R e ading the Ol d T e s tamen t"
  /^[A-Z] [a-z] /,
  // "OL D T ESTA M E N T" title page variant
  /^OL\s+D\s+T\s+ESTA/,
  // Cover / copyright lines
  /^Come, Follow Me\s*[—\-]/,
  /^Living, Learning, and Teaching the Gospel/,
  /^For Home and Church\s*$/,
  /^Published by\s*$/,
  /^The Church of Jesus Christ/,
  /^Salt Lake City, Utah\s*$/,
  /^© 20\d\d by Intellectual Reserve/,
  /^All rights reserved\./,
  /^Version: /,
  /^PD\d+\s/,
  /^Printed in the United States/,
  /^Comments and corrections/,
  /^ComeFollowMe@/,
  // Running headers (mixed-case date ranges): "Decemb er 29 – J a nuary 4"
  // These are typeset large as page-top headers and have spaced characters.
  /^[A-Z][a-z]+ ?[a-z]+ ?\d+ ?[–\-] ?[A-Z]/,
  // Like "J a nuary 5 –11"
  /^[A-Z] [a-z] [a-z]+ ?\d/,
  // Section running header variants: "USING COME , F OLLOW ME"
  /^USING COME\b/,
  /^IN\s+T\s+RO\s+DUC\s+T/i,
  // Spaced running headers: "In tro ductio n to the Ol d T e s tamen t"
  // These contain a sequence like "tro ductio" or "T e s tamen" — multi-char
  // words broken apart with spaces. Key signal: "tro " or "ductio" or "s tamen".
  /tro ductio|s tamen|T e s t|Ov ervie|B o o k|His to ri|ica l /,
  // Appendix running header in spaced type: "A PPEND I X A"
  /^A PPEND I X/,
  // "T hought s to K eep in Mind" — spaced running header
  /^T hought s to K eep/,
  // TOC entries (dotted leaders)
  /\.{3,}/,
  // Lone page numbers
  /^\d{1,3}$/,
  // Roman numeral page numbers
  /^[ivxlIVXL]{1,5}$/,
  // Image captions
  /^.{5,80}, by [A-Z][a-z]/,
  /^\(detail\)\s*$/,
  // Caption lines: "Birth), by Harry Anderson" or "(The Prophet Isaiah Foretells Christ's"
  /^\w[\w\s]+\), by [A-Z]/,
  /^[A-Z][a-z]+ Writes of /,
  // Running chapter headers with spaces: "M ay 11–17" or "J a nuary 5 –11"
  /^[A-Z] [a-z]+ \d/,
  /^[A-Z] a[ypriulgusn]+ \d/,
  // Form fields in Appendix D
  /^Meeting date:\s*$/,
  /^Conducting \(/,
  /^Opening\s*$/,
  /^Hymn \(optional\):\s*$/,
  /^Prayer:\s*$/,
  // Footnote / endnote sections
  /^Notes\s*$/,
  /^\d+\.\s{1,4}(See |President |Elder |Russell |Dallin |Gordon |Thomas |Brigham |Joseph )/,
  // Activity page labels (coloring pages)
  /^Color the pictures/,
  /^Draw a picture of yourself/,
];

// Additional exact-match noise lines
const NOISE_EXACT = new Set([
  "OLD TESTAMENT 2026",
  "Co n t en ts",
  "Contents",
  "Introductory Materials",
  "Appendixes",
  "iv",
  "iii",
  "ii",
  "i",
  // Activity page labels (coloring/drawing activities)
  "Baptism",
  "The sacrament",
  "The temple",
  // Image description lines
  "Isaiah Writes of Christ's Birth (The Prophet Isaiah Foretells Christ's",
]);

function isNoise(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (NOISE_EXACT.has(t)) return true;
  for (const pat of NOISE_PATTERNS) {
    if (pat.test(t)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Step 4: Block extraction
//
// CFM PDF layout facts (verified by inspection):
//
//  - 2-column layout, column width ~45 chars → lines wrap at ~45-55 chars.
//  - A blank line in the extracted text separates logical "groups" of content.
//  - Within a blank-delimited group, content runs without blanks.
//  - A group can contain:
//      [section heading (1-2 wrapped lines, ends in . or ?)]
//      [body paragraph lines (may be multiple sentences)]
//      [bullet items, each on its own line]
//  - There is NO blank between a heading and its body paragraph — they are
//    in the same group.
//
// Algorithm:
//  1. Strip noise lines (page numbers, running headers, image captions…).
//  2. Split content into blank-delimited groups.
//  3. Within each group, identify if the first complete sentence (ends . ? !)
//     is short (≤ 80 chars after joining wrapped parts) — if so it's a heading.
//     The remainder of the group is a paragraph.
//  4. Bullet-item groups (start with •) are always paragraphs.
//  5. All-caps groups with digits are scripture-reference summaries.
// ---------------------------------------------------------------------------

function extractBlocks(
  startLine: number,
  endLine: number,
  docId: string,
  docType: DocType
): Block[] {
  const blocks: Block[] = [];
  let blockNum = 0;

  function pushBlock(type: Block["type"], text: string) {
    const cleaned = text.replace(/\s+/g, " ").trim();
    if (!cleaned) return;
    if (/^\d{1,3}$/.test(cleaned)) return; // stray page numbers
    blockNum++;
    blocks.push({ block_id: `${docId}-${blockNum}`, type, text: cleaned });
  }

  // --- Pass 1: skip header lines, collect content with blank markers ---
  //
  // Header structure by doc type:
  //   lesson:   [ALL-CAPS header] \n [blank] \n [scripture ref] \n [blank] → skip 2 blanks
  //   tkm:      [THOUGHTS TO KEEP IN MIND] \n [blank] \n [title] \n [body...] → skip 1 blank + title line
  //   intro:    [Title line] \n [blank] \n [content...] → skip 1 blank
  //   appendix: [APPENDIX X] \n [blank] \n [title line] \n [blank] → skip 2 blanks
  //
  // TKM: after 1 blank, the next non-empty line is the title (e.g. "The House of Israel"),
  // then content flows immediately without a second blank. We skip 1 blank + 1 title line.
  const blanksRequired = docType === "lesson" || docType === "appendix" ? 2 : 1;

  let blankCount = 0;
  let pastHeader = false;
  let tkmTitleSkipped = false; // for TKM: skip 1 title line after the first blank

  const raw: Array<string | null> = []; // null = blank separator

  for (let i = startLine; i < endLine; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!pastHeader) {
      if (!trimmed) {
        blankCount++;
      } else if (docType === "tkm" && blankCount >= 1 && !tkmTitleSkipped) {
        // Skip the TKM subtitle/title line (it's already captured as doc title)
        tkmTitleSkipped = true;
        pastHeader = true;
        continue;
      }
      if (blankCount >= blanksRequired) pastHeader = true;
      continue;
    }

    if (!trimmed) {
      if (raw.length > 0 && raw[raw.length - 1] !== null) {
        raw.push(null); // blank separator
      }
      continue;
    }

    if (isNoise(trimmed)) continue;
    raw.push(trimmed);
  }

  // --- Pass 2: split into blank-delimited groups ---
  const groups: string[][] = [];
  let current: string[] = [];

  for (const item of raw) {
    if (item === null) {
      if (current.length > 0) {
        groups.push(current);
        current = [];
      }
    } else {
      current.push(item);
    }
  }
  if (current.length > 0) groups.push(current);

  // Structural section labels that appear as isolated first lines of a group
  // (no terminal punctuation). They are standalone headings, separate from any
  // sub-heading that follows in the same blank-delimited group.
  const SECTION_LABEL_RE = [
    /^Ideas for Learning at Home/,
    /^Ideas for Teaching Children/,
    /^Ideas for (Home|Individual|Family|Church)/,
    /^For (Individuals|Families|Youth|Children|Adults|Parents|Primary|Teachers)/,
    /^Learning at Home/,
    /^Learning at Church/,
  ];

  function isSectionLabel(line: string): boolean {
    return (
      SECTION_LABEL_RE.some((re) => re.test(line)) && !/[.?!]$/.test(line)
    );
  }

  // --- Pass 3: classify and emit each group ---
  function emitGroup(grp: string[]) {
    if (grp.length === 0) return;

    const firstLine = grp[0];

    // Skip footnote / notes / caption blocks
    if (/^\d+\.\s+/.test(firstLine)) return;
    if (/^Notes\s*$/.test(firstLine)) return;
    if (/^[A-Z][^.]{3,60}, by [A-Z]/.test(firstLine)) return;
    if (/^\(The Prophet/.test(firstLine)) return;

    // All-bullet group → single paragraph
    if (grp.every((l) => l.startsWith("•") || l.startsWith("·"))) {
      pushBlock("paragraph", grp.join(" "));
      return;
    }

    // All-caps scripture reference (e.g. "MOSES 1", "GENESIS 1–2; MOSES 2–3")
    const joined = grp.join(" ");
    if (
      /^[A-Z0-9\s:–\-;,()]+$/.test(joined) &&
      joined.length < 80 &&
      /\d/.test(joined) &&
      grp.length <= 3
    ) {
      pushBlock("summary", joined);
      return;
    }

    // If the group starts with a structural section label, emit it as a
    // standalone heading, then process the remaining lines as a new group.
    if (isSectionLabel(firstLine)) {
      pushBlock("heading", firstLine);
      emitGroup(grp.slice(1));
      return;
    }

    // General group: scan for a heading at the start.
    // Join raw lines until we hit a sentence-ending character (. ? !).
    // If the joined text is ≤ 85 chars and not a citation → heading.
    // The remainder is a body paragraph.
    let headingParts: string[] = [];
    let bodyStart = 0;
    let accumulated = "";

    for (let gi = 0; gi < grp.length; gi++) {
      const l = grp[gi];

      // Bullet inside a mixed group → start of body
      if (l.startsWith("•") || l.startsWith("·")) {
        bodyStart = gi;
        break;
      }

      accumulated = accumulated ? accumulated + " " + l : l;

      if (/[.?!]$/.test(accumulated)) {
        if (accumulated.length <= 85 && !isLikelyCitation(accumulated)) {
          headingParts = grp.slice(0, gi + 1);
          bodyStart = gi + 1;
        } else {
          // Long or citation-like first sentence → whole group is paragraph
          bodyStart = 0;
          headingParts = [];
        }
        break;
      }

      // Accumulated too long without a sentence end → paragraph
      if (accumulated.length > 85) {
        bodyStart = 0;
        headingParts = [];
        break;
      }
    }

    // No sentence end found → paragraph
    if (
      headingParts.length === 0 &&
      bodyStart === 0 &&
      !/[.?!]$/.test(accumulated)
    ) {
      pushBlock("paragraph", grp.join(" "));
      return;
    }

    if (headingParts.length > 0) {
      pushBlock("heading", headingParts.join(" ").replace(/\s+/g, " ").trim());
    }

    const bodyLines = grp.slice(bodyStart);
    if (bodyLines.length > 0) {
      pushBlock("paragraph", bodyLines.join(" "));
    }
  }

  for (const group of groups) {
    emitGroup(group);
  }

  return blocks;
}

// Is a short period-ending line likely a citation rather than a heading?
// e.g. "Liahona, Nov. 2023, 98)." or "Gospel Library." or "For more, see…"
function isLikelyCitation(t: string): boolean {
  // Ends with page number in parens
  if (/\d{1,3}\)\.?$/.test(t)) return true;
  // Contains publication / library names
  if (
    /(Liahona|Ensign|Gospel Library|Songbook|Children's Songbook|Friend magazine|Strength of Youth)/i.test(
      t
    )
  )
    return true;
  // Starts with lowercase or open-paren (continuation fragment)
  if (/^[a-z(]/.test(t)) return true;
  // Ends with closing paren after a reference
  if (/\d+\.\d*\)/.test(t)) return true;
  // "For more, see…" reference lines
  if (/^For more, see/.test(t)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Step 5: Assemble and write documents
// ---------------------------------------------------------------------------

fs.mkdirSync(OUT_DIR, { recursive: true });

// Remove any old files first so a clean run replaces everything
for (const f of fs.readdirSync(OUT_DIR)) {
  if (f.endsWith(".json")) fs.unlinkSync(path.join(OUT_DIR, f));
}

const boundaries = detectBoundaries();
console.log(`Detected ${boundaries.length} document boundaries.\n`);

let written = 0;
let skipped = 0;

for (let i = 0; i < boundaries.length; i++) {
  const b = boundaries[i];
  const endLine =
    i + 1 < boundaries.length ? boundaries[i + 1].lineIndex : lines.length;

  const blocks = extractBlocks(b.lineIndex, endLine, b.id, b.docType);

  if (blocks.length === 0) {
    console.log(`  [SKIP] ${b.id.padEnd(28)} (0 blocks)`);
    skipped++;
    continue;
  }

  const doc: TelosDocument = {
    document_id: b.id,
    title: b.title,
    type: "commentary",
    translation: "CFM 2026",
    blocks,
  };

  const outPath = path.join(OUT_DIR, `${b.id}.json`);
  fs.writeFileSync(outPath, JSON.stringify(doc, null, 2));
  written++;

  const typeTag = b.docType.padEnd(8);
  console.log(
    `  [${typeTag}] ${b.id.padEnd(30)} ${String(blocks.length).padStart(3)} blocks  "${b.title.slice(0, 65)}"`
  );
}

console.log(`\nDone. Wrote ${written} documents (skipped ${skipped}) to ${OUT_DIR}`);
