import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ReadingPane } from "./components/ReadingPane";
import { NotesPanel } from "./components/NotesPanel";
import { CommandPalette } from "./components/CommandPalette";
import { LandingPage } from "./components/LandingPage";
import type { BookEntry, TranslationManifest } from "./lib/scripture";
import { loadManifest } from "./lib/scripture";
import { useAuth } from "./context/AuthContext";
import type { TextAnchor } from "./db/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeBookKey(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFirstChapterValue(book: BookEntry | null) {
  if (!book) return 1;
  return (
    book.chapters.find((c) => typeof c.chapter === "number")?.chapter ||
    book.chapters[0]?.chapter ||
    1
  );
}

function findMatchingBook(
  translation: TranslationManifest | undefined,
  activeBook: BookEntry | null
) {
  if (!translation || !activeBook) return null;
  const key  = normalizeBookKey(activeBook.canonical_book_id || activeBook.book_id);
  const name = normalizeBookKey(activeBook.name);
  return (
    translation.books.find((b) => normalizeBookKey(b.canonical_book_id || b.book_id) === key) ||
    translation.books.find((b) => normalizeBookKey(b.name) === name) ||
    null
  );
}

// ─── Pane model ───────────────────────────────────────────────────────────────

export interface PaneState {
  id: string;
  profile: string | null; // null = empty, no resource selected
  book: BookEntry | null;
  chapter: number;
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const { user, status, repository, mode, signOut } = useAuth();
  const [manifests, setManifests] = useState<TranslationManifest[]>([]);

  const [panes, setPanes] = useState<PaneState[]>([
    { id: "main", profile: "lds-bom", book: null, chapter: 1 },
  ]);
  const [activePaneId, setActivePaneId] = useState("main");

  const [showComparisonDiffs, setShowComparisonDiffs] = useState(true);
  const [syncBlockId, setSyncBlockId]         = useState<string | null>(null);
  const [draftNoteTarget, setDraftNoteTarget] = useState<TextAnchor | null>(null);
  const [hasHydratedLocation, setHasHydratedLocation] = useState(false);

  const activePane = panes.find((p) => p.id === activePaneId) ?? panes[0];

  // ── Load manifest ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    loadManifest().then((m) => { if (!cancelled) setManifests(m); });
    return () => { cancelled = true; };
  }, []);

  // ── Hydrate reading state ────────────────────────────────────────────────────
  useEffect(() => {
    if (!manifests.length) return;
    let cancelled = false;

    async function hydrate() {
      const defaultTranslation = manifests.find((e) => e.profile === "lds-bom") || manifests[0];
      const saved = await repository.getReadingState();
      if (cancelled) return;

      const translation = manifests.find((e) => e.profile === saved?.profile) || defaultTranslation;
      const book =
        translation?.books.find((e) => e.book_id === saved?.book_id) ||
        translation?.books[0] ||
        null;
      const chapter =
        book?.chapters.some((e) => e.chapter === saved?.chapter) && saved?.chapter
          ? saved.chapter
          : getFirstChapterValue(book);

      const initialPanes: PaneState[] = [
        { id: "main", profile: translation?.profile || "lds-bom", book, chapter },
      ];

      // Restore secondary pane if it was open
      if (saved?.secondary_profile) {
        const secTranslation = manifests.find((m) => m.profile === saved.secondary_profile);
        if (secTranslation) {
          const secBook = findMatchingBook(secTranslation, book);
          initialPanes.push({
            id: "secondary",
            profile: saved.secondary_profile,
            book: secBook ?? secTranslation.books[0] ?? null,
            chapter,
          });
        }
      }

      setPanes(initialPanes);
      setHasHydratedLocation(true);
    }

    hydrate().catch(() => setHasHydratedLocation(true));
    return () => { cancelled = true; setHasHydratedLocation(false); };
  }, [manifests, repository]);

  // ── Persist reading state ────────────────────────────────────────────────────
  useEffect(() => {
    const primary = panes[0];
    if (!primary.book || !hasHydratedLocation) return;
    const timeout = window.setTimeout(() => {
      repository.saveReadingState({
        id: "default",
        profile: primary.profile ?? "lds-bom",
        book_id: primary.book!.book_id,
        chapter: primary.chapter,
        secondary_profile: panes[1]?.profile ?? null,
        updated_at: Date.now(),
      }).catch(console.error);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [panes, hasHydratedLocation, repository]);

  // ── Pane mutations ────────────────────────────────────────────────────────────

  const updatePane = useCallback((paneId: string, updates: Partial<Omit<PaneState, "id">>) => {
    setPanes((prev) => prev.map((p) => (p.id === paneId ? { ...p, ...updates } : p)));
  }, []);

  const addPane = useCallback(
    (afterPaneId: string) => {
      // Pick first translation not already open
      const usedProfiles = new Set(panes.map((p) => p.profile).filter(Boolean));
      const nextManifest = manifests.find((m) => !usedProfiles.has(m.profile)) ?? null;
      const primaryBook = panes[0].book;
      const matchingBook = nextManifest && primaryBook
        ? findMatchingBook(nextManifest, primaryBook) ?? nextManifest.books[0] ?? null
        : nextManifest?.books[0] ?? null;

      const newPane: PaneState = {
        id: crypto.randomUUID(),
        profile: nextManifest?.profile ?? null,
        book: matchingBook,
        chapter: nextManifest && matchingBook ? panes[0].chapter : 1,
      };

      setPanes((prev) => {
        const idx = prev.findIndex((p) => p.id === afterPaneId);
        const next = [...prev];
        next.splice(idx + 1, 0, newPane);
        return next;
      });
      setActivePaneId(newPane.id);
    },
    [panes, manifests]
  );

  const closePane = useCallback(
    (paneId: string) => {
      if (panes.length <= 1) return;
      const idx = panes.findIndex((p) => p.id === paneId);
      const remaining = panes.filter((p) => p.id !== paneId);
      if (activePaneId === paneId) {
        setActivePaneId(remaining[Math.min(idx, remaining.length - 1)].id);
      }
      setPanes(remaining);
    },
    [panes, activePaneId]
  );

  // ── Per-pane navigation ───────────────────────────────────────────────────────

  const navigatePane = useCallback(
    (paneId: string, direction: "prev" | "next") => {
      const pane = panes.find((p) => p.id === paneId);
      if (!pane?.book || !pane.profile) return;
      const translation = manifests.find((m) => m.profile === pane.profile);
      if (!translation) return;
      const ci = pane.book.chapters.findIndex((c) => c.chapter === pane.chapter);

      if (direction === "prev") {
        if (ci > 0) {
          updatePane(paneId, { chapter: pane.book.chapters[ci - 1].chapter || getFirstChapterValue(pane.book) });
        } else {
          const bi = translation.books.indexOf(pane.book);
          if (bi > 0) {
            const prev = translation.books[bi - 1];
            updatePane(paneId, {
              book: prev,
              chapter: [...prev.chapters].reverse().find((c) => typeof c.chapter === "number")?.chapter || getFirstChapterValue(prev),
            });
          }
        }
      } else {
        if (ci < pane.book.chapters.length - 1) {
          updatePane(paneId, { chapter: pane.book.chapters[ci + 1].chapter || getFirstChapterValue(pane.book) });
        } else {
          const bi = translation.books.indexOf(pane.book);
          if (bi < translation.books.length - 1) {
            const next = translation.books[bi + 1];
            updatePane(paneId, { book: next, chapter: getFirstChapterValue(next) });
          }
        }
      }
    },
    [panes, manifests, updatePane]
  );

  const hasPaneNav = useCallback(
    (paneId: string, direction: "prev" | "next"): boolean => {
      const pane = panes.find((p) => p.id === paneId);
      if (!pane?.book || !pane.profile) return false;
      const translation = manifests.find((m) => m.profile === pane.profile);
      if (!translation) return false;
      const ci = pane.book.chapters.findIndex((c) => c.chapter === pane.chapter);
      if (direction === "prev") {
        return ci > 0 || translation.books.indexOf(pane.book) > 0;
      } else {
        return (
          ci < pane.book.chapters.length - 1 ||
          translation.books.indexOf(pane.book) < translation.books.length - 1
        );
      }
    },
    [panes, manifests]
  );

  // ── Sidebar → active pane ──────────────────────────────────────────────────

  const handleSidebarSelectTranslation = useCallback(
    (profile: string) => {
      const translation = manifests.find((m) => m.profile === profile);
      const currentBook = activePane.book;
      const match = translation && currentBook ? findMatchingBook(translation, currentBook) : null;
      updatePane(activePaneId, {
        profile,
        book: match ?? translation?.books[0] ?? null,
        chapter: match ? activePane.chapter : getFirstChapterValue(translation?.books[0] ?? null),
      });
    },
    [activePaneId, manifests, activePane, updatePane]
  );

  const handleSidebarSelectBook = useCallback(
    (book: BookEntry) => {
      updatePane(activePaneId, { book, chapter: getFirstChapterValue(book) });
    },
    [activePaneId, updatePane]
  );

  // ── Guards ────────────────────────────────────────────────────────────────────

  if (status === "loading" || status === "anonymous") {
    return <LandingPage />;
  }

  const primaryPane = panes[0];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      <Sidebar
        manifests={manifests}
        activeProfile={activePane.profile ?? primaryPane.profile ?? "lds-bom"}
        activeBookId={activePane.book?.book_id ?? null}
        activeChapter={activePane.chapter}
        authStatus={status}
        authMode={mode}
        userName={user?.displayName || user?.email || null}
        onSignOut={signOut}
        onSelectTranslation={handleSidebarSelectTranslation}
        onSelectBook={handleSidebarSelectBook}
        onSelectChapter={(chapter) => updatePane(activePaneId, { chapter })}
      />

      {panes.map((pane, idx) => (
        <div
          key={pane.id}
          className={`flex-1 flex min-w-0 ${idx > 0 ? "border-l border-[var(--border-color)]" : ""}`}
          onPointerDown={() => setActivePaneId(pane.id)}
        >
          <ReadingPane
            profile={pane.profile ?? ""}
            book={pane.book}
            chapter={pane.chapter}
            onPrev={() => navigatePane(pane.id, "prev")}
            onNext={() => navigatePane(pane.id, "next")}
            hasPrev={hasPaneNav(pane.id, "prev")}
            hasNext={hasPaneNav(pane.id, "next")}
            manifests={manifests}
            onChangeProfile={(profile) => {
              const translation = manifests.find((m) => m.profile === profile);
              const match = translation && pane.book ? findMatchingBook(translation, pane.book) : null;
              updatePane(pane.id, {
                profile,
                book: match ?? translation?.books[0] ?? null,
              });
            }}
            onSelectBook={(book) => updatePane(pane.id, { book, chapter: getFirstChapterValue(book) })}
            onSelectChapter={(chapter) => updatePane(pane.id, { chapter })}
            onAddPane={() => addPane(pane.id)}
            onClose={panes.length > 1 ? () => closePane(pane.id) : undefined}
            // All panes after the first compare vs pane 0
            comparisonProfile={idx > 0 ? (primaryPane.profile ?? undefined) : undefined}
            comparisonBook={idx > 0 ? primaryPane.book : undefined}
            showComparisonDiffs={idx > 0 ? showComparisonDiffs : false}
            onToggleComparisonDiffs={idx > 0 ? () => setShowComparisonDiffs((v) => !v) : undefined}
            isActivePane={pane.id === activePaneId}
            onVisibleBlockChange={pane.id === activePaneId ? setSyncBlockId : undefined}
            syncBlockId={pane.id !== activePaneId ? (syncBlockId ?? undefined) : undefined}
            onAddNote={setDraftNoteTarget}
          />
        </div>
      ))}

      <NotesPanel draftNoteTarget={draftNoteTarget} onClearDraft={() => setDraftNoteTarget(null)} />

      <CommandPalette
        manifests={manifests}
        onSelect={(profile, book, chapter) => {
          updatePane(activePaneId, { profile, book, chapter });
        }}
      />
    </div>
  );
}

export default App;
