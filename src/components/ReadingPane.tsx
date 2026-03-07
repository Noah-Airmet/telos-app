import { useEffect, useState, useRef, useCallback } from "react";
import {
  getLocalDictionaryEntries,
  subscribeToLocalStudyData,
  type DictionaryEntry,
  type TelosDocument,
  type Highlight,
  type TextAnchor,
} from "../db/db";
import type { BookEntry, TranslationManifest } from "../lib/scripture";
import { loadDocument } from "../lib/scripture";
import { VerseBlock } from "./VerseBlock";
import { useAuth } from "../context/AuthContext";
import { lookupDictionaryEntries } from "../lib/studyTools";

const COLORS = [
  "var(--highlight)", // Yellow
  "#fca5a5", // Red
  "#86efac", // Green
  "#93c5fd", // Blue
  "#c4b5fd"  // Purple
];

interface ReadingPaneProps {
  profile: string;
  book: BookEntry | null;
  chapter: number;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  manifests?: TranslationManifest[];
  secondaryProfile?: string | null;
  onSelectSecondaryProfile?: (profile: string | null) => void;
  comparisonProfile?: string | null;
  comparisonBook?: BookEntry | null;
  showComparisonDiffs?: boolean;
  onToggleComparisonDiffs?: () => void;
  isSecondary?: boolean;
  isActivePane?: boolean;
  onVisibleBlockChange?: (blockId: string) => void;
  syncBlockId?: string;
  onAddNote?: (anchor: TextAnchor) => void;
}

export function ReadingPane({
  profile,
  book,
  chapter,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  manifests,
  secondaryProfile,
  onSelectSecondaryProfile,
  comparisonProfile,
  comparisonBook,
  showComparisonDiffs,
  onToggleComparisonDiffs,
  isSecondary,
  isActivePane,
  onVisibleBlockChange,
  syncBlockId,
  onAddNote,
}: ReadingPaneProps) {
  const { repository } = useAuth();
  const [doc, setDoc] = useState<TelosDocument | null>(null);
  const [comparisonDoc, setComparisonDoc] = useState<TelosDocument | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [dictionaryEntries, setDictionaryEntries] = useState<DictionaryEntry[]>([]);
  const [selectedWord, setSelectedWord] = useState<{
    word: string;
    rect: DOMRect;
    definitions: DictionaryEntry[];
  } | null>(null);

  const [selectionNode, setSelectionNode] = useState<{
    blockId: string;
    startOffset: number;
    endOffset: number;
    rect: DOMRect;
    text: string;
  } | null>(null);

  useEffect(() => {
    return repository.subscribeHighlights(setHighlights);
  }, [repository]);

  useEffect(() => {
    setDictionaryEntries(getLocalDictionaryEntries());
    return subscribeToLocalStudyData(() => {
      setDictionaryEntries(getLocalDictionaryEntries());
    });
  }, []);

  const handleSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      setSelectionNode(null);
      return;
    }

    const range = selection.getRangeAt(0);
    let container = range.commonAncestorContainer as HTMLElement;
    if (container.nodeType === Node.TEXT_NODE) {
      container = container.parentElement as HTMLElement;
    }

    const verseContainer = container.closest('.verse-container') as HTMLElement;
    if (!verseContainer) {
      setSelectionNode(null);
      return;
    }

    const blockId = verseContainer.getAttribute('data-block-id');
    const verseText = verseContainer.querySelector('.verse-text') as HTMLElement;

    if (!blockId || !verseText) {
      setSelectionNode(null);
      return;
    }

    if (!verseText.contains(range.startContainer) || !verseText.contains(range.endContainer)) {
      setSelectionNode(null);
      return;
    }

    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(verseText);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const startOffset = preSelectionRange.toString().length;
    const endOffset = startOffset + range.toString().length;

    const rect = range.getBoundingClientRect();
    setSelectedWord(null);

    setSelectionNode({
      blockId,
      startOffset,
      endOffset,
      rect,
      text: range.toString().trim()
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, [handleSelection]);

  const applyHighlight = (color: string) => {
    if (!selectionNode) return;
    const newHighlight: Highlight = {
      id: crypto.randomUUID(),
      block_id: selectionNode.blockId,
      start_offset: selectionNode.startOffset,
      end_offset: selectionNode.endOffset,
      color,
      created_at: Date.now()
    };
    repository.saveHighlight(newHighlight).catch((error) => {
      console.error("Failed to save highlight.", error);
    });
    window.getSelection()?.removeAllRanges();
    setSelectionNode(null);
  };

  useEffect(() => {
    if (!book) return;
    const entry = book.chapters.find((c) => c.chapter === chapter);
    if (!entry) return;

    setLoading(true);
    // Add small delay to prevent rough visual pop if loading fast
    loadDocument(profile, entry.document_id).then((d) => {
      setDoc(d);
      setLoading(false);
      scrollRef.current?.scrollTo(0, 0);
    });
  }, [profile, book, chapter]);

  useEffect(() => {
    if (!showComparisonDiffs || !comparisonProfile || !comparisonBook) {
      setComparisonDoc(null);
      return;
    }

    const entry = comparisonBook.chapters.find((item) => item.chapter === chapter);
    if (!entry) {
      setComparisonDoc(null);
      return;
    }

    loadDocument(comparisonProfile, entry.document_id)
      .then((nextDoc) => {
        setComparisonDoc(nextDoc);
      })
      .catch((error) => {
        console.error("Failed to load comparison document.", error);
        setComparisonDoc(null);
      });
  }, [chapter, comparisonBook, comparisonProfile, showComparisonDiffs]);

  const observerRef = useRef<IntersectionObserver | null>(null);

  // Observer to notify OF the visible block
  useEffect(() => {
    if (!doc || !isActivePane || !onVisibleBlockChange) return;

    observerRef.current = new IntersectionObserver((entries) => {
      const visible = entries.find(e => e.isIntersecting);
      if (visible) {
        const id = visible.target.getAttribute('data-block-id');
        if (id) {
          // Send the generic form (e.g. `bom-1-ne-1-1`) to the wrapper
          onVisibleBlockChange(id);
        }
      }
    }, {
      root: scrollRef.current,
      rootMargin: "-10% 0px -80% 0px"
    });

    const timeout = setTimeout(() => {
      const verses = scrollRef.current?.querySelectorAll('.verse-container');
      verses?.forEach(v => observerRef.current?.observe(v));
    }, 100);

    return () => {
      clearTimeout(timeout);
      observerRef.current?.disconnect();
    };
  }, [doc, isActivePane, onVisibleBlockChange]);

  // Sync scroll TO the target block
  useEffect(() => {
    if (syncBlockId && !isActivePane) {
      // Find the element with this precise block_id, or if different translation, attempt a fall back?
      // For MVP: assume block IDs are identical.
      const el = scrollRef.current?.querySelector(`[data-block-id="${syncBlockId}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    }
  }, [syncBlockId, isActivePane, doc]);

  // Keyboard navigation
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext]);

  if (!book) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-secondary)]">
        {isSecondary
          ? "This edition does not contain a matching book for the current comparison."
          : "Select a book to begin reading."}
      </main>
    );
  }

  if (loading || !doc) {
    return (
      <main className="flex-1 flex items-center justify-center bg-[var(--bg-canvas)] text-[var(--text-secondary)]">
        Loading...
      </main>
    );
  }

  return (
    <main className={`flex-1 flex flex-col bg-[var(--bg-canvas)] relative shadow-sm transition-opacity ${!isActivePane ? 'opacity-80' : 'opacity-100'}`}>
      <header className="h-12 glass-header absolute top-0 left-0 right-0 z-10 border-b border-[var(--border-color)] flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          {!isSecondary && (
            <button
              onClick={onPrev}
              disabled={!hasPrev}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              &larr;
            </button>
          )}
          <h2 className="font-medium">{doc.title}</h2>
          {!isSecondary && (
            <button
              onClick={onNext}
              disabled={!hasNext}
              className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-default transition-colors"
            >
              &rarr;
            </button>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-[var(--text-secondary)] truncate max-w-[100px]">{doc.translation}</span>
          {isSecondary ? (
            <button
              onClick={() => onSelectSecondaryProfile?.(null)}
              className="text-[var(--text-secondary)] hover:text-red-500 transition-colors ml-2 font-medium"
            >
              Close
            </button>
          ) : manifests && onSelectSecondaryProfile ? (
            <select
              value={secondaryProfile || ""}
              onChange={(e) => onSelectSecondaryProfile(e.target.value || null)}
              className="bg-transparent text-[var(--text-primary)] border border-gray-200 dark:border-gray-700 rounded px-1.5 py-0.5 outline-none cursor-pointer"
            >
              <option value="">Compare...</option>
              {manifests
                .filter((manifest) => manifest.profile !== profile && manifest.compare_ready)
                .map((manifest) => (
                <option key={manifest.profile} value={manifest.profile}>{manifest.translation}</option>
              ))}
            </select>
          ) : null}
          {!isSecondary && secondaryProfile && onToggleComparisonDiffs ? (
            <button
              onClick={onToggleComparisonDiffs}
              className="rounded border border-gray-200 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-[var(--text-secondary)] hover:text-[var(--text-primary)] dark:border-gray-700"
            >
              {showComparisonDiffs ? "Hide Diffs" : "Show Diffs"}
            </button>
          ) : null}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-12 pt-20 pb-12 relative"
      >
        <div className="max-w-2xl mx-auto space-y-4 text-content relative">
          {doc.blocks.map((block) => (
            <VerseBlock
              key={block.block_id}
              block={block}
              highlights={highlights.filter(h => h.block_id === block.block_id)}
              comparisonText={
                showComparisonDiffs
                  ? comparisonDoc?.blocks.find((item) => item.block_id === block.block_id)?.text
                  : undefined
              }
              showComparisonDiff={Boolean(showComparisonDiffs)}
            />
          ))}
        </div>

        {selectionNode && (
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 flex gap-1 animate-in fade-in zoom-in duration-200"
            style={{
              top: `${Math.max(10, selectionNode.rect.top - 50)}px`,
              left: `${selectionNode.rect.left + (selectionNode.rect.width / 2)}px`,
              transform: 'translateX(-50%)'
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={(e) => {
                  e.stopPropagation();
                  applyHighlight(c);
                }}
                className="w-6 h-6 rounded-full hover:scale-110 transition-transform cursor-pointer shadow-sm border border-black/10 dark:border-white/10"
                style={{ backgroundColor: c }}
                title="Highlight"
              />
            ))}

            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 self-center" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onAddNote) {
                  onAddNote({
                    block_id: selectionNode.blockId,
                    start_offset: selectionNode.startOffset,
                    end_offset: selectionNode.endOffset,
                  });
                }
                setSelectionNode(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="text-xs font-medium px-2 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Note
            </button>
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 self-center" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedWord({
                  word: selectionNode.text,
                  rect: selectionNode.rect,
                  definitions: lookupDictionaryEntries(dictionaryEntries, selectionNode.text.toLowerCase()),
                });
                setSelectionNode(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="text-xs font-medium px-2 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Dictionary
            </button>
          </div>
        )}

        {selectedWord && (
          <div
            className="fixed z-50 max-w-sm bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg p-3 animate-in fade-in zoom-in duration-200"
            style={{
              top: `${Math.min(window.innerHeight - 220, selectedWord.rect.bottom + 12)}px`,
              left: `${Math.min(window.innerWidth - 320, Math.max(16, selectedWord.rect.left))}px`,
            }}
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                  Dictionary Lookup
                </div>
                <div className="text-base font-semibold text-[var(--text-primary)]">
                  {selectedWord.word}
                </div>
              </div>
              <button
                onClick={() => setSelectedWord(null)}
                className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>

            {selectedWord.definitions.length > 0 ? (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {selectedWord.definitions.map((entry) => (
                  <div key={entry.id}>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                      {entry.dictionary}
                    </div>
                    <div className="text-sm leading-relaxed text-[var(--text-primary)]">
                      {entry.definition}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
                No imported dictionary entry matches this word yet. Import a private dictionary JSON
                from the library sidebar to enable click-to-lookup.
              </div>
            )}
          </div>
        )}

        {/* Bottom nav */}
        <div className="max-w-2xl mx-auto flex justify-between mt-12 pt-6 border-t border-[var(--border-color)]">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
          >
            {hasPrev ? "\u2190 Previous Chapter" : ""}
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors"
          >
            {hasNext ? "Next Chapter \u2192" : ""}
          </button>
        </div>
      </div>
    </main>
  );
}
