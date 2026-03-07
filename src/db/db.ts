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
  profile?: string;
  work_id?: string;
  canonical_book_id?: string;
  chapter?: number | null;
  verse?: number | null;
  reference_label?: string;
  quote?: string;
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
  profile?: string;
  work_id?: string;
  canonical_book_id?: string;
  chapter?: number | null;
  verse?: number | null;
  reference_label?: string;
  quote?: string;
  text: string;
  tags?: string[];
  created_at: number;
  updated_at: number;
}

export interface NoteQuery {
  block_id?: string | null;
  work_id?: string | null;
  canonical_book_id?: string | null;
  chapter?: number | null;
  tags?: string[];
  search?: string | null;
}

export interface ReadingState {
  id: string;
  profile: string;
  book_id: string;
  chapter: number;
  secondary_profile?: string | null;
  updated_at: number;
}

export type PreferredWorkspace = "reader" | "planner";

export type LessonPlanType =
  | "elders-quorum"
  | "gospel-doctrine"
  | "talk-prep"
  | "custom";

export type LessonPlanStatus = "draft" | "archived";

export type LessonBlockKind =
  | "heading"
  | "text"
  | "scripture"
  | "quote"
  | "question"
  | "checklist";

export type LessonSourceType = "scripture" | "note" | "quote" | "manual";

export interface LessonPlan {
  id: string;
  title: string;
  type: LessonPlanType;
  status: LessonPlanStatus;
  body_markdown?: string;
  last_opened_at: number;
  created_at: number;
  updated_at: number;
}

export interface LessonBlock {
  id: string;
  lesson_plan_id: string;
  kind: LessonBlockKind;
  content: string;
  order: number;
  source_id?: string;
  reference_label?: string;
  anchor?: TextAnchor;
}

export interface LessonSource {
  id: string;
  lesson_plan_id: string;
  source_type: LessonSourceType;
  label: string;
  content: string;
  reference_label?: string;
  anchor?: TextAnchor;
  note_id?: string;
  created_at: number;
}

export interface PlannerState {
  id: string;
  last_opened_plan_id?: string | null;
  preferred_workspace?: PreferredWorkspace | null;
  pinned_plan_ids?: string[];
  updated_at: number;
}

export type AppPaneType =
  | "reading"
  | "plannerHome"
  | "plannerOutline"
  | "notes"
  | "captureTray";

export interface ReadingPaneState {
  profile: string | null;
  book_id: string | null;
  chapter: number;
  sync_group_id?: string | null;
  linked_to_pane_id?: string | null;
  show_comparison_diffs?: boolean;
}

export interface PlannerHomePaneState {
  emphasis?: "recent" | "templates";
}

export interface PlannerOutlinePaneState {
  plan_id: string | null;
}

export interface NotesPaneState {
  draft_anchor?: TextAnchor | null;
  scope?: NotesPaneScope;
  selected_note_id?: string | null;
}

export type NotesPaneScope = "currentWork" | "currentChapter" | "allNotes";

export interface CaptureTrayPaneState {
  plan_id: string | null;
}

export type AppPaneDescriptor =
  | { id: string; type: "reading"; state: ReadingPaneState }
  | { id: string; type: "plannerHome"; state: PlannerHomePaneState }
  | { id: string; type: "plannerOutline"; state: PlannerOutlinePaneState }
  | { id: string; type: "notes"; state: NotesPaneState }
  | { id: string; type: "captureTray"; state: CaptureTrayPaneState };

export interface ShellLayoutState {
  id: string;
  active_pane_id: string | null;
  panes: AppPaneDescriptor[];
  pane_widths?: Record<string, number>;
  updated_at: number;
}

const HIGHLIGHTS_KEY = "telos_highlights";
const NOTES_KEY = "telos_notes";
const READING_STATE_KEY = "telos_reading_state";
const DICTIONARY_ENTRIES_KEY = "telos_dictionary_entries";
const STUDY_INDEX_KEY = "telos_study_indices";
const LESSON_PLANS_KEY = "telos_lesson_plans";
const LESSON_BLOCKS_KEY = "telos_lesson_blocks";
const LESSON_SOURCES_KEY = "telos_lesson_sources";
const PLANNER_STATE_KEY = "telos_planner_state";
const SHELL_LAYOUT_STATE_KEY = "telos_shell_layout_state";
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
        LESSON_PLANS_KEY,
        LESSON_BLOCKS_KEY,
        LESSON_SOURCES_KEY,
        PLANNER_STATE_KEY,
        SHELL_LAYOUT_STATE_KEY,
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

export function getLocalLessonPlans(): LessonPlan[] {
  return readLocalValue<LessonPlan[]>(LESSON_PLANS_KEY, []);
}

export function saveLocalLessonPlan(lessonPlan: LessonPlan) {
  const plans = getLocalLessonPlans();
  const index = plans.findIndex((item) => item.id === lessonPlan.id);

  if (index >= 0) {
    plans[index] = lessonPlan;
  } else {
    plans.push(lessonPlan);
  }

  writeLocalValue(LESSON_PLANS_KEY, plans);
}

export function deleteLocalLessonPlan(id: string) {
  writeLocalValue(
    LESSON_PLANS_KEY,
    getLocalLessonPlans().filter((plan) => plan.id !== id)
  );
  writeLocalValue(
    LESSON_BLOCKS_KEY,
    getLocalLessonBlocks().filter((block) => block.lesson_plan_id !== id)
  );
  writeLocalValue(
    LESSON_SOURCES_KEY,
    getLocalLessonSources().filter((source) => source.lesson_plan_id !== id)
  );
}

export function getLocalLessonBlocks(planId?: string): LessonBlock[] {
  const blocks = readLocalValue<LessonBlock[]>(LESSON_BLOCKS_KEY, []);
  return planId ? blocks.filter((block) => block.lesson_plan_id === planId) : blocks;
}

export function saveLocalLessonBlock(lessonBlock: LessonBlock) {
  const blocks = getLocalLessonBlocks();
  const index = blocks.findIndex((item) => item.id === lessonBlock.id);

  if (index >= 0) {
    blocks[index] = lessonBlock;
  } else {
    blocks.push(lessonBlock);
  }

  writeLocalValue(LESSON_BLOCKS_KEY, blocks);
}

export function deleteLocalLessonBlock(id: string) {
  writeLocalValue(
    LESSON_BLOCKS_KEY,
    getLocalLessonBlocks().filter((block) => block.id !== id)
  );
}

export function getLocalLessonSources(planId?: string): LessonSource[] {
  const sources = readLocalValue<LessonSource[]>(LESSON_SOURCES_KEY, []);
  return planId ? sources.filter((source) => source.lesson_plan_id === planId) : sources;
}

export function saveLocalLessonSource(lessonSource: LessonSource) {
  const sources = getLocalLessonSources();
  const index = sources.findIndex((item) => item.id === lessonSource.id);

  if (index >= 0) {
    sources[index] = lessonSource;
  } else {
    sources.push(lessonSource);
  }

  writeLocalValue(LESSON_SOURCES_KEY, sources);
}

export function deleteLocalLessonSource(id: string) {
  writeLocalValue(
    LESSON_SOURCES_KEY,
    getLocalLessonSources().filter((source) => source.id !== id)
  );
}

export function getLocalPlannerState(): PlannerState | null {
  return readLocalValue<PlannerState | null>(PLANNER_STATE_KEY, null);
}

export function saveLocalPlannerState(plannerState: PlannerState) {
  writeLocalValue(PLANNER_STATE_KEY, plannerState);
}

export function getLocalShellLayoutState(): ShellLayoutState | null {
  return readLocalValue<ShellLayoutState | null>(SHELL_LAYOUT_STATE_KEY, null);
}

export function saveLocalShellLayoutState(shellLayoutState: ShellLayoutState) {
  writeLocalValue(SHELL_LAYOUT_STATE_KEY, shellLayoutState);
}
