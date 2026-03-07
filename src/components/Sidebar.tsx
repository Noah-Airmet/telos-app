import { useEffect, useState, useMemo } from "react";
import type { BookEntry, TranslationManifest } from "../lib/scripture";
import {
  getLocalDictionaryEntries,
  saveLocalDictionaryEntries,
  subscribeToLocalStudyData,
} from "../db/db";
import { importDictionaryFile } from "../lib/studyTools";

// ─── Library schema ───────────────────────────────────────────────────────────
// "profile" links to a live TranslationManifest; undefined = coming soon.
// "type" drives the filter pill system.

type WorkType = "scripture" | "reference" | "conference" | "curriculum" | "imported";

interface WorkEntry {
  id: string;
  label: string;
  meta?: string;
  profile?: string;
  type: WorkType;
}

interface Collection {
  id: string;
  label: string;
  works: WorkEntry[];
}

const LIBRARY: Collection[] = [
  {
    id: "standard-works",
    label: "Standard Works",
    works: [
      { id: "lds-bom",  label: "Book of Mormon",      meta: "2013 Edition · LDS",      profile: "lds-bom",  type: "scripture" },
      { id: "lds-dc",   label: "Doctrine & Covenants", meta: "LDS Edition",                                  type: "scripture" },
      { id: "lds-pogp", label: "Pearl of Great Price", meta: "LDS Edition",                                  type: "scripture" },
      { id: "lds-ot",   label: "Old Testament",        meta: "King James Version",                           type: "scripture" },
      { id: "lds-nt",   label: "New Testament",        meta: "King James Version",                           type: "scripture" },
    ],
  },
  {
    id: "bible-translations",
    label: "Bible Translations",
    works: [
      { id: "kjv",      label: "Holy Bible",           meta: "King James Version · 1611",    profile: "kjv",     type: "scripture" },
      { id: "nrsvue",   label: "Holy Bible",           meta: "NRSVue · 2021",                profile: "nrsvue",  type: "scripture" },
      { id: "esv",      label: "Holy Bible",           meta: "English Standard Version",                          type: "scripture" },
      { id: "jsb",      label: "Jewish Study Bible",   meta: "Oxford · 2nd Ed.",                                  type: "scripture" },
      { id: "nets",     label: "Septuagint",           meta: "NETS Translation",                                  type: "scripture" },
      { id: "njps",     label: "Tanakh",               meta: "New Jewish Publication Society",                    type: "scripture" },
    ],
  },
  {
    id: "commentary",
    label: "Commentary & Reference",
    works: [
      { id: "hardy-bom",    label: "A Commentary on the Book of Mormon", meta: "Hardy",                             profile: "hardy-bom", type: "reference" },
      { id: "skousen",      label: "The Earliest Text",                  meta: "Skousen · Book of Mormon",                               type: "reference" },
      { id: "anchor-bible", label: "Anchor Yale Bible Commentary",       meta: "Vol. I–XLII",                                            type: "reference" },
      { id: "word-biblical",label: "Word Biblical Commentary",          meta: "Multi-volume",                                           type: "reference" },
      { id: "jsb-essays",   label: "Jewish Study Bible Essays",         meta: "Berlin & Brettler",                                      type: "reference" },
      { id: "nibley",       label: "The Collected Works of Hugh Nibley", meta: "19 vols.",                                               type: "reference" },
    ],
  },
  {
    id: "conference",
    label: "General Conference",
    works: [
      { id: "gc-2025-apr", label: "April 2025",    meta: "195th Annual",           type: "conference" },
      { id: "gc-2024-oct", label: "October 2024",  meta: "194th Semi-Annual",      type: "conference" },
      { id: "gc-2024-apr", label: "April 2024",    meta: "194th Annual",           type: "conference" },
      { id: "gc-2023-oct", label: "October 2023",  meta: "193rd Semi-Annual",      type: "conference" },
      { id: "gc-archive",  label: "Full Archive",  meta: "1971 – present",         type: "conference" },
    ],
  },
  {
    id: "manuals",
    label: "Manuals & Curriculum",
    works: [
      { id: "cfm-2025",  label: "Come, Follow Me 2025", meta: "New Testament",              type: "curriculum" },
      { id: "cfm-2024",  label: "Come, Follow Me 2024", meta: "Doctrine & Covenants",       type: "curriculum" },
      { id: "gd-manual", label: "Gospel Doctrine",       meta: "Teacher Manual",            type: "curriculum" },
      { id: "eq-manual", label: "Elders Quorum Manual",  meta: "Teaching in the Savior's Way", type: "curriculum" },
    ],
  },
  {
    id: "my-library",
    label: "My Library",
    works: [], // populated dynamically from imported EPUBs
  },
];

// ─── Filter pill config ───────────────────────────────────────────────────────

type FilterType = "all" | WorkType;

const FILTERS: { id: FilterType; label: string }[] = [
  { id: "all",        label: "All"        },
  { id: "scripture",  label: "Scripture"  },
  { id: "reference",  label: "Reference"  },
  { id: "conference", label: "Conference" },
  { id: "curriculum", label: "Manuals"    },
  { id: "imported",   label: "Imported"   },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SidebarProps {
  manifests: TranslationManifest[];
  activeProfile: string;
  activeBookId: string | null;
  activeChapter: number;
  authStatus: "loading" | "anonymous" | "authenticated";
  authMode: "local" | "cloud";
  userName: string | null;
  onSignOut: () => Promise<void>;
  onCollapse: () => void;
  onResetWorkspaceLayout: () => void;
  onSelectTranslation: (profile: string) => void;
  onSelectBook: (book: BookEntry) => void;
  onSelectChapter: (chapter: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Sidebar({
  manifests,
  activeProfile,
  activeBookId,
  activeChapter,
  authStatus,
  authMode,
  userName,
  onSignOut,
  onCollapse,
  onResetWorkspaceLayout,
  onSelectTranslation,
  onSelectBook,
  onSelectChapter,
}: SidebarProps) {
  const [searchQuery, setSearchQuery]           = useState("");
  const [activeFilter, setActiveFilter]         = useState<FilterType>("all");
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    () => new Set(["standard-works", "bible-translations", "commentary"])
  );
  const [expandedWork, setExpandedWork]         = useState<string | null>(null);
  const [expandedBook, setExpandedBook]         = useState<string | null>(null); // book_id whose chapter grid is open
  const [showSettings, setShowSettings]         = useState(false);
  const [showFilters, setShowFilters]           = useState(false);
  const [dictionaryCount, setDictionaryCount]   = useState(0);
  const [dictionaryLabel, setDictionaryLabel]   = useState<string | null>(null);
  const [importMessage, setImportMessage]       = useState<string | null>(null);

  // Which work entry corresponds to the current activeProfile
  const activeWorkId = useMemo(
    () => LIBRARY.flatMap((c) => c.works).find((w) => w.profile === activeProfile)?.id ?? null,
    [activeProfile]
  );

  // Auto-expand the work + its collection when activeProfile changes
  useEffect(() => {
    if (!activeWorkId) return;
    setExpandedWork((prev) => prev ?? activeWorkId);
    const col = LIBRARY.find((c) => c.works.some((w) => w.id === activeWorkId));
    if (col) setExpandedCollections((prev) => new Set([...prev, col.id]));
  }, [activeWorkId]);

  // Auto-expand the active book's chapter grid
  useEffect(() => {
    if (activeBookId) setExpandedBook(activeBookId);
  }, [activeBookId]);

  // Dictionary state
  useEffect(() => {
    const refresh = () => {
      const entries = getLocalDictionaryEntries();
      setDictionaryCount(entries.length);
      setDictionaryLabel(entries[0]?.dictionary ?? null);
    };
    refresh();
    return subscribeToLocalStudyData(refresh);
  }, []);

  // ── Derived data ─────────────────────────────────────────────────────────────

  const expandedWorkDef = useMemo(
    () => LIBRARY.flatMap((c) => c.works).find((w) => w.id === expandedWork) ?? null,
    [expandedWork]
  );

  const expandedManifest = useMemo(
    () => (expandedWorkDef?.profile ? manifests.find((m) => m.profile === expandedWorkDef.profile) ?? null : null),
    [expandedWorkDef, manifests]
  );

  const filteredLibrary = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return LIBRARY.map((col) => {
      const works = col.works.filter((w) => {
        const typeMatch = activeFilter === "all" || w.type === activeFilter;
        if (!q) return typeMatch;
        return typeMatch && (
          w.label.toLowerCase().includes(q) ||
          (w.meta ?? "").toLowerCase().includes(q)
        );
      });
      return { ...col, works };
    }).filter((col) => {
      // Always show My Library even when empty (shows import CTA)
      if (col.id === "my-library") return activeFilter === "all" || activeFilter === "imported";
      return col.works.length > 0;
    });
  }, [searchQuery, activeFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const toggleCollection = (id: string) => {
    setExpandedCollections((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleWorkClick = (work: WorkEntry) => {
    if (!work.profile) return;
    const isExpanded = expandedWork === work.id;
    setExpandedWork(isExpanded ? null : work.id);
    if (work.profile !== activeProfile) {
      onSelectTranslation(work.profile);
    }
  };

  const liveCount = manifests.length;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <aside className="w-full flex-shrink-0 bg-[var(--bg-app)] flex flex-col select-none">

      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border-color)] flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black uppercase tracking-[-0.06em] leading-none text-white">Telos</h1>
          <p className="shell-kicker mt-2">Library</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`shell-meta ${
            authMode === "cloud"
              ? "text-white"
              : ""
          }`}>
            {authMode === "cloud" ? "Sync" : "Local"}
          </span>
          <button
            onClick={onCollapse}
            title="Collapse library"
            className="h-8 w-8 flex items-center justify-center border border-[var(--border-color)] text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 2.5 4.5 6l4 3.5"/>
            </svg>
          </button>
          <button
            onClick={() => setShowSettings((v) => !v)}
            title="Settings"
            className={`h-8 w-8 flex items-center justify-center border border-[var(--border-color)] text-sm transition-colors ${
              showSettings
                ? "bg-white text-black border-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            {/* gear icon via unicode */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="2.5"/>
              <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Settings drawer ── */}
      {showSettings && (
        <div className="border-b border-[var(--border-color)] bg-[var(--bg-canvas)] divide-y divide-[var(--border-color)]">
          {/* Auth row */}
          <div className="px-4 py-3">
            <p className="shell-kicker mb-2">Account</p>
            {authStatus === "authenticated" ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[var(--text-primary)] truncate">{userName ?? "Google user"}</p>
                  <p className="shell-meta mt-1">Signed in</p>
                </div>
                <button
                  onClick={() => void onSignOut()}
                  className="shell-button whitespace-nowrap"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <p className="text-[11px] text-[var(--text-secondary)]">Not signed in · data is local only</p>
            )}
          </div>

          {/* Dictionary row */}
          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="shell-kicker">Private Dictionary</p>
              {dictionaryCount > 0 && (
                <span className="shell-meta">{dictionaryCount} entries</span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              {dictionaryCount > 0
                ? `${dictionaryLabel ?? "Dictionary"} loaded. Click any word in the reader to look it up.`
                : "Import a JSON dictionary to enable click-to-lookup in the reader."}
            </p>
            <label className="block">
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  importDictionaryFile(file)
                    .then((entries) => {
                      saveLocalDictionaryEntries(entries);
                      setImportMessage(`Imported ${entries.length} entries from ${file.name}.`);
                    })
                    .catch(() => setImportMessage(`Could not import ${file.name}.`))
                    .finally(() => { e.target.value = ""; });
                }}
              />
              <span className="shell-button block w-full text-center cursor-pointer">
                Import Dictionary JSON
              </span>
            </label>
            {importMessage && (
              <p className="text-[10px] text-[var(--text-secondary)]">{importMessage}</p>
            )}
          </div>

          <div className="px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="shell-kicker">Workspace</p>
            </div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Reset the current pane layout and return to the chooser. Your notes, highlights,
              and study data stay intact.
            </p>
            <button
              type="button"
              onClick={onResetWorkspaceLayout}
              className="shell-button shell-button-danger w-full justify-center"
            >
              Reset Workspace Layout
            </button>
          </div>
        </div>
      )}

      {/* ── Search ── */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
            <input
              type="text"
              placeholder="SEARCH LIBRARY..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="shell-input shell-search-input w-full px-3 pr-9"
              style={{
                height: "2.5rem",
                paddingTop: "0",
                paddingBottom: "0",
                fontSize: "0.72rem",
                letterSpacing: "0.24em",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M1 1l10 10M11 1L1 11"/>
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            className={`shell-button shell-icon-button ${showFilters ? "shell-button-primary" : ""}`}
            title="Filters"
            style={{
              height: "2.5rem",
              width: "2.5rem",
              padding: "0",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.5 2.25h9M3.5 6h5M5 9.75h2"/>
            </svg>
          </button>
        </div>
        {showFilters && (
          <div className="mt-2 border border-[var(--border-color)] bg-[var(--surface-overlay)] p-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="shell-kicker">Filters</span>
              <span className="shell-meta">{FILTERS.find((filter) => filter.id === activeFilter)?.label}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFilter(f.id);
                    setShowFilters(false);
                  }}
                  className={`shell-button justify-center px-2 py-2 ${
                    activeFilter === f.id
                      ? "shell-button-primary"
                      : ""
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Library tree ── */}
      <div className="flex-1 overflow-y-auto pb-4">
        {filteredLibrary.map((collection) => {
          const isOpen = expandedCollections.has(collection.id);
          return (
            <div key={collection.id}>

              {/* Collection header */}
              <button
                onClick={() => toggleCollection(collection.id)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left group"
              >
                <svg
                  className={`flex-shrink-0 text-[var(--text-secondary)] transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
                  width="9" height="9" viewBox="0 0 8 8" fill="currentColor"
                >
                  <path d="M2 1l4 3-4 3V1z"/>
                </svg>
                <span className="shell-kicker group-hover:text-[var(--text-primary)] transition-colors">
                  {collection.label}
                </span>
                {collection.works.length > 0 && (
                  <span className="ml-auto shell-meta tabular-nums">
                    {collection.works.filter((w) => w.profile).length}/{collection.works.length}
                  </span>
                )}
              </button>

              {/* Works list */}
              {isOpen && (
                <div className="pb-1">
                  {collection.id === "my-library" && collection.works.length === 0 ? (
                    /* My Library empty state */
                    <div className="mx-3 mb-2 px-3 py-3 border border-dashed border-[var(--border-color)] text-center">
                      <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                        Import any EPUB to read and annotate it alongside your scripture study.
                      </p>
                      <button className="shell-button mt-2">
                        + Import EPUB
                      </button>
                    </div>
                  ) : (
                    collection.works.map((work) => {
                      const isLive     = !!work.profile;
                      const isActive   = work.id === activeWorkId;
                      const isExpanded = expandedWork === work.id;

                      return (
                        <div key={work.id}>
                          {/* Work row */}
                          <button
                            onClick={() => isLive && handleWorkClick(work)}
                            disabled={!isLive}
                            title={!isLive ? `${work.label} — coming soon` : undefined}
                            className={`w-full flex items-start gap-2.5 px-4 py-2 text-left transition-colors ${
                              isActive
                                ? "bg-white/8"
                                : isLive
                                  ? "hover:bg-white/4"
                                  : "opacity-35 cursor-default"
                            }`}
                          >
                            {/* Live indicator dot */}
                            <span className={`flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-[var(--text-primary)]" : isLive ? "bg-[var(--border-color)]" : "bg-transparent border border-[var(--border-color)]"
                            }`} />

                            {/* Title + meta */}
                            <div className="min-w-0 flex-1">
                              <p className={`text-xs leading-snug uppercase tracking-[0.02em] ${isActive ? "font-bold text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}>
                                {work.label}
                              </p>
                              {work.meta && (
                                <p className="shell-meta mt-1 leading-tight">
                                  {work.meta}
                                </p>
                              )}
                            </div>

                            {/* Coming soon badge */}
                            {!isLive && (
                              <span className="flex-shrink-0 mt-0.5 shell-meta">
                                Soon
                              </span>
                            )}

                            {/* Expand chevron for live items */}
                            {isLive && (
                              <svg
                                className={`flex-shrink-0 mt-1 text-[var(--text-secondary)] transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                                width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
                              >
                                <path d="M2 3.5l3 3 3-3"/>
                              </svg>
                            )}
                          </button>

                          {/* Inline book list with chapter drill-down */}
                          {isExpanded && expandedManifest && (
                            <div className="ml-7 mr-2 border-l border-[var(--border-color)] pl-3 pb-1 pt-0.5">
                              {expandedManifest.books.map((book) => {
                                const isActiveBook = book.book_id === activeBookId;
                                const isBookExpanded = expandedBook === book.book_id;

                                return (
                                  <div key={book.book_id}>
                                    {/* Book row */}
                                    <button
                                      onClick={() => {
                                        if (work.profile && work.profile !== activeProfile) {
                                          onSelectTranslation(work.profile);
                                        }
                                        onSelectBook(book);
                                        setExpandedBook(isBookExpanded ? null : book.book_id);
                                      }}
                                    className={`w-full text-left px-2 py-1 text-[11px] transition-colors flex items-center justify-between gap-1 ${
                                        isActiveBook
                                          ? "text-[var(--text-primary)] font-medium"
                                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/5"
                                      }`}
                                    >
                                      <span className="truncate">{book.name}</span>
                                      <span className="flex items-center gap-1 flex-shrink-0">
                                        <span className="opacity-35 text-[10px] tabular-nums">{book.chapters.length}</span>
                                        <svg
                                          className={`opacity-40 transition-transform duration-100 ${isBookExpanded ? "rotate-90" : ""}`}
                                          width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                                        >
                                          <path d="M2 1l4 3-4 3V1z"/>
                                        </svg>
                                      </span>
                                    </button>

                                    {/* Chapter number grid — Finder-column drill-down */}
                                    {isBookExpanded && (
                                      <div
                                        className="px-1 pb-2 pt-1"
                                        onKeyDown={(e) => {
                                          // Arrow key navigation within the chapter grid
                                          const chapters = book.chapters.map((c) => c.chapter).filter((c): c is number => c !== null);
                                          const idx = chapters.indexOf(activeChapter);
                                          if (e.key === "ArrowRight" && idx > -1 && idx < chapters.length - 1) {
                                            e.preventDefault();
                                            onSelectChapter(chapters[idx + 1]);
                                          } else if (e.key === "ArrowLeft" && idx > 0) {
                                            e.preventDefault();
                                            onSelectChapter(chapters[idx - 1]);
                                          } else if (e.key === "ArrowDown" && idx > -1) {
                                            e.preventDefault();
                                            const nextIdx = Math.min(idx + 6, chapters.length - 1);
                                            onSelectChapter(chapters[nextIdx]);
                                          } else if (e.key === "ArrowUp" && idx > -1) {
                                            e.preventDefault();
                                            const prevIdx = Math.max(idx - 6, 0);
                                            onSelectChapter(chapters[prevIdx]);
                                          }
                                        }}
                                      >
                                        <div className="grid grid-cols-6 gap-0.5">
                                          {book.chapters.map((c) => {
                                            const isActiveChapter = isActiveBook && c.chapter === activeChapter;
                                            if (c.chapter === null) return null;
                                            return (
                                              <button
                                                key={c.chapter}
                                                onClick={() => {
                                                  if (work.profile && work.profile !== activeProfile) {
                                                    onSelectTranslation(work.profile);
                                                  }
                                                  if (!isActiveBook) onSelectBook(book);
                                                  onSelectChapter(c.chapter as number);
                                                }}
                                                className={`h-6 text-[10px] transition-colors tabular-nums ${
                                                  isActiveChapter
                                                    ? "bg-white text-black font-semibold"
                                                    : "text-[var(--text-secondary)] hover:bg-white/6 hover:text-[var(--text-primary)]"
                                                }`}
                                              >
                                                {c.chapter}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty search state */}
        {filteredLibrary.length === 0 && (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-[var(--text-secondary)]">No results for</p>
            <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">"{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-4 py-2.5 border-t border-[var(--border-color)] flex items-center justify-between">
        <span className="shell-meta">
          {liveCount} of {LIBRARY.flatMap((c) => c.works).filter((w) => w.profile).length} works available
        </span>
        {authMode === "cloud" && (
          <span className="shell-meta flex items-center gap-1">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M5 8V2M2 5l3-3 3 3"/>
            </svg>
            Synced
          </span>
        )}
      </div>
    </aside>
  );
}
