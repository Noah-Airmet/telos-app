import type { DictionaryEntry, StudyIndexEntry } from "../db/db";

function normalizeHeadword(value: string) {
  return value.trim().toLowerCase().replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "");
}

interface RawDictionaryEntry {
  headword?: string;
  word?: string;
  term?: string;
  definition?: string;
  gloss?: string;
  text?: string;
}

function normalizeDictionaryEntry(
  dictionary: string,
  rawEntry: RawDictionaryEntry,
  index: number
): DictionaryEntry | null {
  const headword = rawEntry.headword || rawEntry.word || rawEntry.term;
  const definition = rawEntry.definition || rawEntry.gloss || rawEntry.text;

  if (!headword || !definition) return null;

  return {
    id: `${dictionary}-${index}-${normalizeHeadword(headword)}`,
    dictionary,
    headword,
    normalized_headword: normalizeHeadword(headword),
    definition,
  };
}

export async function importDictionaryFile(file: File) {
  const text = await file.text();
  const parsed = JSON.parse(text) as unknown;
  const parsedRecord = typeof parsed === "object" && parsed ? parsed as Record<string, unknown> : {};

  const dictionaryName =
    (!Array.isArray(parsed) && typeof parsedRecord.dictionary === "string"
      ? parsedRecord.dictionary
      : undefined) || file.name.replace(/\.[^.]+$/, "");

  let rawEntries: RawDictionaryEntry[];

  if (Array.isArray(parsed)) {
    rawEntries = parsed as RawDictionaryEntry[];
  } else if (Array.isArray(parsedRecord.entries)) {
    rawEntries = parsedRecord.entries as RawDictionaryEntry[];
  } else {
    rawEntries = Object.entries(parsedRecord).map(([headword, definition]) => ({
      headword,
      definition: typeof definition === "string" ? definition : JSON.stringify(definition),
    }));
  }

  return rawEntries
    .map((entry, index) => normalizeDictionaryEntry(dictionaryName, entry, index))
    .filter((entry): entry is DictionaryEntry => Boolean(entry));
}

export function lookupDictionaryEntries(entries: DictionaryEntry[], word: string) {
  const normalized = normalizeHeadword(word);
  if (!normalized) return [];

  const exactMatches = entries.filter((entry) => entry.normalized_headword === normalized);
  if (exactMatches.length > 0) return exactMatches;

  const fallback = normalized.endsWith("s") ? normalized.slice(0, -1) : normalized;
  return entries.filter((entry) => entry.normalized_headword === fallback);
}

export async function importStudyIndexFile(file: File) {
  const text = await file.text();
  const parsed = JSON.parse(text) as StudyIndexEntry[] | { entries?: StudyIndexEntry[] };
  const entries = Array.isArray(parsed) ? parsed : parsed.entries || [];

  return entries.filter((entry) => Boolean(entry?.id && entry?.kind && entry?.label));
}
