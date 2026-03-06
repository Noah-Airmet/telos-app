// Canonical Bible book names → UVID abbreviations
// This covers OT, NT, and LDS-specific books

export const BIBLE_BOOK_ABBREVS: Record<string, string> = {
  // Old Testament
  "Genesis": "gen",
  "Exodus": "ex",
  "Leviticus": "lev",
  "Numbers": "num",
  "Deuteronomy": "deut",
  "Joshua": "josh",
  "Judges": "judg",
  "Ruth": "ruth",
  "1 Samuel": "1-sam",
  "2 Samuel": "2-sam",
  "1 Kings": "1-kgs",
  "2 Kings": "2-kgs",
  "1 Chronicles": "1-chr",
  "2 Chronicles": "2-chr",
  "Ezra": "ezra",
  "Nehemiah": "neh",
  "Esther": "esth",
  "Job": "job",
  "Psalms": "ps",
  "Proverbs": "prov",
  "Ecclesiastes": "eccl",
  "Song of Solomon": "song",
  "Song of Songs": "song",
  "Isaiah": "isa",
  "Jeremiah": "jer",
  "Lamentations": "lam",
  "Ezekiel": "ezek",
  "Daniel": "dan",
  "Hosea": "hos",
  "Joel": "joel",
  "Amos": "amos",
  "Obadiah": "obad",
  "Jonah": "jonah",
  "Micah": "mic",
  "Nahum": "nahum",
  "Habakkuk": "hab",
  "Zephaniah": "zeph",
  "Haggai": "hag",
  "Zechariah": "zech",
  "Malachi": "mal",

  // New Testament
  "Matthew": "matt",
  "Mark": "mark",
  "Luke": "luke",
  "John": "john",
  "Acts": "acts",
  "Romans": "rom",
  "1 Corinthians": "1-cor",
  "2 Corinthians": "2-cor",
  "Galatians": "gal",
  "Ephesians": "eph",
  "Philippians": "phil",
  "Colossians": "col",
  "1 Thessalonians": "1-thess",
  "2 Thessalonians": "2-thess",
  "1 Timothy": "1-tim",
  "2 Timothy": "2-tim",
  "Titus": "titus",
  "Philemon": "phlm",
  "Hebrews": "heb",
  "James": "jas",
  "1 Peter": "1-pet",
  "2 Peter": "2-pet",
  "1 John": "1-jn",
  "2 John": "2-jn",
  "3 John": "3-jn",
  "Jude": "jude",
  "Revelation": "rev",

  // Deuterocanonical / Apocryphal
  "Tobit": "tob",
  "Judith": "jdt",
  "Esther (Greek)": "esth-gr",
  "Wisdom of Solomon": "wis",
  "Sirach": "sir",
  "Baruch": "bar",
  "Letter of Jeremiah": "let-jer",
  "Azariah and the Three Jews": "pr-azar",
  "Susanna": "sus",
  "Bel and the Dragon": "bel",
  "1 Maccabees": "1-macc",
  "2 Maccabees": "2-macc",
  "3 Maccabees": "3-macc",
  "4 Maccabees": "4-macc",
  "1 Esdras": "1-esd",
  "2 Esdras": "2-esd",
  "Prayer of Manasseh": "pr-man",
  "Psalm 151": "ps-151",

  // Book of Mormon
  "1 Nephi": "1-ne",
  "2 Nephi": "2-ne",
  "3 Nephi": "3-ne",
  "4 Nephi": "4-ne",
  "Jacob": "jacob",
  "Enos": "enos",
  "Jarom": "jarom",
  "Omni": "omni",
  "Words of Mormon": "w-of-m",
  "Mosiah": "mosiah",
  "Alma": "alma",
  "Helaman": "hel",
  "Mormon": "morm",
  "Ether": "ether",
  "Moroni": "moro",

  // D&C and Pearl of Great Price
  "Doctrine and Covenants": "dc",
  "Moses": "moses",
  "Abraham": "abr",
  "Joseph Smith—Matthew": "js-m",
  "Joseph Smith—History": "js-h",
  "Articles of Faith": "a-of-f",
};

// Reverse lookup: abbreviation → full name
export const ABBREV_TO_NAME: Record<string, string> = {};
for (const [name, abbrev] of Object.entries(BIBLE_BOOK_ABBREVS)) {
  if (!ABBREV_TO_NAME[abbrev]) {
    ABBREV_TO_NAME[abbrev] = name;
  }
}

export function lookupAbbrev(bookName: string): string {
  const abbrev = BIBLE_BOOK_ABBREVS[bookName];
  if (abbrev) return abbrev;

  // Fuzzy match: try trimming, case-insensitive
  const normalized = bookName.trim();
  for (const [name, ab] of Object.entries(BIBLE_BOOK_ABBREVS)) {
    if (name.toLowerCase() === normalized.toLowerCase()) return ab;
  }

  // Fallback: slugify the name
  return normalized.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
