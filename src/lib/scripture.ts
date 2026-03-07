import type { Block, CanonicalReference, CompareUnit, TelosDocument } from "../db/db";

export interface ChapterEntry {
  document_id: string;
  title: string;
  chapter: number | null;
  canonical_chapter?: number | null;
  sequence_number?: number;
  compare_ready?: boolean;
}

export interface BookEntry {
  book_id: string;
  name: string;
  canonical_book_id: string;
  work_id: string;
  compare_ready: boolean;
  sequence_number?: number;
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

export function normalizeManifest(rawManifests: TranslationManifest[]): TranslationManifest[] {
  const normalizedManifests = rawManifests.map((manifest) => {
    const bookGroups = new Map<string, BookEntry[]>();

    for (const rawBook of manifest.books) {
      const canonicalBookId = normalizeBookId(rawBook.book_id);
      const normalizedBook: BookEntry = {
        ...rawBook,
        name: humanizeBookName(rawBook.name, rawBook.chapters[0]?.title),
        canonical_book_id: canonicalBookId,
        work_id: inferWorkId(canonicalBookId || manifest.profile),
        compare_ready: false,
        sequence_number: rawBook.sequence_number,
        chapters: rawBook.chapters.map((chapter) => ({
          ...chapter,
          canonical_chapter: isComparableChapter(chapter) ? chapter.chapter : null,
          sequence_number: chapter.sequence_number,
          compare_ready: isComparableChapter(chapter),
        })).sort((a, b) => (a.sequence_number ?? 99999) - (b.sequence_number ?? 99999)),
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
        compare_ready: false,
      };
    });

    books.sort((a, b) => (a.sequence_number ?? 99999) - (b.sequence_number ?? 99999));

    return {
      ...manifest,
      edition_family: inferEditionFamily(manifest.profile, manifest.translation),
      compare_ready: false,
      books,
    };
  });

  const chapterCoverage = new Map<string, Set<string>>();

  for (const manifest of normalizedManifests) {
    for (const book of manifest.books) {
      for (const chapter of book.chapters) {
        if (!isComparableChapter(chapter)) continue;
        const key = `${book.work_id}|${book.canonical_book_id}|${chapter.chapter}`;
        const profiles = chapterCoverage.get(key) ?? new Set<string>();
        profiles.add(manifest.profile);
        chapterCoverage.set(key, profiles);
      }
    }
  }

  return normalizedManifests.map((manifest) => {
    const books = manifest.books.map((book) => {
      const chapters = book.chapters.map((chapter) => {
        const key = `${book.work_id}|${book.canonical_book_id}|${chapter.chapter}`;
        const hasPeerCoverage =
          isComparableChapter(chapter) && (chapterCoverage.get(key)?.size ?? 0) >= 2;

        return {
          ...chapter,
          compare_ready: Boolean(hasPeerCoverage),
        };
      });

      return {
        ...book,
        chapters,
        compare_ready: chapters.some((chapter) => chapter.compare_ready),
      };
    });

    return {
      ...manifest,
      books,
      compare_ready: books.some((book) => book.compare_ready),
    };
  });
}

export function inferCanonicalRef(blockId: string): CanonicalReference {
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

export function buildCanonicalUnitId(ref?: CanonicalReference | null) {
  if (!ref?.work || !ref.book || ref.chapter == null || ref.verse == null) return null;
  return `${ref.work}-${ref.book}-${ref.chapter}-${ref.verse}`;
}

function dedupeStrings(values: string[] | undefined) {
  return [...new Set(values ?? [])];
}

function normalizeVerseRange(block: Block, canonicalRef: CanonicalReference) {
  const verseStart = block.verse_start ?? canonicalRef.verse ?? null;
  const verseEnd = block.verse_end ?? verseStart;
  return { verseStart, verseEnd };
}

function splitLegacyHardyParagraphText(
  text: string,
  verseStart: number,
  nextVerseStart: number | null
) {
  const markerPattern = /\b(\d{1,3})\b(?=\s+[A-Z“"'(\[])/g;
  const markers: Array<{ verseNumber: number; index: number; markerLength: number }> = [];

  let match = markerPattern.exec(text);
  while (match) {
    const verseNumber = parseInt(match[1], 10);
    if (
      verseNumber > verseStart &&
      (nextVerseStart === null || verseNumber < nextVerseStart) &&
      (markers.length === 0 || verseNumber > markers[markers.length - 1].verseNumber)
    ) {
      markers.push({
        verseNumber,
        index: match.index,
        markerLength: match[0].length,
      });
    }
    match = markerPattern.exec(text);
  }

  if (!markers.length) {
    return [{ verseNumber: verseStart, text: text.trim() }];
  }

  const segments: Array<{ verseNumber: number; text: string }> = [];
  let currentVerse = verseStart;
  let lastIndex = 0;

  for (const marker of markers) {
    const segmentText = text.slice(lastIndex, marker.index).trim();
    if (segmentText) {
      segments.push({ verseNumber: currentVerse, text: segmentText });
    }
    currentVerse = marker.verseNumber;
    lastIndex = marker.index + marker.markerLength;
  }

  const trailingText = text.slice(lastIndex).trim();
  if (trailingText) {
    segments.push({ verseNumber: currentVerse, text: trailingText });
  }

  return segments;
}

function migrateLegacyHardyDocument(document: TelosDocument): TelosDocument {
  if ((document.compare_units?.length ?? 0) > 0) return document;

  const verseBlocks = document.blocks.filter((block) => block.type === "verse");
  const nextVerseStartByBlockId = new Map<string, number | null>();

  verseBlocks.forEach((block, index) => {
    const nextVerseBlock = verseBlocks[index + 1];
    const nextVerseStart = nextVerseBlock ? inferCanonicalRef(nextVerseBlock.block_id).verse ?? null : null;
    nextVerseStartByBlockId.set(block.block_id, nextVerseStart);
  });

  const compareUnits: CompareUnit[] = [];
  const blocks = document.blocks.map((block) => {
    if (block.type !== "verse" || block.compare_unit_ids?.length) return block;

    const canonicalRef = block.canonical_ref || inferCanonicalRef(block.block_id);
    const verseStart = canonicalRef.verse;
    if (verseStart == null) return block;

    const segments = splitLegacyHardyParagraphText(
      block.text,
      verseStart,
      nextVerseStartByBlockId.get(block.block_id) ?? null
    );
    const inferredVerseEnd =
      nextVerseStartByBlockId.get(block.block_id) != null
        ? (nextVerseStartByBlockId.get(block.block_id) as number) - 1
        : segments[segments.length - 1]?.verseNumber ?? verseStart;
    const compareUnitIds = Array.from(
      { length: Math.max(inferredVerseEnd - verseStart + 1, 1) },
      (_, index) => `${canonicalRef.work}-${canonicalRef.book}-${canonicalRef.chapter}-${verseStart + index}`
    );

    compareUnits.push(
      ...segments.map((segment) => ({
        unit_id: `${canonicalRef.work}-${canonicalRef.book}-${canonicalRef.chapter}-${segment.verseNumber}`,
        text: segment.text,
        source_block_id: block.block_id,
      }))
    );

    return {
      ...block,
      type: (segments.length > 1 ? "paragraph" : "verse") as Block["type"],
      number: verseStart,
      verse_start: verseStart,
      verse_end: inferredVerseEnd,
      compare_unit_ids: compareUnitIds,
      sync_unit_id: compareUnitIds[0] ?? block.block_id,
    };
  });

  return {
    ...document,
    blocks,
    compare_units: compareUnits,
  };
}

function normalizeBlock(block: Block): Block {
  const canonicalRef = block.canonical_ref || inferCanonicalRef(block.block_id);
  const { verseStart, verseEnd } = normalizeVerseRange(block, canonicalRef);
  const defaultUnitId = buildCanonicalUnitId(canonicalRef);
  const compareUnitIds = dedupeStrings(
    block.compare_unit_ids?.length ? block.compare_unit_ids : defaultUnitId ? [defaultUnitId] : []
  );

  return {
    ...block,
    canonical_ref: canonicalRef,
    verse_start: verseStart,
    verse_end: verseEnd,
    compare_unit_ids: compareUnitIds,
    sync_unit_id: block.sync_unit_id ?? compareUnitIds[0] ?? null,
    tokens: block.tokens || tokenize(block.text),
    apparatus: block.apparatus || [],
  };
}

function deriveCompareUnits(blocks: Block[]): CompareUnit[] {
  const units: CompareUnit[] = [];

  for (const block of blocks) {
    if (block.type !== "verse" && block.type !== "paragraph") continue;
    if (!block.compare_unit_ids?.length) continue;
    if (block.compare_unit_ids.length !== 1) continue;

    units.push({
      unit_id: block.compare_unit_ids[0],
      text: block.text,
      source_block_id: block.block_id,
    });
  }

  return units;
}

function compareUnitSortKey(unit: CompareUnit) {
  const ref = unit.canonical_ref || inferCanonicalRef(unit.unit_id);
  return [
    ref.work,
    ref.book,
    String(ref.chapter ?? 0).padStart(4, "0"),
    String(ref.verse ?? 0).padStart(4, "0"),
  ].join(":");
}

function normalizeCompareUnit(unit: CompareUnit): CompareUnit {
  const canonicalRef = unit.canonical_ref || inferCanonicalRef(unit.unit_id);

  return {
    ...unit,
    canonical_ref: canonicalRef,
    tokens: unit.tokens || tokenize(unit.text),
  };
}

export function buildCompareUnitIndex(document?: TelosDocument | null) {
  return new Map((document?.compare_units ?? []).map((unit) => [unit.unit_id, unit]));
}

export function getBlockPrimaryCompareUnitId(block: Block) {
  return block.sync_unit_id ?? block.compare_unit_ids?.[0] ?? buildCanonicalUnitId(block.canonical_ref);
}

export function blockContainsCompareUnit(block: Block, unitId: string) {
  return block.compare_unit_ids?.includes(unitId) ?? false;
}

export function hasFullComparisonCoverage(
  block: Block,
  comparisonIndex: Map<string, CompareUnit>
) {
  return Boolean(
    block.compare_unit_ids?.length &&
      block.compare_unit_ids.every((unitId) => comparisonIndex.has(unitId))
  );
}

export function haveComparableOverlap(
  document?: TelosDocument | null,
  comparisonDocument?: TelosDocument | null
) {
  if (!document || !comparisonDocument) return false;

  const documentUnitIds = new Set((document.compare_units ?? []).map((unit) => unit.unit_id));
  return (comparisonDocument.compare_units ?? []).some((unit) => documentUnitIds.has(unit.unit_id));
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

export function normalizeDocument(profile: string, document: TelosDocument): TelosDocument {
  const migratedDocument = profile === "hardy-bom" ? migrateLegacyHardyDocument(document) : document;
  const fallbackBlock =
    migratedDocument.blocks.find((block) => block.type === "verse") || migratedDocument.blocks[0];
  const fallbackRef = fallbackBlock ? inferCanonicalRef(fallbackBlock.block_id) : null;
  const blocks = migratedDocument.blocks.map(normalizeBlock);
  const explicitCompareUnits = migratedDocument.compare_units ?? [];
  const derivedCompareUnits = deriveCompareUnits(blocks);
  const compareUnitLookup = new Map<string, CompareUnit>();

  for (const unit of derivedCompareUnits) {
    compareUnitLookup.set(unit.unit_id, unit);
  }

  for (const unit of explicitCompareUnits) {
    compareUnitLookup.set(unit.unit_id, unit);
  }

  const compareUnits = [...compareUnitLookup.values()]
    .map(normalizeCompareUnit)
    .sort((left, right) => compareUnitSortKey(left).localeCompare(compareUnitSortKey(right)));

  return {
    ...migratedDocument,
    edition_family:
      migratedDocument.edition_family || inferEditionFamily(profile, migratedDocument.translation),
    work_id: migratedDocument.work_id || fallbackRef?.work,
    canonical_book_id: migratedDocument.canonical_book_id || fallbackRef?.book,
    footnotes: migratedDocument.footnotes || [],
    variants: migratedDocument.variants || [],
    blocks,
    compare_units: compareUnits,
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
