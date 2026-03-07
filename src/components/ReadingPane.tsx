import { useEffect, useState, useRef, useCallback, useLayoutEffect, type PointerEventHandler } from "react";
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
  activePlanLabel?: string | null;
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
  onSendSelectionToPlan?: (selection: {
    blockId: string;
    text: string;
    startOffset: number;
    endOffset: number;
  }) => Promise<void> | void;
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
  activePlanLabel,
  onHeaderPointerDown,
  onSendSelectionToPlan,
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
    onHeaderPointerDown,
  };

  // ── Empty / loading ───────────────────────────────────────────────────────────

  if (!book) {
    return (
      <main className="flex-1 relative bg-[var(--bg-canvas)] flex flex-col">
        <PaneHeader {...headerProps} />
        <div className={`flex-1 flex flex-col items-center justify-center gap-3 px-8 text-[var(--text-secondary)] transition-opacity ${isActivePane ? "opacity-100" : "opacity-60"}`}>
          {profile ? (
            <p className="shell-serif text-xl italic text-white/90">No matching book in this translation.</p>
          ) : (
            <>
              <p className="shell-serif text-xl italic text-white/90">Open a resource from the library.</p>
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
        <div className={`flex-1 flex items-center justify-center text-[var(--text-secondary)] shell-kicker transition-opacity ${isActivePane ? "opacity-100" : "opacity-60"}`}>Loading...</div>
      </main>
    );
  }

  return (
    <main className="flex-1 relative bg-[var(--bg-canvas)] flex flex-col">
      <PaneHeader {...headerProps} />

      <div ref={scrollRef} className={`flex-1 overflow-y-auto px-6 pt-16 pb-12 lg:px-10 relative transition-opacity ${isActivePane ? "opacity-100" : "opacity-60"}`}>
        <div className="mx-auto w-full max-w-[42rem] space-y-4 text-content relative">
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
            className="fixed z-50 flex gap-1 border border-[var(--border-strong)] bg-[var(--surface-overlay)] p-1.5"
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
                className="h-7 w-7 border border-white/10 transition-transform hover:scale-105"
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="mx-1 h-7 w-px self-center bg-[var(--border-color)]" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onAddNote) onAddNote({ block_id: selectionNode.blockId, start_offset: selectionNode.startOffset, end_offset: selectionNode.endOffset });
                setSelectionNode(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="shell-button"
            >
              Note
            </button>
            <div className="mx-1 h-7 w-px self-center bg-[var(--border-color)]" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedWord({ word: selectionNode.text, rect: selectionNode.rect, definitions: lookupDictionaryEntries(dictionaryEntries, selectionNode.text.toLowerCase()) });
                setSelectionNode(null);
                window.getSelection()?.removeAllRanges();
              }}
              className="shell-button"
            >
              Dictionary
            </button>
            <div className="mx-1 h-7 w-px self-center bg-[var(--border-color)]" />
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!selectionNode || !onSendSelectionToPlan) return;
                void onSendSelectionToPlan({
                  blockId: selectionNode.blockId,
                  text: selectionNode.text,
                  startOffset: selectionNode.startOffset,
                  endOffset: selectionNode.endOffset,
                });
                setSelectionNode(null);
                window.getSelection()?.removeAllRanges();
              }}
              disabled={!onSendSelectionToPlan}
              title={activePlanLabel ? `Send to ${activePlanLabel}` : "Create or open a plan first"}
              className="shell-button"
            >
              Send to Plan
            </button>
          </div>
        )}

        {/* Dictionary popover */}
        {selectedWord && (
          <div
            className="fixed z-50 max-w-sm border border-[var(--border-strong)] bg-[var(--surface-overlay)] p-4"
            style={{
              top: `${Math.min(window.innerHeight - 220, selectedWord.rect.bottom + 12)}px`,
              left: `${Math.min(window.innerWidth - 320, Math.max(16, selectedWord.rect.left))}px`,
            }}
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <div className="shell-kicker">Dictionary Lookup</div>
                <div className="mt-2 text-2xl font-black uppercase tracking-[-0.04em]">{selectedWord.word}</div>
              </div>
              <button onClick={() => setSelectedWord(null)} className="shell-button shell-button-danger">Close</button>
            </div>
            {selectedWord.definitions.length > 0 ? (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {selectedWord.definitions.map((e) => (
                  <div key={e.id}>
                    <div className="shell-kicker">{e.dictionary}</div>
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
          <button onClick={onPrev} disabled={!hasPrev} className="shell-button border-none px-0 disabled:opacity-30">
            {hasPrev ? "← Previous" : ""}
          </button>
          <button onClick={onNext} disabled={!hasNext} className="shell-button border-none px-0 disabled:opacity-30">
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
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
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
  onHeaderPointerDown,
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
              className="fixed z-[9999] bg-[var(--surface-overlay)] border border-[var(--border-strong)] py-1 overflow-y-auto"
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
                        className={`w-8 h-8 text-[11px] transition-colors ${
                          c.chapter === chapter
                            ? "bg-white text-black font-semibold"
                            : "text-[var(--text-secondary)] hover:bg-white/6 hover:text-[var(--text-primary)]"
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
      <header
        className="h-12 glass-header absolute top-0 left-0 right-0 z-20 border-b border-[var(--border-color)] flex items-center px-4 gap-3"
        onPointerDown={onHeaderPointerDown}
      >

        {/* ── Breadcrumb ── */}
        <div className="flex-1 flex items-center gap-1.5 min-w-0 overflow-hidden">

          {/* Work segment */}
          <button
            ref={workBtnRef}
            onClick={() => openPicker("work", workBtnRef)}
            className="flex items-center gap-1 shell-kicker hover:text-[var(--text-primary)] whitespace-nowrap"
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
                className="flex items-center gap-1 text-sm font-black uppercase tracking-[-0.03em] text-[var(--text-primary)] hover:text-[var(--text-secondary)] transition-colors whitespace-nowrap max-w-[9rem]"
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
                  className="w-5 h-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:cursor-default transition-colors text-sm leading-none"
                >
                  ‹
                </button>
                <button
                  ref={chapterBtnRef}
                  onClick={() => openPicker("chapter", chapterBtnRef)}
                  className="px-1 shell-kicker hover:text-[var(--text-primary)] whitespace-nowrap"
                >
                  Ch. {chapter}
                </button>
                <button
                  onClick={onNext}
                  disabled={!hasNext}
                  title="Next chapter"
                  className="w-5 h-5 flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-20 disabled:cursor-default transition-colors text-sm leading-none"
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
              className={`shell-button ${
                showComparisonDiffs
                  ? "shell-button-primary"
                  : ""
              }`}
            >
              Diffs
            </button>
          )}

          {onAddPane && (
            <button
              onClick={onAddPane}
              title="Open new pane"
              className="shell-button flex items-center gap-1"
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
              className="shell-button shell-button-danger"
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
          ? "text-black font-medium bg-white"
          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-white/6"
      }`}
    >
      <span>{children}</span>
      {right}
    </button>
  );
}
