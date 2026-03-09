/**
 * Generates a manifest.json from the data/ directory.
 * Maps each translation to its books and chapters.
 *
 * Usage: npx tsx scripts/generate-manifest.ts
 */
import fs from "fs";
import path from "path";

const dataDir = path.join(import.meta.dirname, "..", "data");

interface ChapterEntry {
  document_id: string;
  title: string;
  chapter: number;
  sequence_number?: number;
}

interface BookEntry {
  book_id: string;
  name: string;
  chapters: ChapterEntry[];
  sequence_number?: number;
}

// Canonical Bible book order (OT, NT, Deuterocanonical) — used by NRSVue, KJV, Oxford Study Bible, JSB
const CANONICAL_BIBLE_BOOK_ORDER: string[] = [
  // OT
  "gen", "ex", "exod", "lev", "num", "deut", "josh", "judg", "ruth",
  "1-sam", "2-sam", "1-kgs", "2-kgs", "1-chr", "2-chr", "ezra", "neh", "esth",
  "job", "ps", "prov", "eccl", "song", "isa", "jer", "lam", "ezek", "dan",
  "hos", "joel", "amos", "obad", "jonah", "mic", "nah", "nahum", "hab", "zeph", "hag", "zech", "mal",
  // NT
  "matt", "mark", "luke", "john", "acts", "rom", "1-cor", "2-cor", "gal", "eph", "phil", "col",
  "1-thess", "2-thess", "1-tim", "2-tim", "titus", "phlm", "heb", "jas", "1-pet", "2-pet",
  "1-jn", "2-jn", "3-jn", "jude", "rev",
  // Deuterocanonical
  "tob", "jdt", "esth-gr", "add-esth", "wis", "sir", "bar", "let-jer",
  "pr-azar", "sus", "bel", "1-macc", "2-macc", "1-esd", "pr-man", "ps-151",
  "3-macc", "2-esd", "4-macc",
];

const BIBLE_PROFILES = ["nrsvue", "kjv", "oxford-study-bible", "jsb"];

function bookSequence(bookId: string): number {
  const idx = CANONICAL_BIBLE_BOOK_ORDER.indexOf(bookId);
  return idx >= 0 ? idx : 99999;
}

interface TranslationManifest {
  translation: string;
  profile: string;
  source_type?: "scripture" | "studyBible" | "commentary";
  preferred_base_profile?: string;
  books: BookEntry[];
}

function extractBookId(documentId: string): string {
  // "bom-1-ne-1" → "bom-1-ne", "gen-1" → "gen", "bom-w-of-m-1" → "bom-w-of-m"
  const parts = documentId.split("-");
  // The last segment is always the chapter number
  return parts.slice(0, -1).join("-");
}

function extractChapter(documentId: string): number {
  const parts = documentId.split("-");
  return parseInt(parts[parts.length - 1], 10);
}

function bookIdToName(bookId: string): string {
  const map: Record<string, string> = {
    // Book of Mormon
    "bom-1-ne": "1 Nephi",
    "bom-2-ne": "2 Nephi",
    "bom-3-ne": "3 Nephi",
    "bom-4-ne": "4 Nephi",
    "bom-jacob": "Jacob",
    "bom-enos": "Enos",
    "bom-jarom": "Jarom",
    "bom-omni": "Omni",
    "bom-w-of-m": "Words of Mormon",
    "bom-mosiah": "Mosiah",
    "bom-alma": "Alma",
    "bom-hel": "Helaman",
    "bom-morm": "Mormon",
    "bom-ether": "Ether",
    "bom-moro": "Moroni",
    // OT
    gen: "Genesis", ex: "Exodus", exod: "Exodus", lev: "Leviticus", num: "Numbers",
    deut: "Deuteronomy", josh: "Joshua", judg: "Judges", ruth: "Ruth",
    "1-sam": "1 Samuel", "2-sam": "2 Samuel", "1-kgs": "1 Kings", "2-kgs": "2 Kings",
    "1-chr": "1 Chronicles", "2-chr": "2 Chronicles", ezra: "Ezra", neh: "Nehemiah",
    esth: "Esther", job: "Job", ps: "Psalms", prov: "Proverbs",
    eccl: "Ecclesiastes", song: "Song of Solomon", isa: "Isaiah", jer: "Jeremiah",
    lam: "Lamentations", ezek: "Ezekiel", dan: "Daniel", hos: "Hosea",
    joel: "Joel", amos: "Amos", obad: "Obadiah", jonah: "Jonah",
    mic: "Micah", nah: "Nahum", nahum: "Nahum", hab: "Habakkuk", zeph: "Zephaniah",
    hag: "Haggai", zech: "Zechariah", mal: "Malachi",
    // NT
    matt: "Matthew", mark: "Mark", luke: "Luke", john: "John",
    acts: "Acts", rom: "Romans", "1-cor": "1 Corinthians", "2-cor": "2 Corinthians",
    gal: "Galatians", eph: "Ephesians", phil: "Philippians", col: "Colossians",
    "1-thess": "1 Thessalonians", "2-thess": "2 Thessalonians",
    "1-tim": "1 Timothy", "2-tim": "2 Timothy", titus: "Titus", phlm: "Philemon",
    heb: "Hebrews", jas: "James", "1-pet": "1 Peter", "2-pet": "2 Peter",
    "1-jn": "1 John", "2-jn": "2 John", "3-jn": "3 John", jude: "Jude", rev: "Revelation",
    // Oxford essays
    "oxford-essays": "Essays",
    // Deuterocanonical (NRSVue)
    tob: "Tobit", jdt: "Judith", "add-esth": "Additions to Esther",
    wis: "Wisdom", sir: "Sirach", bar: "Baruch", "let-jer": "Letter of Jeremiah",
    "pr-azar": "Prayer of Azariah", sus: "Susanna", bel: "Bel and the Dragon",
    "1-macc": "1 Maccabees", "2-macc": "2 Maccabees",
    "1-esd": "1 Esdras", "pr-man": "Prayer of Manasseh",
    "3-macc": "3 Maccabees", "2-esd": "2 Esdras", "4-macc": "4 Maccabees",
    // Pearl of Great Price
    moses: "Book of Moses", abr: "Book of Abraham",
    "js-m": "Joseph Smith—Matthew", "js-h": "Joseph Smith—History",
    aof: "Articles of Faith",
    // Proclamations
    "proclamation-family": "The Family: A Proclamation to the World",
    "proclamation-living-christ": "The Living Christ: The Testimony of the Apostles",
    "proclamation-restoration": "The Restoration of the Fulness of the Gospel",
    // Come, Follow Me 2026
    "cfm-2026-intro": "Introductory Materials",
    "cfm-2026-tkm": "Thoughts to Keep in Mind",
    "cfm-2026-lesson": "Weekly Lessons",
    "cfm-2026-appendix": "Appendixes",
    // Turley — How We Got the D&C
    "turley-dc": "How We Got the Doctrine and Covenants",
    // Doctrine and Covenants (sections 1-138)
    dc: "Doctrine and Covenants",
    // Revelations in Context (D&C commentary)
    ric: "Revelations in Context",
  };
  return map[bookId] || bookId;
}

const profileLabels: Record<string, string> = {
  "lds-bom": "LDS",
  kjv: "KJV",
  nrsvue: "NRSVue",
  "hardy-bom": "Hardy",
  "lds-pogp": "LDS",
  "proclamations": "LDS",
  "cfm-2026": "CFM 2026",
  "turley-dc": "Turley",
  "jsb": "NJPS",
  "lds-dc": "LDS",
  "revelations-in-context": "Revelations in Context",
  "oxford-study-bible": "Oxford Study Bible",
};

const studyBibleProfiles: Record<string, string> = {
  jsb: "jsb",
  "oxford-study-bible": "oxford-study-bible",
};

const commentaryProfiles: string[] = ["revelations-in-context", "turley-dc"];

const manifests: TranslationManifest[] = [];

for (const profile of fs.readdirSync(dataDir).sort()) {
  const profileDir = path.join(dataDir, profile);
  if (!fs.statSync(profileDir).isDirectory()) continue;

  const files = fs.readdirSync(profileDir).filter((f) => f.endsWith(".json"));
  const booksMap = new Map<string, ChapterEntry[]>();

  for (const file of files) {
    const docId = file.replace(".json", "");
    const raw = JSON.parse(fs.readFileSync(path.join(profileDir, file), "utf-8"));
    const isEssay = raw.type === "essay" || docId.startsWith("oxford-essay-");

    if (isEssay && profile === "oxford-study-bible") {
      const essaysId = "oxford-essays";
      if (!booksMap.has(essaysId)) booksMap.set(essaysId, []);
      booksMap.get(essaysId)!.push({
        document_id: docId,
        title: raw.title,
        chapter: 0,
        sequence_number: booksMap.get(essaysId)!.length,
      });
      continue;
    }

    const bookId = extractBookId(docId);
    const chapter = extractChapter(docId);

    if (!booksMap.has(bookId)) booksMap.set(bookId, []);
    booksMap.get(bookId)!.push({
      document_id: docId,
      title: raw.title,
      chapter,
    });
  }

  const books: BookEntry[] = [];
  for (const [bookId, chapters] of booksMap) {
    chapters.sort((a, b) => {
      if (a.chapter === 0 && b.chapter === 0) {
        return (a.title || "").localeCompare(b.title || "");
      }
      return (a.sequence_number ?? a.chapter) - (b.sequence_number ?? b.chapter);
    });
    const entry: BookEntry = {
      book_id: bookId,
      name: bookIdToName(bookId),
      chapters,
    };
    if (BIBLE_PROFILES.includes(profile)) {
      entry.sequence_number = bookSequence(bookId);
    }
    books.push(entry);
  }

  if (BIBLE_PROFILES.includes(profile)) {
    books.sort((a, b) => (a.sequence_number ?? 99999) - (b.sequence_number ?? 99999));
  }

  const manifest: TranslationManifest = {
    translation: profileLabels[profile] || profile,
    profile,
    books,
  };
  if (studyBibleProfiles[profile]) {
    manifest.source_type = "studyBible";
    manifest.preferred_base_profile = studyBibleProfiles[profile];
  } else if (commentaryProfiles.includes(profile)) {
    manifest.source_type = "commentary";
  }
  manifests.push(manifest);
}

const outPath = path.join(dataDir, "manifest.json");
fs.writeFileSync(outPath, JSON.stringify(manifests, null, 2));
console.log(`Wrote manifest with ${manifests.length} translations to ${outPath}`);
for (const m of manifests) {
  console.log(`  ${m.translation}: ${m.books.length} books, ${m.books.reduce((s, b) => s + b.chapters.length, 0)} chapters`);
}
