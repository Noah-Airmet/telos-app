import type { Note, NoteQuery, TextAnchor } from "../db/db";

const BOOK_LABELS: Record<string, string> = {
  "1-ne": "1 Nephi",
  "2-ne": "2 Nephi",
  jacob: "Jacob",
  enos: "Enos",
  jarom: "Jarom",
  omni: "Omni",
  "w-of-m": "Words of Mormon",
  mosiah: "Mosiah",
  alma: "Alma",
  hel: "Helaman",
  "3-ne": "3 Nephi",
  "4-ne": "4 Nephi",
  morm: "Mormon",
  ether: "Ether",
  moro: "Moroni",
};

interface InferredLocation {
  work_id?: string;
  canonical_book_id?: string;
  chapter?: number | null;
  verse?: number | null;
}

function inferLocationFromBlockId(blockId: string): InferredLocation {
  const match = blockId.match(/^([a-z0-9]+)-(.+)-(\d+)-(\d+)$/i);
  if (!match) return {};

  return {
    work_id: match[1],
    canonical_book_id: match[2],
    chapter: Number(match[3]),
    verse: Number(match[4]),
  };
}

function humanizeBookId(bookId?: string | null) {
  if (!bookId) return null;
  if (BOOK_LABELS[bookId]) return BOOK_LABELS[bookId];

  return bookId
    .split("-")
    .map((part) => (/^\d+$/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export function buildReferenceLabel(location: {
  canonical_book_id?: string | null;
  chapter?: number | null;
  verse?: number | null;
  fallbackBlockId?: string;
}) {
  const bookLabel = humanizeBookId(location.canonical_book_id);
  if (!bookLabel) return location.fallbackBlockId ?? null;
  if (location.chapter && location.verse) return `${bookLabel} ${location.chapter}:${location.verse}`;
  if (location.chapter) return `${bookLabel} ${location.chapter}`;
  return bookLabel;
}

export function normalizeAnchor(anchor?: TextAnchor | null): TextAnchor | undefined {
  if (!anchor) return undefined;

  const inferred = inferLocationFromBlockId(anchor.block_id);

  return {
    ...anchor,
    work_id: anchor.work_id ?? inferred.work_id,
    canonical_book_id: anchor.canonical_book_id ?? inferred.canonical_book_id,
    chapter: anchor.chapter ?? inferred.chapter ?? null,
    verse: anchor.verse ?? inferred.verse ?? null,
    reference_label:
      anchor.reference_label ??
      buildReferenceLabel({
        canonical_book_id: anchor.canonical_book_id ?? inferred.canonical_book_id,
        chapter: anchor.chapter ?? inferred.chapter ?? null,
        verse: anchor.verse ?? inferred.verse ?? null,
        fallbackBlockId: anchor.block_id,
      }) ??
      undefined,
  };
}

export function normalizeNote(note: Note): Note {
  const anchor = normalizeAnchor(note.anchor);
  const inferred = inferLocationFromBlockId(note.block_id);

  return {
    ...note,
    anchor,
    work_id: note.work_id ?? anchor?.work_id ?? inferred.work_id,
    canonical_book_id:
      note.canonical_book_id ?? anchor?.canonical_book_id ?? inferred.canonical_book_id,
    chapter: note.chapter ?? anchor?.chapter ?? inferred.chapter ?? null,
    verse: note.verse ?? anchor?.verse ?? inferred.verse ?? null,
    reference_label:
      note.reference_label ??
      anchor?.reference_label ??
      buildReferenceLabel({
        canonical_book_id: note.canonical_book_id ?? anchor?.canonical_book_id ?? inferred.canonical_book_id,
        chapter: note.chapter ?? anchor?.chapter ?? inferred.chapter ?? null,
        verse: note.verse ?? anchor?.verse ?? inferred.verse ?? null,
        fallbackBlockId: note.block_id,
      }) ??
      undefined,
    quote: note.quote ?? anchor?.quote,
    profile: note.profile ?? anchor?.profile,
  };
}

function normalizeTag(tag: string) {
  return tag.trim().toLowerCase();
}

export function noteMatchesQuery(note: Note, query: NoteQuery) {
  if (query.block_id && note.block_id !== query.block_id) return false;
  if (query.work_id && note.work_id !== query.work_id) return false;
  if (query.canonical_book_id && note.canonical_book_id !== query.canonical_book_id) return false;
  if (typeof query.chapter === "number" && note.chapter !== query.chapter) return false;

  if (query.tags?.length) {
    const noteTags = new Set((note.tags ?? []).map(normalizeTag));
    if (!query.tags.every((tag) => noteTags.has(normalizeTag(tag)))) return false;
  }

  if (query.search?.trim()) {
    const haystack = [
      note.text,
      note.reference_label,
      note.quote,
      ...(note.tags ?? []),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(query.search.trim().toLowerCase())) return false;
  }

  return true;
}

export function filterNotes(notes: Note[], query: NoteQuery) {
  return notes.filter((note) => noteMatchesQuery(note, query));
}
