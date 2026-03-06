// Database layer stub.
// MVP: study data can live in localStorage or a synced backend.
// Future: SQLite WASM + OPFS in a Web Worker for full-text search and complex queries.

export type BlockType =
  | "verse"
  | "heading"
  | "summary"
  | "paragraph"
  | "commentary"
  | "footnote"
  | "variant";

export interface CanonicalReference {
  work: string;
  book: string;
  chapter?: number | null;
  verse?: number | null;
}

export interface TextAnchor {
  block_id: string;
  start_offset?: number;
  end_offset?: number;
  token_ids?: string[];
}

export interface BlockToken {
  id: string;
  text: string;
  normalized: string;
  start_offset: number;
  end_offset: number;
}

export interface ApparatusPointer {
  id: string;
  kind: "footnote" | "variant" | "crossref" | "dictionary";
}

export interface Block {
  block_id: string;
  type: BlockType;
  number?: number;
  text: string;
  canonical_ref?: CanonicalReference;
  tokens?: BlockToken[];
  apparatus?: ApparatusPointer[];
}

export interface TextVariant {
  id: string;
  anchor: TextAnchor;
  source_profile: string;
  compare_profile: string;
  base_text: string;
  variant_text: string;
  note?: string;
}

export interface Footnote {
  id: string;
  anchor: TextAnchor;
  kind: "study" | "variant" | "crossref";
  marker?: string;
  text: string;
  source_profile?: string;
  target_refs?: string[];
}

export interface DictionaryEntry {
  id: string;
  dictionary: string;
  headword: string;
  normalized_headword: string;
  definition: string;
  source_path?: string;
  license?: string;
}

export interface StudyIndexEntry {
  id: string;
  kind: "person" | "place" | "topic" | "quotation";
  label: string;
  refs: string[];
  description?: string;
}

export interface TelosDocument {
  document_id: string;
  title: string;
  type: "scripture" | "study-bible" | "commentary";
  translation: string;
  edition_family?: string;
  work_id?: string;
  canonical_book_id?: string;
  footnotes?: Footnote[];
  variants?: TextVariant[];
  blocks: Block[];
}

export interface Highlight {
  id: string;
  block_id: string;
  start_offset: number;
  end_offset: number;
  color: string;
  note_id?: string;
  tags?: string[];
  created_at: number;
}

export interface Note {
  id: string;
  block_id: string;
  anchor?: TextAnchor;
  text: string;
  tags?: string[];
  created_at: number;
  updated_at: number;
}

export interface ReadingState {
  id: string;
  profile: string;
  book_id: string;
  chapter: number;
  secondary_profile?: string | null;
  updated_at: number;
}

const HIGHLIGHTS_KEY = "telos_highlights";
const NOTES_KEY = "telos_notes";
const READING_STATE_KEY = "telos_reading_state";
const DICTIONARY_ENTRIES_KEY = "telos_dictionary_entries";
const STUDY_INDEX_KEY = "telos_study_indices";
const STUDY_STORAGE_EVENT = "telos-study-storage-change";

function readLocalValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const data = window.localStorage.getItem(key);
    return data ? (JSON.parse(data) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(STUDY_STORAGE_EVENT, { detail: { key } }));
}

export function subscribeToLocalStudyData(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleCustomEvent = () => onChange();
  const handleStorage = (event: StorageEvent) => {
    if (
      [
        HIGHLIGHTS_KEY,
        NOTES_KEY,
        READING_STATE_KEY,
        DICTIONARY_ENTRIES_KEY,
        STUDY_INDEX_KEY,
      ].includes(event.key ?? "")
    ) {
      onChange();
    }
  };

  window.addEventListener(STUDY_STORAGE_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorage);

  return () => {
    window.removeEventListener(STUDY_STORAGE_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
  };
}

export function getLocalHighlights(): Highlight[] {
  return readLocalValue<Highlight[]>(HIGHLIGHTS_KEY, []);
}

export function saveLocalHighlight(highlight: Highlight) {
  const highlights = getLocalHighlights();
  const index = highlights.findIndex((item) => item.id === highlight.id);

  if (index >= 0) {
    highlights[index] = highlight;
  } else {
    highlights.push(highlight);
  }

  writeLocalValue(HIGHLIGHTS_KEY, highlights);
}

export function deleteLocalHighlight(id: string) {
  writeLocalValue(
    HIGHLIGHTS_KEY,
    getLocalHighlights().filter((highlight) => highlight.id !== id)
  );
}

export function getLocalNotes(): Note[] {
  return readLocalValue<Note[]>(NOTES_KEY, []);
}

export function saveLocalNote(note: Note) {
  const notes = getLocalNotes();
  const index = notes.findIndex((item) => item.id === note.id);

  if (index >= 0) {
    notes[index] = note;
  } else {
    notes.push(note);
  }

  writeLocalValue(NOTES_KEY, notes);
}

export function deleteLocalNote(id: string) {
  writeLocalValue(
    NOTES_KEY,
    getLocalNotes().filter((note) => note.id !== id)
  );
}

export function getLocalReadingState(): ReadingState | null {
  return readLocalValue<ReadingState | null>(READING_STATE_KEY, null);
}

export function saveLocalReadingState(readingState: ReadingState) {
  writeLocalValue(READING_STATE_KEY, readingState);
}

export function getLocalDictionaryEntries(): DictionaryEntry[] {
  return readLocalValue<DictionaryEntry[]>(DICTIONARY_ENTRIES_KEY, []);
}

export function saveLocalDictionaryEntries(entries: DictionaryEntry[]) {
  writeLocalValue(DICTIONARY_ENTRIES_KEY, entries);
}

export function getLocalStudyIndices(): StudyIndexEntry[] {
  return readLocalValue<StudyIndexEntry[]>(STUDY_INDEX_KEY, []);
}

export function saveLocalStudyIndices(entries: StudyIndexEntry[]) {
  writeLocalValue(STUDY_INDEX_KEY, entries);
}
