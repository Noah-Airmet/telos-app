import { useEffect, useState, useRef, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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
  "var(--highlight)",
  "#fca5a5",
  "#86efac",
  "#93c5fd",
  "#c4b5fd",
];

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ReadingPaneProps {
  profile: string;
  book: BookEntry | null;
  chapter: number;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  manifests?: TranslationManifest[];
  // Breadcrumb nav
  onChangeProfile?: (profile: string) => void;
  onSelectBook?: (book: BookEntry) => void;
  onSelectChapter?: (chapter: number) => void;
  // Pane management
  onAddPane?: () => void;  // opens a new pane to the right
  onClose?: () => void;    // closes this pane (undefined = last pane, hide button)
  // Comparison diffs
  comparisonProfile?: string;
  comparisonBook?: BookEntry | null;
  showComparisonDiffs?: boolean;
  onToggleComparisonDiffs?: () => void;
  // Sync
  isActivePane?: boolean;
  onVisibleBlockChange?: (blockId: string) => void;
  syncBlockId?: string;
  onAddNote?: (anchor: TextAnchor) => void;
}

// ─── ReadingPane ───────────────────────────────────────────────────────────────

export function ReadingPane({
  profile,
  book,
  chapter,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  manifests,
  onChangeProfile,
  onSelectBook,
  onSelectChapter,
  onAddPane,
  onClose,
  comparisonProfile,
  comparisonBook,
  showComparisonDiffs,
  onToggleComparisonDiffs,
  isActivePane,
  onVisibleBlockChange,
  syncBlockId,
  onAddNote,
}: ReadingPaneProps) {
  const { repository } = useAuth();
  const [doc, setDoc]               = useState<TelosDocument | null>(null);
  const [comparisonDoc, setComparisonDoc] = useState<TelosDocument | null>(null);
  const [loading, setLoading]       = useState(false);
  const scrollRef                   = useRef<HTMLDivElement>(null);
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

  const currentTranslation = manifests?.find((m) => m.profile === profile) ?? null;

  // ── Data subscriptions ────────────────────────────────────────────────────────

  useEffect(() => repository.subscribeHighlights(setHighlights), [repository]);

  useEffect(() => {
    setDictionaryEntries(getLocalDictionaryEntries());
    return subscribeToLocalStudyData(() => setDictionaryEntries(getLocalDictionaryEntries()));
  }, []);

  // ── Document loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!book) return;
    const entry = book.chapters.find((c) => c.chapter === chapter);
    if (!entry) return;
    setLoading(true);
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
    const entry = comparisonBook.chapters.find((c) => c.chapter === chapter);
    if (!entry) { setComparisonDoc(null); return; }
    loadDocument(comparisonProfile, entry.document_id)
      .then(setComparisonDoc)
      .catch(() => setComparisonDoc(null));
  }, [chapter, comparisonBook, comparisonProfile, showComparisonDiffs]);

  // ── Text selection ────────────────────────────────────────────────────────────

  const handleSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { setSelectionNode(null); return; }
    const range = sel.getRangeAt(0);
    let container = range.commonAncestorContainer as HTMLElement;
    if (container.nodeType === Node.TEXT_NODE) container = container.parentElement as HTMLElement;
    const vc = container.closest(".verse-container") as HTMLElement;
    if (!vc) { setSelectionNode(null); return; }
    const blockId = vc.getAttribute("data-block-id");
    const vt = vc.querySelector(".verse-text") as HTMLElement;
    if (!blockId || !vt) { setSelectionNode(null); return; }
    if (!vt.contains(range.startContainer) || !vt.contains(range.endContainer)) {
      setSelectionNode(null); return;
    }
    const pre = range.cloneRange();
    pre.selectNodeContents(vt);
    pre.setEnd(range.startContainer, range.startOffset);
    const startOffset = pre.toString().length;
    const endOffset = startOffset + range.toString().length;
    setSelectedWord(null);
    setSelectionNode({ blockId, startOffset, endOffset, rect: range.getBoundingClientRect(), text: range.toString().trim() });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", handleSelection);
    return () => document.removeEventListener("selectionchange", handleSelection);
  }, [handleSelection]);

  const applyHighlight = (color: string) => {
    if (!selectionNode) return;
    repository.saveHighlight({
      id: crypto.randomUUID(),
      block_id: selectionNode.blockId,
      start_offset: selectionNode.startOffset,
      end_offset: selectionNode.endOffset,
      color,
      created_at: Date.now(),
    }).catch(console.error);
    window.getSelection()?.removeAllRanges();
    setSelectionNode(null);
  };

  // ── Scroll sync ───────────────────────────────────────────────────────────────

  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastVisibleBlockIdRef = useRef<string | null>(null);
  const previousIsActivePaneRef = useRef(Boolean(isActivePane));

  useEffect(() => {
    if (!doc || !isActivePane || !onVisibleBlockChange) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const v = entries.find((e) => e.isIntersecting);
        if (v) {
          const id = v.target.getAttribute("data-block-id");
          if (id) {
            lastVisibleBlockIdRef.current = id;
            onVisibleBlockChange(id);
          }
        }
      },
      { root: scrollRef.current, rootMargin: "-10% 0px -80% 0px" }
    );
    const t = setTimeout(() => {
      scrollRef.current?.querySelectorAll(".verse-container").forEach((el) => observerRef.current?.observe(el));
    }, 100);
    return () => { clearTimeout(t); observerRef.current?.disconnect(); };
  }, [doc, isActivePane, onVisibleBlockChange]);

  useLayoutEffect(() => {
    const wasActivePane = previousIsActivePaneRef.current;
    previousIsActivePaneRef.current = Boolean(isActivePane);

    if (!syncBlockId || isActivePane) return;
    if (wasActivePane && lastVisibleBlockIdRef.current === syncBlockId) return;

    const el = scrollRef.current?.querySelector(`[data-block-id="${syncBlockId}"]`);
    if (el) {
      lastVisibleBlockIdRef.current = syncBlockId;
      el.scrollIntoView({ behavior: "auto", block: "start" });
    }
  }, [syncBlockId, isActivePane, doc]);

  // ── Keyboard nav (only when this pane is active) ─────────────────────────────

  useEffect(() => {
    if (!isActivePane) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isActivePane, hasPrev, hasNext, onPrev, onNext]);

  // ── Shared header props ───────────────────────────────────────────────────────

  const headerProps: PaneHeaderProps = {
    profile, book, chapter, currentTranslation, manifests,
    onPrev, onNext, hasPrev, hasNext,
    onChangeProfile, onSelectBook, onSelectChapter,
    onAddPane, onClose,
    showComparisonDiffs, onToggleComparisonDiffs,
    hasComparisonProfile: !!comparisonProfile,
    isActivePane,
  };

  // ── Empty / loading ───────────────────────────────────────────────────────────

  if (!book) {
    return (
      <main className="flex-1 relative bg-[var(--bg-canvas)] flex flex-col">
        <PaneHeader {...headerProps} />
        <div className={`flex-1 flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)] transition-opacity ${isActivePane ? "opacity-100" : "opacity-60"}`}>
          {profile ? (
            <p className="text-sm">No matching book in this translation.</p>
          ) : (
            <>
              <p className="text-sm">Open a resource from the library</p>
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="opacity-30">
                <path d="M3 10h14M10 3l7 7-7 7"/>
              </svg>
            </>
          )}
        </div>
      </main>
    );
  }

  if (loading || !doc) {
    return (
      <main className="flex-1 relative bg-[var(--bg-canvas)] flex flex-col">
        <PaneHeader {...headerProps} />
        <div className={`flex-1 flex items-center justify-center text-[var(--text-secondary)] text-sm transition-opacity ${isActivePane ? "opacity-100" : "opacity-60"}`}>Loading…</div>
      </main>
    );
  }

  return (
    <main className="flex-1 relative bg-[var(--bg-canvas)] flex flex-col">
      <PaneHeader {...headerProps} />

      <div ref={scrollRef} className={`flex-1 overflow-y-auto px-12 pt-16 pb-12 relative transition-opacity ${isActivePane ? "opacity-100" : "opacity-60"}`}>
        <div className="max-w-2xl mx-auto space-y-4 text-content relative">
          {doc.blocks.map((block) => (
            <VerseBlock
              key={block.block_id}
              block={block}
              highlights={highlights.filter((h) => h.block_id === block.block_id)}
              comparisonText={
                showComparisonDiffs
                  ? comparisonDoc?.blocks.find((b) => b.block_id === block.block_id)?.text
                  : undefined
              }
              showComparisonDiff={Boolean(showComparisonDiffs)}
            />
          ))}
        </div>

        {/* Selection toolbar */}
        {selectionNode && (
          <div
            className="fixed z-50 bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 rounded-lg p-1.5 flex gap-1 animate-in fade-in zoom-in duration-200"
            style={{
              top: `${Math.max(10, selectionNode.rect.top - 50)}px`,
              left: `${selectionNode.rect.left + selectionNode.rect.width / 2}px`,
              transform: "translateX(-50%)",
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {COLORS.map((c) => (
              <button
                key={c}
                onClick={(e) => { e.stopPropagation(); applyHighlight(c); }}
                className="w-6 h-6 rounded-full hover:scale-110 transition-transform cursor-pointer shadow-sm border border-black/10 dark:border-white/10"
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 self-center" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onAddNote) onAddNote({ block_id: selectionNode.blockId, start_offset: selectionNode.startOffset, end_offset: selectionNode.endOffset });
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
                setSelectedWord({ word: selectionNode.text, rect: selectionNode.rect, definitions: lookupDictionaryEntries(dictionaryEntries, selectionNode.text.toLowerCase()) });
                setSelectionNode(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="text-xs font-medium px-2 py-1 rounded text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Dictionary
            </button>
          </div>
        )}

        {/* Dictionary popover */}
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
                <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Dictionary Lookup</div>
                <div className="text-base font-semibold">{selectedWord.word}</div>
              </div>
              <button onClick={() => setSelectedWord(null)} className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Close</button>
            </div>
            {selectedWord.definitions.length > 0 ? (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {selectedWord.definitions.map((e) => (
                  <div key={e.id}>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-[var(--text-secondary)]">{e.dictionary}</div>
                    <div className="text-sm leading-relaxed">{e.definition}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">No imported dictionary entry found.</p>
            )}
          </div>
        )}

        {/* Bottom nav */}
        <div className="max-w-2xl mx-auto flex justify-between mt-12 pt-6 border-t border-[var(--border-color)]">
          <button onClick={onPrev} disabled={!hasPrev} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
            {hasPrev ? "← Previous" : ""}
          </button>
          <button onClick={onNext} disabled={!hasNext} className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-30 transition-colors">
            {hasNext ? "Next →" : ""}
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── PaneHeader ────────────────────────────────────────────────────────────────

interface PaneHeaderProps {
  profile: string;
  book: BookEntry | null;
  chapter: number;
  currentTranslation: TranslationManifest | null;
  manifests?: TranslationManifest[];
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onChangeProfile?: (profile: string) => void;
  onSelectBook?: (book: BookEntry) => void;
  onSelectChapter?: (chapter: number) => void;
  onAddPane?: () => void;
  onClose?: () => void;
  hasComparisonProfile: boolean;
  showComparisonDiffs?: boolean;
  onToggleComparisonDiffs?: () => void;
  isActivePane?: boolean;
}

function PaneHeader({
  profile,
  book,
  chapter,
  currentTranslation,
  manifests,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  onChangeProfile,
  onSelectBook,
  onSelectChapter,
  onAddPane,
  onClose,
  hasComparisonProfile,
  showComparisonDiffs,
  onToggleComparisonDiffs,
}: PaneHeaderProps) {
  const [pickerOpen, setPickerOpen] = useState<"work" | "book" | "chapter" | null>(null);
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);

  const workBtnRef    = useRef<HTMLButtonElement>(null);
  const bookBtnRef    = useRef<HTMLButtonElement>(null);
  const chapterBtnRef = useRef<HTMLButtonElement>(null);

  const openPicker = (
    picker: "work" | "book" | "chapter",
    ref: React.RefObject<HTMLButtonElement | null>
  ) => {
    if (pickerOpen === picker) {
      setPickerOpen(null);
      setPickerRect(null);
    } else {
      setPickerOpen(picker);
      setPickerRect(ref.current?.getBoundingClientRect() ?? null);
    }
  };

  const closePicker = () => { setPickerOpen(null); setPickerRect(null); };

  // Portal dropdown — renders outside all stacking contexts
  const portalDropdown =
    pickerOpen && pickerRect
      ? createPortal(
          <>
            {/* Transparent backdrop closes picker on click */}
            <div className="fixed inset-0 z-[9998]" onMouseDown={closePicker} />
            <div
              className="fixed z-[9999] bg-[var(--bg-canvas)] border border-[var(--border-color)] rounded-lg shadow-xl py-1 overflow-y-auto"
              style={{
                top:      pickerRect.bottom + 6,
                left:     pickerRect.left,
                minWidth: pickerOpen === "book" ? 176 : 144,
                maxHeight: pickerOpen === "chapter" ? "auto" : 288,
              }}
            >
              {pickerOpen === "work" &&
                manifests?.map((m) => (
                  <DropdownItem
                    key={m.profile}
                    active={m.profile === profile}
                    onClick={() => { onChangeProfile?.(m.profile); closePicker(); }}
                  >
                    {m.translation}
                  </DropdownItem>
                ))}

              {pickerOpen === "book" &&
                currentTranslation?.books.map((b) => (
                  <DropdownItem
                    key={b.book_id}
                    active={b.book_id === book?.book_id}
                    onClick={() => { onSelectBook?.(b); closePicker(); }}
                    right={<span className="opacity-35 tabular-nums text-[10px]">{b.chapters.length}</span>}
                  >
                    {b.name}
                  </DropdownItem>
                ))}

              {pickerOpen === "chapter" && book && (
                <div className="grid grid-cols-7 gap-1 p-2">
                  {book.chapters.map((c) => (
                    c.chapter !== null && (
                      <button
                        key={c.chapter}
                        onClick={() => { onSelectChapter?.(c.chapter as number); closePicker(); }}
                        className={`w-8 h-8 text-[11px] rounded-md transition-colors ${
                          c.chapter === chapter
                            ? "bg-[var(--text-primary)] text-[var(--bg-app)] font-semibold"
                            : "text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-[var(--text-primary)]"
                        }`}
                      >
                        {c.chapter}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <header className="h-12 glass-header absolute top-0 left-0 right-0 z-20 border-b border-[var(--border-color)] flex items-center px-4 gap-3">

        {/* ── Breadcrumb ── */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-hidden">

          {/* Work segment */}
          <button
            ref={workBtnRef}
            onClick={() => openPicker("work", workBtnRef)}
            className="flex items-center gap-0.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
          >
            <span>{currentTranslation?.translation ?? profile}</span>
            <ChevronDown />
          </button>

          {book && (
            <>
              <Dot />

              {/* Book segment */}
              <button
                ref={bookBtnRef}
                onClick={() => openPicker("book", bookBtnRef)}
                className="flex items-center gap-0.5 text-sm font-medium text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors whitespace-nowrap max-w-[9rem]"
              >
                <span className="truncate">{book.name}</span>
                <ChevronDown size={9} />
              </button>

              <Dot />

              {/* Chapter stepper: ‹ Ch. N › */}
              <div className="flex items-center flex-shrink-0">
                <button
                  onClick={onPrev}
                  disabled={!hasPrev}
                  title="Previous chapter"
                  className="w-5 h-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:cursor-default transition-colors rounded text-sm leading-none"
                >
                  ‹
                </button>
                <button
                  ref={chapterBtnRef}
                  onClick={() => openPicker("chapter", chapterBtnRef)}
                  className="px-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
                >
                  Ch. {chapter}
                </button>
                <button
                  onClick={onNext}
                  disabled={!hasNext}
                  title="Next chapter"
                  className="w-5 h-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:cursor-default transition-colors rounded text-sm leading-none"
                >
                  ›
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {hasComparisonProfile && onToggleComparisonDiffs && (
            <button
              onClick={onToggleComparisonDiffs}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors uppercase tracking-[0.13em] font-medium ${
                showComparisonDiffs
                  ? "border-[var(--text-primary)] text-[var(--text-primary)]"
                  : "border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}
            >
              Diffs
            </button>
          )}

          {onAddPane && (
            <button
              onClick={onAddPane}
              title="Open new pane"
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="1" width="10" height="10" rx="1.5"/>
                <path d="M6 1v10M1 6h5"/>
              </svg>
              Add
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              title="Close pane"
              className="text-[11px] px-2 py-1 rounded-md border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-red-500 hover:border-red-300 dark:hover:border-red-800 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </header>

      {portalDropdown}
    </>
  );
}

// ─── Micro-components ──────────────────────────────────────────────────────────

function ChevronDown({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="flex-shrink-0">
      <path d="M2 3.5l3 3 3-3"/>
    </svg>
  );
}

function Dot() {
  return <span className="text-[var(--text-secondary)] text-xs opacity-25 flex-shrink-0 select-none">·</span>;
}

function DropdownItem({
  children,
  active,
  onClick,
  right,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  right?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between gap-3 ${
        active
          ? "text-[var(--text-primary)] font-medium bg-gray-100 dark:bg-gray-800"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-gray-50 dark:hover:bg-gray-800/50"
      }`}
    >
      <span>{children}</span>
      {right}
    </button>
  );
}
