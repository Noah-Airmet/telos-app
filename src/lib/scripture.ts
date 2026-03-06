import type { TelosDocument } from "../db/db";

export interface ChapterEntry {
  document_id: string;
  title: string;
  chapter: number | null;
  canonical_chapter?: number | null;
  compare_ready?: boolean;
}

export interface BookEntry {
  book_id: string;
  name: string;
  canonical_book_id: string;
  work_id: string;
  compare_ready: boolean;
  chapters: ChapterEntry[];
}

export interface TranslationManifest {
  translation: string;
  profile: string;
  edition_family: string;
  compare_ready: boolean;
  books: BookEntry[];
}

const docCache = new Map<string, TelosDocument>();

function inferWorkId(value: string) {
  const normalized = value.toLowerCase();

  if (normalized.startsWith("bom-")) return "bom";
  if (normalized.startsWith("dc-")) return "dc";
  if (normalized.startsWith("pgp-")) return "pgp";
  if (normalized.startsWith("ot-") || normalized.startsWith("nt-")) return "bible";

  if (["kjv", "nrsvue", "nlt", "esv", "niv"].includes(normalized)) return "bible";
  return normalized.includes("bom") ? "bom" : "bible";
}

function inferEditionFamily(profile: string, translation: string) {
  const normalizedProfile = profile.toLowerCase();
  const normalizedTranslation = translation.toLowerCase();

  if (normalizedProfile.includes("hardy")) return "annotated-bom";
  if (normalizedProfile.includes("bom")) return "bom";
  if (normalizedProfile.includes("dc")) return "dc";
  if (normalizedProfile.includes("pgp")) return "pgp";
  if (normalizedTranslation.includes("annotated")) return "annotated";
  return "bible";
}

function normalizeBookId(bookId: string) {
  return bookId.replace(/-(hardy|annotated)$/i, "");
}

function isMachineName(name: string) {
  return name.toLowerCase() === name && name.includes("-");
}

function humanizeBookName(name: string, fallbackTitle?: string) {
  if (!isMachineName(name)) return name;

  const titlePrefix = fallbackTitle?.replace(/\s*\(.*\)$/, "").trim();
  if (titlePrefix) return titlePrefix;

  return name;
}

function isComparableChapter(chapter: ChapterEntry) {
  return typeof chapter.chapter === "number" && Number.isFinite(chapter.chapter);
}

function isBookComparable(book: BookEntry) {
  return book.chapters.length > 0 && book.chapters.every(isComparableChapter);
}

function normalizeManifest(rawManifests: TranslationManifest[]): TranslationManifest[] {
  return rawManifests.map((manifest) => {
    const bookGroups = new Map<string, BookEntry[]>();

    for (const rawBook of manifest.books) {
      const canonicalBookId = normalizeBookId(rawBook.book_id);
      const normalizedBook: BookEntry = {
        ...rawBook,
        name: humanizeBookName(rawBook.name, rawBook.chapters[0]?.title),
        canonical_book_id: canonicalBookId,
        work_id: inferWorkId(canonicalBookId || manifest.profile),
        compare_ready: false,
        chapters: rawBook.chapters.map((chapter) => ({
          ...chapter,
          canonical_chapter: isComparableChapter(chapter) ? chapter.chapter : null,
          compare_ready: isComparableChapter(chapter),
        })),
      };

      const group = bookGroups.get(canonicalBookId) || [];
      group.push(normalizedBook);
      bookGroups.set(canonicalBookId, group);
    }

    const books = [...bookGroups.values()].map((entries) => {
      const bestEntry =
        [...entries].sort((left, right) => {
          const leftComparableCount = left.chapters.filter(isComparableChapter).length;
          const rightComparableCount = right.chapters.filter(isComparableChapter).length;

          return rightComparableCount - leftComparableCount;
        })[0];

      return {
        ...bestEntry,
        compare_ready: isBookComparable(bestEntry),
      };
    });

    return {
      ...manifest,
      edition_family: inferEditionFamily(manifest.profile, manifest.translation),
      compare_ready: books.every((book) => book.compare_ready),
      books,
    };
  });
}

function inferCanonicalRef(blockId: string) {
  const parts = blockId.split("-");
  const numericTail: number[] = [];

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const value = Number(parts[index]);
    if (!Number.isNaN(value)) {
      numericTail.unshift(value);
      continue;
    }

    break;
  }

  const work = parts[0];
  const bookParts = parts.slice(1, Math.max(1, parts.length - numericTail.length));

  return {
    work,
    book: bookParts.join("-"),
    chapter: numericTail.length >= 1 ? numericTail[0] : null,
    verse: numericTail.length >= 2 ? numericTail[1] : null,
  };
}

function tokenize(text: string) {
  const matches = text.matchAll(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);

  return Array.from(matches).map((match, index) => ({
    id: `token-${index}-${match.index ?? 0}`,
    text: match[0],
    normalized: match[0].toLowerCase(),
    start_offset: match.index ?? 0,
    end_offset: (match.index ?? 0) + match[0].length,
  }));
}

function normalizeDocument(profile: string, document: TelosDocument): TelosDocument {
  const fallbackBlock = document.blocks.find((block) => block.type === "verse") || document.blocks[0];
  const fallbackRef = fallbackBlock ? inferCanonicalRef(fallbackBlock.block_id) : null;

  return {
    ...document,
    edition_family: document.edition_family || inferEditionFamily(profile, document.translation),
    work_id: document.work_id || fallbackRef?.work,
    canonical_book_id: document.canonical_book_id || fallbackRef?.book,
    footnotes: document.footnotes || [],
    variants: document.variants || [],
    blocks: document.blocks.map((block) => ({
      ...block,
      canonical_ref: block.canonical_ref || inferCanonicalRef(block.block_id),
      tokens: block.tokens || tokenize(block.text),
      apparatus: block.apparatus || [],
    })),
  };
}

export async function loadManifest(): Promise<TranslationManifest[]> {
  const res = await fetch("/data/manifest.json");
  const manifest = await res.json();
  return normalizeManifest(manifest);
}

export async function loadDocument(
  profile: string,
  documentId: string
): Promise<TelosDocument> {
  const key = `${profile}/${documentId}`;
  if (docCache.has(key)) return docCache.get(key)!;

  const res = await fetch(`/data/${profile}/${documentId}.json`);
  if (!res.ok) throw new Error(`Failed to load ${key}: ${res.status}`);
  const rawDocument: TelosDocument = await res.json();
  const doc = normalizeDocument(profile, rawDocument);
  docCache.set(key, doc);
  return doc;
}
