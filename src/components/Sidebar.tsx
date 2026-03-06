import { useEffect, useState } from "react";
import type { BookEntry, TranslationManifest } from "../lib/scripture";
import {
  getLocalDictionaryEntries,
  saveLocalDictionaryEntries,
  subscribeToLocalStudyData,
} from "../db/db";
import { importDictionaryFile } from "../lib/studyTools";

interface SidebarProps {
  manifests: TranslationManifest[];
  activeProfile: string;
  activeBookId: string | null;
  authStatus: "loading" | "anonymous" | "authenticated";
  authMode: "local" | "cloud";
  userName: string | null;
  onSignOut: () => Promise<void>;
  onSelectTranslation: (profile: string) => void;
  onSelectBook: (book: BookEntry) => void;
}

export function Sidebar({
  manifests,
  activeProfile,
  activeBookId,
  authStatus,
  authMode,
  userName,
  onSignOut,
  onSelectTranslation,
  onSelectBook,
}: SidebarProps) {
  const active = manifests.find((m) => m.profile === activeProfile);
  const [dictionaryCount, setDictionaryCount] = useState(0);
  const [dictionaryLabel, setDictionaryLabel] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadDictionaryState = () => {
      const entries = getLocalDictionaryEntries();
      setDictionaryCount(entries.length);
      setDictionaryLabel(entries[0]?.dictionary || null);
    };

    loadDictionaryState();
    return subscribeToLocalStudyData(loadDictionaryState);
  }, []);

  return (
    <aside className="w-64 flex-shrink-0 border-r border-[var(--border-color)] bg-[var(--bg-app)] flex flex-col">
      <div className="px-4 py-3 border-b border-[var(--border-color)] space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-sm">Telos Library</h1>
          <span className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
            {authMode === "cloud" ? "Sync" : "Local"}
          </span>
        </div>

        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] px-3 py-2 space-y-2">
          {authStatus === "authenticated" && (
            <>
              <div className="text-[11px] text-[var(--text-secondary)]">
                Signed in as {userName || "Google user"}
              </div>
              <button
                onClick={() => {
                  void onSignOut();
                }}
                className="w-full rounded-md border border-[var(--border-color)] px-2 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Sign Out
              </button>
            </>
          )}
        </div>

        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-canvas)] px-3 py-2 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-medium text-[var(--text-primary)]">Private Dictionary</div>
            <span className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              {dictionaryCount} entries
            </span>
          </div>
          <div className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
            {dictionaryCount > 0
              ? `Imported ${dictionaryLabel || "dictionary"} locally. Click a word in the reader to look it up.`
              : "Import a personal JSON dictionary file to enable click-to-lookup in the reader."}
          </div>
          <label className="block">
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;

                importDictionaryFile(file)
                  .then((entries) => {
                    saveLocalDictionaryEntries(entries);
                    setImportMessage(`Imported ${entries.length} entries from ${file.name}.`);
                  })
                  .catch((error) => {
                    console.error("Failed to import dictionary.", error);
                    setImportMessage(`Could not import ${file.name}. Expected a JSON dictionary export.`);
                  })
                  .finally(() => {
                    event.target.value = "";
                  });
              }}
            />
            <span className="block w-full rounded-md border border-[var(--border-color)] px-2 py-1.5 text-center text-xs font-medium text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer">
              Import Dictionary JSON
            </span>
          </label>
          {importMessage && (
            <div className="text-[11px] text-[var(--text-secondary)]">
              {importMessage}
            </div>
          )}
        </div>
      </div>

      {/* Translation picker */}
      <div className="flex border-b border-[var(--border-color)]">
        {manifests.map((m) => (
          <button
            key={m.profile}
            onClick={() => onSelectTranslation(m.profile)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              m.profile === activeProfile
                ? "text-[var(--text-primary)] border-b-2 border-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {m.translation}
          </button>
        ))}
      </div>

      {/* Book list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {active?.books.map((book) => (
          <button
            key={book.book_id}
            onClick={() => onSelectBook(book)}
            className={`w-full text-left px-3 py-1.5 text-sm rounded-md transition-colors ${
              book.book_id === activeBookId
                ? "bg-gray-200 dark:bg-gray-800 font-medium text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-800/50"
            }`}
          >
            {book.name}
            <span className="text-xs ml-1 opacity-50">
              {book.chapters.length}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
