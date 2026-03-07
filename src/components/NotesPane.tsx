import { useEffect, useMemo, useRef, useState, type PointerEventHandler } from "react";
import type { Note, NoteQuery, NotesPaneScope, TextAnchor } from "../db/db";
import { useAuth } from "../context/AuthContext";
import { WorkspacePaneShell } from "./WorkspacePaneShell";

const SCOPE_OPTIONS: Array<{ id: NotesPaneScope; label: string }> = [
  { id: "currentWork", label: "Current Work" },
  { id: "currentChapter", label: "Current Chapter" },
  { id: "allNotes", label: "All Notes" },
];

function getWorkLabel(workId?: string | null) {
  if (!workId) return "Current Work";
  if (workId === "bom") return "Book of Mormon";
  if (workId === "dc") return "Doctrine and Covenants";
  if (workId === "pgp") return "Pearl of Great Price";
  if (workId === "bible") return "Bible";
  return workId.toUpperCase();
}

interface NotesPaneProps {
  draftNoteTarget?: TextAnchor | null;
  activePlanLabel?: string | null;
  activeReadingContext?: {
    workId: string | null;
    bookLabel: string | null;
    canonicalBookId: string | null;
    chapter: number | null;
  };
  scope?: NotesPaneScope;
  selectedNoteId?: string | null;
  isActive?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
  onClearDraft?: () => void;
  onChangeScope?: (scope: NotesPaneScope) => void;
  onSelectNote?: (noteId: string | null) => void;
  onSendToPlan?: (note: Note) => Promise<void> | void;
}

export function NotesPane({
  draftNoteTarget,
  activePlanLabel,
  activeReadingContext,
  scope = "currentWork",
  selectedNoteId,
  isActive,
  onFocus,
  onClose,
  onHeaderPointerDown,
  onClearDraft,
  onChangeScope,
  onSelectNote,
  onSendToPlan,
}: NotesPaneProps) {
  const { repository } = useAuth();
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const selectedNoteRef = useRef<HTMLElement | null>(null);

  const activeScopeQuery = useMemo<NoteQuery | null>(() => {
    if (scope === "allNotes") return {};
    if (!activeReadingContext?.workId) return null;

    if (scope === "currentChapter") {
      if (!activeReadingContext.canonicalBookId || !activeReadingContext.chapter) return null;
      return {
        work_id: activeReadingContext.workId,
        canonical_book_id: activeReadingContext.canonicalBookId,
        chapter: activeReadingContext.chapter,
      };
    }

    return { work_id: activeReadingContext.workId };
  }, [activeReadingContext, scope]);

  useEffect(() => repository.subscribeNotes(setAllNotes), [repository]);

  useEffect(() => {
    if (activeScopeQuery === null) {
      setNotes([]);
      return;
    }

    return repository.subscribeNotesByFilter(activeScopeQuery, setNotes);
  }, [activeScopeQuery, repository]);

  useEffect(() => {
    if (!selectedNoteId) return;
    selectedNoteRef.current?.scrollIntoView({ block: "nearest" });
  }, [notes, selectedNoteId]);

  const visibleNotes = notes;
  const totalNotes = allNotes.length;
  const scopeMeta = useMemo(() => {
    if (scope === "currentChapter" && activeReadingContext?.bookLabel && activeReadingContext.chapter) {
      return `${activeReadingContext.bookLabel} ${activeReadingContext.chapter}`;
    }
    if (scope === "currentWork") {
      return getWorkLabel(activeReadingContext?.workId);
    }
    return "All Resources";
  }, [activeReadingContext, scope]);

  const handleSave = async () => {
    if (!draftNoteTarget || !draftText.trim()) return;
    setSaveError(null);
    setIsSaving(true);

    const tags = draftTags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const now = Date.now();

    try {
      const savedNote: Note = {
        id: crypto.randomUUID(),
        block_id: draftNoteTarget.block_id,
        anchor: draftNoteTarget,
        profile: draftNoteTarget.profile,
        work_id: draftNoteTarget.work_id,
        canonical_book_id: draftNoteTarget.canonical_book_id,
        chapter: draftNoteTarget.chapter ?? null,
        verse: draftNoteTarget.verse ?? null,
        reference_label: draftNoteTarget.reference_label,
        quote: draftNoteTarget.quote,
        text: draftText.trim(),
        tags: tags.length ? tags : undefined,
        created_at: now,
        updated_at: now,
      };
      await repository.saveNote(savedNote);
      setDraftText("");
      setDraftTags("");
      onSelectNote?.(savedNote.id);
      onClearDraft?.();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save note. Check sync/auth and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <WorkspacePaneShell
      kicker="Notes"
      title="Annotations"
      meta={`${visibleNotes.length} shown${scope !== "allNotes" ? ` · ${totalNotes} total` : ""}`}
      isActive={isActive}
      onFocus={onFocus}
      onClose={onClose}
      onHeaderPointerDown={onHeaderPointerDown}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="shell-block mb-5">
          <p className="shell-kicker">What Lives Here</p>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            Notes are your own reflections, interpretations, and tagged observations.
            Use the scoped views below to stay close to the text you are studying, then
            pull useful notes into a lesson plan or document when they are ready.
          </p>
        </div>

        <div className="shell-block mb-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="shell-kicker">View</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">{scopeMeta}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {SCOPE_OPTIONS.map((option) => {
                const isDisabled = option.id !== "allNotes" && activeScopeQuery === null;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onChangeScope?.(option.id)}
                    disabled={isDisabled}
                    className={`shell-button ${scope === option.id ? "shell-button-primary" : ""}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {draftNoteTarget && (
          <div className="shell-block mb-5">
            <p className="shell-kicker">New Note</p>
            <p className="mt-2 break-all text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              {draftNoteTarget.reference_label ?? draftNoteTarget.block_id}
            </p>
            {draftNoteTarget.quote && (
              <blockquote className="mt-4 border-l border-[var(--border-color)] pl-4 text-sm italic leading-6 text-[var(--text-secondary)]">
                {draftNoteTarget.quote}
              </blockquote>
            )}
            <textarea
              autoFocus
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Write your thoughts..."
              className="shell-textarea mt-4"
            />
            <input
              type="text"
              value={draftTags}
              onChange={(event) => setDraftTags(event.target.value)}
              placeholder="Tags (comma separated)"
              className="shell-input mt-3"
            />
            {saveError && <p className="mt-3 text-sm text-[#ff3333]">{saveError}</p>}
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setDraftText("");
                  setDraftTags("");
                  setSaveError(null);
                  onClearDraft?.();
                }}
                className="shell-button"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={!draftText.trim() || isSaving}
                className="shell-button shell-button-primary"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {visibleNotes.length === 0 && !draftNoteTarget ? (
          <div className="shell-empty-state">
            <p className="shell-serif text-lg italic text-white/90">
              {scope === "allNotes" ? "Nothing written yet." : "Nothing in this scope yet."}
            </p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
              {activeScopeQuery === null && scope !== "allNotes"
                ? "Open a reading pane to anchor the notes view to a current work or chapter."
                : "Select text in a reading pane and turn it into a note from the workspace."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleNotes.map((note) => (
              <article
                key={note.id}
                ref={selectedNoteId === note.id ? selectedNoteRef : null}
                className={`shell-list-item ${selectedNoteId === note.id ? "border-[var(--border-strong)] bg-[var(--surface-overlay)]" : ""}`}
                onClick={() => onSelectNote?.(note.id)}
              >
                <p className="shell-kicker">{note.reference_label ?? note.block_id}</p>
                {note.quote && (
                  <blockquote className="mt-4 border-l border-[var(--border-color)] pl-4 text-sm italic leading-6 text-[var(--text-secondary)]">
                    {note.quote}
                  </blockquote>
                )}
                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--text-primary)]">
                  {note.text}
                </p>
                {note.tags?.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {note.tags.map((tag) => (
                      <span key={tag} className="shell-meta">
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-4 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  <span>{new Date(note.created_at).toLocaleDateString()}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (!onSendToPlan) return;
                        void onSendToPlan(note);
                      }}
                      disabled={!onSendToPlan}
                      title={activePlanLabel ? `Send to ${activePlanLabel}` : "Open a plan first"}
                      className="shell-button"
                    >
                      Send To Plan
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (selectedNoteId === note.id) onSelectNote?.(null);
                        repository.deleteNote(note.id).catch(console.error);
                      }}
                      className="shell-button shell-button-danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        </div>
      </div>
    </WorkspacePaneShell>
  );
}
