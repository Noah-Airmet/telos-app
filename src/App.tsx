import { useCallback, useEffect, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { ReadingPane } from "./components/ReadingPane";
import { NotesPanel } from "./components/NotesPanel";
import { CommandPalette } from "./components/CommandPalette";
import type { BookEntry, TranslationManifest } from "./lib/scripture";
import { loadManifest } from "./lib/scripture";
import { useAuth } from "./context/AuthContext";
import type { TextAnchor } from "./db/db";

function normalizeBookKey(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFirstChapterValue(book: BookEntry | null) {
  if (!book) return 1;

  return book.chapters.find((chapter) => typeof chapter.chapter === "number")?.chapter
    || book.chapters[0]?.chapter
    || 1;
}

function findMatchingBook(
  translation: TranslationManifest | undefined,
  activeBook: BookEntry | null
) {
  if (!translation || !activeBook) return null;

  const activeBookKey = normalizeBookKey(activeBook.canonical_book_id || activeBook.book_id);
  const activeBookName = normalizeBookKey(activeBook.name);

  return (
    translation.books.find(
      (book) => normalizeBookKey(book.canonical_book_id || book.book_id) === activeBookKey
    ) ||
    translation.books.find((book) => normalizeBookKey(book.name) === activeBookName) ||
    null
  );
}

function App() {
  const {
    user,
    status,
    repository,
    hasCloudSupport,
    mode,
    signIn,
    signOut,
  } = useAuth();
  const [manifests, setManifests] = useState<TranslationManifest[]>([]);
  const [activeProfile, setActiveProfile] = useState("lds-bom");
  const [secondaryProfile, setSecondaryProfile] = useState<string | null>(null);
  const [activeBook, setActiveBook] = useState<BookEntry | null>(null);
  const [activeChapter, setActiveChapter] = useState(1);
  const [activePane, setActivePane] = useState<"primary" | "secondary">("primary");
  const [syncBlockId, setSyncBlockId] = useState<string | null>(null);
  const [draftNoteTarget, setDraftNoteTarget] = useState<TextAnchor | null>(null);
  const [hasHydratedLocation, setHasHydratedLocation] = useState(false);
  const [showComparisonDiffs, setShowComparisonDiffs] = useState(true);

  // Load manifest on mount
  useEffect(() => {
    let cancelled = false;

    loadManifest().then((m) => {
      if (cancelled) return;
      setManifests(m);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!manifests.length) return;

    let cancelled = false;

    async function hydrateReadingState() {
      const defaultTranslation = manifests.find((entry) => entry.profile === "lds-bom") || manifests[0];
      const readingState = await repository.getReadingState();

      if (cancelled) return;

      const translation =
        manifests.find((entry) => entry.profile === readingState?.profile) || defaultTranslation;
      const book =
        translation?.books.find((entry) => entry.book_id === readingState?.book_id) ||
        translation?.books[0] ||
        null;
      const chapterExists = book?.chapters.some((entry) => entry.chapter === readingState?.chapter);

      setActiveProfile(translation?.profile || "lds-bom");
      setSecondaryProfile(readingState?.secondary_profile || null);
      setActiveBook(book);
      setActiveChapter(
        chapterExists && readingState?.chapter
          ? readingState.chapter
          : getFirstChapterValue(book)
      );
      setHasHydratedLocation(true);
    }

    hydrateReadingState().catch((error) => {
      console.error("Failed to hydrate reading state.", error);
      setHasHydratedLocation(true);
    });

    return () => {
      cancelled = true;
      setHasHydratedLocation(false);
    };
  }, [manifests, repository]);

  const handleSelectTranslation = useCallback(
    (profile: string) => {
      setActiveProfile(profile);
      const translation = manifests.find((m) => m.profile === profile);
      if (translation?.books.length) {
        setActiveBook(translation.books[0]);
        setActiveChapter(getFirstChapterValue(translation.books[0]));
      }
    },
    [manifests]
  );

  const handleSelectBook = useCallback((book: BookEntry) => {
    setActiveBook(book);
    setActiveChapter(getFirstChapterValue(book));
  }, []);

  const chapterIndex = activeBook
    ? activeBook.chapters.findIndex((c) => c.chapter === activeChapter)
    : -1;

  // Find the overall index across all books for prev/next across book boundaries
  const activeTranslation = manifests.find((m) => m.profile === activeProfile);

  useEffect(() => {
    if (!activeBook || !hasHydratedLocation) return;

    const timeout = window.setTimeout(() => {
      repository
        .saveReadingState({
          id: "default",
          profile: activeProfile,
          book_id: activeBook.book_id,
          chapter: activeChapter,
          secondary_profile: secondaryProfile,
          updated_at: Date.now(),
        })
        .catch((error) => {
          console.error("Failed to save reading state.", error);
        });
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeBook, activeChapter, activeProfile, hasHydratedLocation, repository, secondaryProfile]);

  const handlePrev = useCallback(() => {
    if (!activeBook || !activeTranslation) return;
    if (chapterIndex > 0) {
      setActiveChapter(activeBook.chapters[chapterIndex - 1].chapter || getFirstChapterValue(activeBook));
    } else {
      // Go to previous book's last chapter
      const bookIdx = activeTranslation.books.indexOf(activeBook);
      if (bookIdx > 0) {
        const prevBook = activeTranslation.books[bookIdx - 1];
        setActiveBook(prevBook);
        setActiveChapter(
          [...prevBook.chapters]
            .reverse()
            .find((chapter) => typeof chapter.chapter === "number")?.chapter
            || getFirstChapterValue(prevBook)
        );
      }
    }
  }, [activeBook, activeTranslation, chapterIndex]);

  const handleNext = useCallback(() => {
    if (!activeBook || !activeTranslation) return;
    if (chapterIndex < activeBook.chapters.length - 1) {
      setActiveChapter(activeBook.chapters[chapterIndex + 1].chapter || getFirstChapterValue(activeBook));
    } else {
      // Go to next book's first chapter
      const bookIdx = activeTranslation.books.indexOf(activeBook);
      if (bookIdx < activeTranslation.books.length - 1) {
        const nextBook = activeTranslation.books[bookIdx + 1];
        setActiveBook(nextBook);
        setActiveChapter(getFirstChapterValue(nextBook));
      }
    }
  }, [activeBook, activeTranslation, chapterIndex]);

  const hasPrev = (() => {
    if (!activeBook || !activeTranslation) return false;
    if (chapterIndex > 0) return true;
    return activeTranslation.books.indexOf(activeBook) > 0;
  })();

  const hasNext = (() => {
    if (!activeBook || !activeTranslation) return false;
    if (chapterIndex < activeBook.chapters.length - 1) return true;
    return activeTranslation.books.indexOf(activeBook) < activeTranslation.books.length - 1;
  })();

  const secondaryTranslation = manifests.find((m) => m.profile === secondaryProfile);
  const secondaryBook = findMatchingBook(secondaryTranslation, activeBook);

  useEffect(() => {
    if (!secondaryProfile) {
      setShowComparisonDiffs(true);
    }
  }, [secondaryProfile]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      <Sidebar
        manifests={manifests}
        activeProfile={activeProfile}
        activeBookId={activeBook?.book_id ?? null}
        authStatus={status}
        authMode={mode}
        hasCloudSupport={hasCloudSupport}
        userName={user?.displayName || user?.email || null}
        onSignIn={signIn}
        onSignOut={signOut}
        onSelectTranslation={handleSelectTranslation}
        onSelectBook={handleSelectBook}
      />

      <div className="flex-1 flex" onMouseMove={() => setActivePane("primary")} onTouchStart={() => setActivePane("primary")} onWheel={() => setActivePane("primary")}>
        <ReadingPane
          profile={activeProfile}
          book={activeBook}
          chapter={activeChapter}
          onPrev={handlePrev}
          onNext={handleNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          manifests={manifests}
          secondaryProfile={secondaryProfile}
          onSelectSecondaryProfile={setSecondaryProfile}
          comparisonProfile={secondaryProfile}
          comparisonBook={secondaryBook}
          showComparisonDiffs={showComparisonDiffs}
          onToggleComparisonDiffs={() => setShowComparisonDiffs((value) => !value)}
          isActivePane={activePane === "primary"}
          onVisibleBlockChange={setSyncBlockId}
          syncBlockId={activePane === "secondary" ? (syncBlockId || undefined) : undefined}
          onAddNote={setDraftNoteTarget}
        />
      </div>

      {secondaryProfile && (
        <div className="flex-1 flex border-l border-[var(--border-color)]" onMouseMove={() => setActivePane("secondary")} onTouchStart={() => setActivePane("secondary")} onWheel={() => setActivePane("secondary")}>
          <ReadingPane
            profile={secondaryProfile}
            book={secondaryBook}
            chapter={activeChapter}
            onPrev={handlePrev} // secondary pane handles mostly layout, nav still done via primary
            onNext={handleNext}
            hasPrev={hasPrev}
            hasNext={hasNext}
            manifests={manifests}
            secondaryProfile={secondaryProfile}
            onSelectSecondaryProfile={setSecondaryProfile}
            comparisonProfile={activeProfile}
            comparisonBook={activeBook}
            showComparisonDiffs={showComparisonDiffs}
            isSecondary={true}
            isActivePane={activePane === "secondary"}
            onVisibleBlockChange={setSyncBlockId}
            syncBlockId={activePane === "primary" ? (syncBlockId || undefined) : undefined}
            onAddNote={setDraftNoteTarget}
          />
        </div>
      )}

      <NotesPanel draftNoteTarget={draftNoteTarget} onClearDraft={() => setDraftNoteTarget(null)} />

      <CommandPalette
        manifests={manifests}
        onSelect={(profile, book, chapter) => {
          setActiveProfile(profile);
          setActiveBook(book);
          setActiveChapter(chapter);
        }}
      />
    </div>
  );
}

export default App;
