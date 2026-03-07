import { useEffect, useState, type PointerEventHandler } from "react";
import type { Note, TextAnchor } from "../db/db";
import { useAuth } from "../context/AuthContext";
import { WorkspacePaneShell } from "./WorkspacePaneShell";

interface NotesPaneProps {
  draftNoteTarget?: TextAnchor | null;
  activePlanLabel?: string | null;
  isActive?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
  onClearDraft?: () => void;
  onSendToPlan?: (note: Note) => Promise<void> | void;
}

export function NotesPane({
  draftNoteTarget,
  activePlanLabel,
  isActive,
  onFocus,
  onClose,
  onHeaderPointerDown,
  onClearDraft,
  onSendToPlan,
}: NotesPaneProps) {
  const { repository } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => repository.subscribeNotes(setNotes), [repository]);

  const handleSave = async () => {
    if (!draftNoteTarget || !draftText.trim()) return;
    setSaveError(null);
    setIsSaving(true);

    const tags = draftTags.split(",").map((tag) => tag.trim()).filter(Boolean);
    const now = Date.now();

    try {
      await repository.saveNote({
        id: crypto.randomUUID(),
        block_id: draftNoteTarget.block_id,
        anchor: draftNoteTarget,
        text: draftText.trim(),
        tags: tags.length ? tags : undefined,
        created_at: now,
        updated_at: now,
      });
      setDraftText("");
      setDraftTags("");
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
      meta={`${notes.length} saved`}
      isActive={isActive}
      onFocus={onFocus}
      onClose={onClose}
      onHeaderPointerDown={onHeaderPointerDown}
    >
      <div className="h-full min-h-0 overflow-y-auto p-5">
        <div className="shell-block mb-5">
          <p className="shell-kicker">What Lives Here</p>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            Notes are your own reflections, interpretations, and tagged observations.
            When one becomes useful for teaching, attach that note to a plan or document.
          </p>
        </div>

        {draftNoteTarget && (
          <div className="shell-block mb-5">
            <p className="shell-kicker">New Note</p>
            <p className="mt-2 break-all text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              {draftNoteTarget.block_id}
            </p>
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

        {notes.length === 0 && !draftNoteTarget ? (
          <div className="shell-empty-state">
            <p className="shell-serif text-lg italic text-white/90">Nothing written yet.</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
              Select text in a reading pane and turn it into a note from the workspace.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...notes].sort((a, b) => b.updated_at - a.updated_at).map((note) => (
              <article key={note.id} className="shell-list-item">
                <p className="shell-kicker">{note.block_id}</p>
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
                      onClick={() => {
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
                      onClick={() => {
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
    </WorkspacePaneShell>
  );
}
