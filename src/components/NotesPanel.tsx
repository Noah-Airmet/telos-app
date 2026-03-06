import { useState, useEffect } from "react";
import type { Note, TextAnchor } from "../db/db";
import { useAuth } from "../context/AuthContext";

interface NotesPanelProps {
  draftNoteTarget?: TextAnchor | null;
  onClearDraft?: () => void;
}

export function NotesPanel({ draftNoteTarget, onClearDraft }: NotesPanelProps) {
  const { repository } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draftText, setDraftText] = useState("");
  const [draftTags, setDraftTags] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    return repository.subscribeNotes(setNotes);
  }, [repository]);

  const handleSave = async () => {
    if (!draftNoteTarget || !draftText.trim()) return;
    setSaveError(null);
    setIsSaving(true);

    const tags = draftTags.split(',').map(t => t.trim()).filter(Boolean);

    const newNote: Note = {
      id: crypto.randomUUID(),
      block_id: draftNoteTarget.block_id,
      anchor: draftNoteTarget,
      text: draftText.trim(),
      tags: tags.length > 0 ? tags : undefined,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    try {
      await repository.saveNote(newNote);
      setDraftText("");
      setDraftTags("");
      if (onClearDraft) onClearDraft();
    } catch (error) {
      console.error("Failed to save note.", error);
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save note. Check Firebase rules/auth and try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <aside className="w-80 flex-shrink-0 border-l border-[var(--border-color)] bg-[var(--bg-app)] flex flex-col hidden lg:flex">
      <div className="h-12 flex items-center px-4 border-b border-[var(--border-color)]">
        <h3 className="font-medium text-sm">Notes</h3>
      </div>
      <div className="flex-1 p-4 overflow-y-auto space-y-4">

        {draftNoteTarget && (
          <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-blue-200 dark:border-blue-900">
            <h4 className="text-xs font-semibold mb-2 text-blue-600 dark:text-blue-400">New Note</h4>
            <div className="text-[10px] text-[var(--text-secondary)] mb-1 font-mono break-all">
              {draftNoteTarget.block_id}
            </div>
            {draftNoteTarget.start_offset != null && draftNoteTarget.end_offset != null && (
              <div className="text-[10px] text-[var(--text-secondary)] mb-2">
                Anchored to characters {draftNoteTarget.start_offset}-{draftNoteTarget.end_offset}
              </div>
            )}
            <textarea
              autoFocus
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder="Write your thoughts..."
              className="w-full text-sm bg-transparent border border-gray-200 dark:border-gray-700 rounded p-2 outline-none focus:border-blue-500 min-h-[100px] resize-y mb-2"
            />
            <input
              type="text"
              value={draftTags}
              onChange={(e) => setDraftTags(e.target.value)}
              placeholder="Tags (comma separated)"
              className="w-full text-xs font-mono bg-transparent border border-gray-200 dark:border-gray-700 rounded p-1.5 outline-none focus:border-blue-500 mb-2"
            />
            {saveError && (
              <div className="mb-2 text-xs text-red-600 dark:text-red-400">
                {saveError}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setDraftText("");
                  setDraftTags("");
                  setSaveError(null);
                  if (onClearDraft) onClearDraft();
                }}
                className="text-xs px-2 py-1 text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void handleSave();
                }}
                disabled={!draftText.trim() || isSaving}
                className="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        )}

        {notes.length === 0 && !draftNoteTarget ? (
          <div className="text-sm text-[var(--text-secondary)] text-center mt-10">
            Select text to add a note.
          </div>
        ) : (
          notes.sort((a, b) => b.updated_at - a.updated_at).map(note => (
            <div key={note.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700">
              <div className="text-[10px] text-[var(--text-secondary)] mb-1 font-mono break-all">{note.block_id}</div>
              <p className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">{note.text}</p>

              {note.tags && note.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {note.tags.map(tag => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-[var(--text-secondary)] rounded-full">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2 flex justify-between items-center text-[10px] text-[var(--text-secondary)]">
                <span>{new Date(note.created_at).toLocaleDateString()}</span>
                <button
                  onClick={() => {
                    repository.deleteNote(note.id).catch((error) => {
                      console.error("Failed to delete note.", error);
                    });
                  }}
                  className="hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
