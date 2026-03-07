/**
 * Telos EPUB Inspector
 * ====================
 * Run this BEFORE writing a profile for a new EPUB.
 * It dumps the structural information an AI agent (or human) needs to write
 * an accurate parser: TOC entries, spine files, heading classes, verse ID patterns,
 * and first-verse text for each detected book.
 *
 * Usage:
 *   npx tsx scripts/inspect-epub.ts <epub-file>
 *
 * Output: a structured report to stdout. Redirect to a file and paste into
 * Claude/Gemini to generate a profile automatically.
 */

import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import { readEpub } from "./lib/epub-reader.js";
import path from "path";

const epubPath = process.argv[2];
if (!epubPath) {
  console.error("Usage: npx tsx scripts/inspect-epub.ts <epub-file>");
  process.exit(1);
}

const epub = readEpub(epubPath);
const { zip, toc, spine } = epub;

console.log("=".repeat(60));
console.log("EPUB INSPECTION REPORT");
console.log(`File:    ${path.basename(epubPath)}`);
console.log(`Title:   ${epub.title}`);
console.log(`Spine:   ${spine.length} entries`);
console.log(`TOC:     ${toc.length} entries`);
console.log("=".repeat(60));

// ── TOC (top-level entries only, book boundaries) ─────────────────────────
console.log("\n── TOC (top-level entries, no fragment anchors) ──");
const topLevelToc = toc.filter(e => !e.src.includes("#"));
for (const entry of topLevelToc) {
  const file = entry.src.split("/").pop() ?? entry.src;
  console.log(`  ${entry.label.substring(0, 50).padEnd(50)} → ${file}`);
}

// ── Spine files ───────────────────────────────────────────────────────────
console.log("\n── Spine files ──");
for (const entry of spine) {
  console.log(`  ${entry.href}`);
}

// ── Heading classes encountered ───────────────────────────────────────────
console.log("\n── All heading tag+class combinations in EPUB ──");
const headingCombos = new Set<string>();
for (const entry of spine) {
  const html = zip.getEntry(entry.href)?.getData().toString("utf8") ?? "";
  if (!html) continue;
  const $ = cheerio.load(html);
  $("h1, h2, h3, h4").each((_, el) => {
    const cls = (el as cheerio.Element).attribs?.class ?? "(none)";
    headingCombos.add(`${el.tagName}.${cls}`);
  });
}
for (const c of [...headingCombos].sort()) console.log(`  ${c}`);

// ── Verse ID pattern detection ────────────────────────────────────────────
console.log("\n── Verse ID patterns (first 20 unique id= values on span/p/div) ──");
const verseIdSamples = new Set<string>();
const verseTextSamples: Array<{ id: string; text: string; file: string }> = [];

for (const entry of spine) {
  if (verseIdSamples.size >= 20 && verseTextSamples.length >= 10) break;
  const html = zip.getEntry(entry.href)?.getData().toString("utf8") ?? "";
  if (!html) continue;
  const $ = cheerio.load(html);
  $("[id]").each((_, el) => {
    const id = (el as cheerio.Element).attribs?.id ?? "";
    if (!id || verseIdSamples.has(id)) return;
    // Only IDs that look like verse markers (contain numbers)
    if (/\d/.test(id)) {
      verseIdSamples.add(id);
      if (verseTextSamples.length < 10) {
        const text = $(el).text().trim().substring(0, 60);
        if (text) verseTextSamples.push({ id, text, file: entry.href.split("/").pop()! });
      }
    }
  });
}
for (const s of verseTextSamples) {
  console.log(`  id="${s.id}" in ${s.file}: "${s.text}"`);
}

// ── CSS classes on paragraph elements ────────────────────────────────────
console.log("\n── Paragraph CSS classes ──");
const paraCombos = new Map<string, number>(); // class → count
for (const entry of spine.slice(0, 10)) { // sample first 10 files
  const html = zip.getEntry(entry.href)?.getData().toString("utf8") ?? "";
  if (!html) continue;
  const $ = cheerio.load(html);
  $("p").each((_, el) => {
    const cls = (el as cheerio.Element).attribs?.class ?? "(none)";
    paraCombos.set(cls, (paraCombos.get(cls) ?? 0) + 1);
  });
}
const sortedParas = [...paraCombos.entries()].sort((a, b) => b[1] - a[1]);
for (const [cls, count] of sortedParas.slice(0, 20)) {
  console.log(`  p.${cls.padEnd(20)} × ${count}`);
}

// ── Book detection: first verse text per unique pattern ───────────────────
// Try common NRSVue-style verse IDs: v[bookNum:2][chapter:3][verse:3]
console.log("\n── NRSVue-style verse ID book mapping (if applicable) ──");
const nrsvueBooks = new Map<string, { text: string; ch: number }>();
for (const entry of spine) {
  const html = zip.getEntry(entry.href)?.getData().toString("utf8") ?? "";
  if (!html) continue;
  const $ = cheerio.load(html);
  $("a.fnref").remove();
  $("[id]").each((_, el) => {
    const id = (el as cheerio.Element).attribs?.id ?? "";
    const m = id.match(/^v(\d{2})(\d{3})(\d{3})$/);
    if (!m) return;
    const bookNum = m[1];
    const chapter = parseInt(m[2], 10);
    const verse = parseInt(m[3], 10);
    if (verse !== 1 || nrsvueBooks.has(bookNum)) return;
    // Collect text after this element
    let text = "";
    let node = el.nextSibling;
    while (node && text.length < 80) {
      if (node.type === "tag") {
        const t = node as cheerio.Element;
        if ($(t).is("[id]")) break;
        text += $(t).text();
      } else if (node.type === "text") {
        text += (node as cheerio.Text).data ?? "";
      }
      node = node.nextSibling;
    }
    text = text.replace(/\s+/g, " ").trim().substring(0, 80);
    if (text) nrsvueBooks.set(bookNum, { text, ch: chapter });
  });
}
if (nrsvueBooks.size > 0) {
  const sorted = [...nrsvueBooks.entries()].sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
  for (const [bookNum, info] of sorted) {
    console.log(`  Book ${bookNum} ch${info.ch}: "${info.text}"`);
  }
} else {
  console.log("  (none found — not an NRSVue-style EPUB)");
}

// ── Sample file: first 40 elements of a mid-spine content file ────────────
const midSpine = spine[Math.floor(spine.length / 4)] ?? spine[0];
console.log(`\n── DOM structure sample: ${midSpine?.href.split("/").pop()} ──`);
if (midSpine) {
  const html = zip.getEntry(midSpine.href)?.getData().toString("utf8") ?? "";
  const $ = cheerio.load(html);
  let count = 0;
  $("body *").each((_, el) => {
    if (count++ >= 40) return;
    const tag = el.tagName ?? el.type;
    const cls = (el as cheerio.Element).attribs?.class ?? "";
    const id = (el as cheerio.Element).attribs?.id ?? "";
    const text = $(el).clone().children().remove().end().text().trim().substring(0, 50);
    if (text || cls || id) {
      const attrs = [cls && `.${cls}`, id && `#${id}`].filter(Boolean).join("");
      console.log(`  ${tag}${attrs}: "${text}"`);
    }
  });
}

console.log("\n" + "=".repeat(60));
console.log("END OF REPORT — paste this into Claude/Gemini to generate a profile");
console.log("=".repeat(60));
