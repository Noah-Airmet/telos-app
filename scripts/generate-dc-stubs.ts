/**
 * Generate stub D&C documents (dc-1 through dc-138) for when full PDF extraction
 * is not yet available. Creates minimal structure so the manifest and app can load.
 *
 * Run Marker extraction and ingest-dc-from-markdown to replace with full content:
 *   python3 scripts/extract_pdf.py new-stuff/doctrine-and-covenants.pdf ./output
 *   npx tsx scripts/ingest-dc-from-markdown.ts output/doctrine-and-covenants/*.md
 *
 * Usage: npx tsx scripts/generate-dc-stubs.ts [--output data/lds-dc]
 */
import fs from "fs";
import path from "path";

const OUTPUT_DIR = path.join(import.meta.dirname, "..", "data", "lds-dc");

// Official D&C section titles (abbreviated) for stub headings
const SECTION_TITLES: Record<number, string> = {
  1: "Revelation given through Joseph Smith",
  2: "Moroni's message about Elijah",
  3: "The work of the Lord",
  4: "Oliver Cowdery called",
  5: "Oliver Cowdery's mission",
  6: "Oliver Cowdery's gift",
  7: "John the Beloved",
  8: "Oliver Cowdery's gift of revelation",
  9: "Oliver Cowdery's gift of translation",
  10: "The lost manuscript",
  11: "Oliver Cowdery to preach",
  12: "Joseph Knight Sr. called",
  13: "Restoration of the Aaronic Priesthood",
  14: "David Whitmer called",
  15: "John Whitmer called",
  16: "Peter Whitmer Jr. called",
  17: "The Three Witnesses",
  18: "The Twelve Apostles",
  19: "God's punishment",
  20: "The Church of Christ",
  21: "Joseph Smith ordained",
  22: "Baptism required",
  23: "Prayer for the brethren",
  24: "Joseph Smith's calling",
  25: "Emma Smith called",
  26: "Joseph Smith to translate",
  27: "The sacrament",
  28: "Hiram Page's false revelation",
  29: "The Second Coming",
  30: "Thomas B. Marsh",
  31: "Thomas B. Marsh's mission",
  32: "Sidney Gilbert and Newel Knight",
  33: "Ezra Thayre and Northrop Sweet",
  34: "Orson Pratt",
  35: "Sidney Rigdon",
  36: "Edward Partridge",
  37: "Gather to Ohio",
  38: "The Lord's covenant people",
  39: "James Covel",
  40: "Thomas B. Marsh and wife",
  41: "Edward Partridge as bishop",
  42: "The law of the Church",
  43: "Seek spiritual gifts",
  44: "Church conferences",
  45: "Signs of the times",
  46: "Spiritual gifts",
  47: "John Whitmer as historian",
  48: "Lands in Ohio",
  49: "The Jews and the Second Coming",
  50: "Spirits and discernment",
  51: "William W. Phelps",
  52: "Jared Carter",
  53: "Sidney Gilbert",
  54: "Newel Knight",
  55: "William W. Phelps's mission",
  56: "Leman Copley",
  57: "Land of Zion",
  58: "Zion and the stakes",
  59: "The Lord's law",
  60: "Missionaries and the river",
  61: "The journey to Missouri",
  62: "Orson Hyde and others",
  63: "The land of Zion",
  64: "Reconciliation",
  65: "The keys of the kingdom",
  66: "Hyrum Smith",
  67: "The testimony of the Twelve",
  68: "Orson Hyde, Luke Johnson, Lyman Johnson",
  69: "Oliver Cowdery to carry scriptures",
  70: "Stewardship of revelations",
  71: "Joseph Smith and Sidney Rigdon",
  72: "Bishops and their duties",
  73: "Joseph Smith and Sidney Rigdon",
  74: "Baptism of children",
  75: "Elders and priests",
  76: "The Vision",
  77: "Questions on Revelation",
  78: "United Firm",
  79: "Jared Carter",
  80: "Stephen Burnett",
  81: "Frederick G. Williams",
  82: "The law of the Lord",
  83: "Tithing",
  84: "The priesthood",
  85: "The bishop's duty",
  86: "Priesthood lineage",
  87: "War and desolation",
  88: "The Olive Leaf",
  89: "The Word of Wisdom",
  90: "Joseph Smith's keys",
  91: "Apocrypha",
  92: "United Order",
  93: "The record of John",
  94: "Temple and buildings",
  95: "The school of the prophets",
  96: "Land in Kirtland",
  97: "The house of the Lord",
  98: "The law of the Church",
  99: "John Murdock",
  100: "Sidney Rigdon",
  101: "Lands in Missouri",
  102: "Church councils",
  103: "The redemption of Zion",
  104: "The United Order",
  105: "Zion's camp",
  106: "Joseph Smith Sr.",
  107: "The priesthood",
  108: "Lyman Sherman",
  109: "Dedication of Kirtland Temple",
  110: "Appearance of the Lord",
  111: "Mission to Salem",
  112: "Thomas B. Marsh",
  113: "Land of Zion",
  114: "The Twelve",
  115: "Joseph Smith's name",
  116: "Adam-ondi-Ahman",
  117: "William Marks and Newel Knight",
  118: "The Twelve",
  119: "Tithing",
  120: "Bishopric",
  121: "Conditions in Missouri",
  122: "Joseph Smith in Liberty Jail",
  123: "The martyrs",
  124: "The Nauvoo Temple",
  125: "Saints in Iowa",
  126: "Joseph Smith's family",
  127: "Record keeping",
  128: "Baptism for the dead",
  129: "God is a spirit",
  130: "God has a body",
  131: "The more sure word",
  132: "The new and everlasting covenant",
  133: "The Lord's coming",
  134: "Government",
  135: "Joseph and Hyrum",
  136: "The Word and Will of the Lord",
  137: "The redemption of the dead",
  138: "The vision of the redemption of the dead",
};

function main() {
  const args = process.argv.slice(2);
  let outputDir = OUTPUT_DIR;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) outputDir = args[++i];
  }

  fs.mkdirSync(outputDir, { recursive: true });

  for (let section = 1; section <= 138; section++) {
    const title = SECTION_TITLES[section] ?? `Section ${section}`;
    const doc = {
      document_id: `dc-${section}`,
      title: `Section ${section}: ${title}`,
      type: "scripture",
      translation: "LDS",
      work_id: "dc",
      canonical_book_id: "dc",
      blocks: [
        {
          block_id: `dc-${section}-heading`,
          type: "heading",
          text: title,
        },
        {
          block_id: `dc-${section}-1`,
          type: "verse",
          number: 1,
          text: `[Section ${section} — Import full text from doctrine-and-covenants.pdf using Marker and ingest-dc-from-markdown.ts]`,
          canonical_ref: { work: "dc", book: "dc", chapter: section, verse: 1 },
          verse_start: 1,
          verse_end: 1,
        },
      ],
    };
    fs.writeFileSync(
      path.join(outputDir, `dc-${section}.json`),
      JSON.stringify(doc, null, 2)
    );
  }

  console.log(`Generated 138 stub documents in ${outputDir}/`);
  console.log("Run Marker extraction and ingest-dc-from-markdown to replace with full content.");
}

main();
