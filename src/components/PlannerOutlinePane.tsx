import type { PointerEventHandler } from "react";
import type { LessonBlock, LessonBlockKind, LessonPlan } from "../db/db";
import { getLessonPlanTypeLabel } from "../lib/planner";
import { WorkspacePaneShell } from "./WorkspacePaneShell";

interface PlannerOutlinePaneProps {
  lessonPlan: LessonPlan | null;
  lessonBlocks: LessonBlock[];
  isActive?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
  onRenamePlan: (title: string) => void;
  onUpdateBlock: (blockId: string, updates: Partial<LessonBlock>) => void;
  onAddBlock: (kind: LessonBlockKind) => void;
  onDeleteBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, direction: "up" | "down") => void;
  onExportMarkdown: () => void;
}

function kindLabel(kind: LessonBlockKind) {
  switch (kind) {
    case "heading":
      return "Heading";
    case "text":
      return "Text";
    case "scripture":
      return "Scripture";
    case "quote":
      return "Quote";
    case "question":
      return "Question";
    case "checklist":
      return "Checklist";
    default:
      return "Block";
  }
}

function blockPlaceholder(kind: LessonBlockKind) {
  switch (kind) {
    case "heading":
      return "Section title";
    case "text":
      return "Write notes, transitions, or teaching ideas...";
    case "scripture":
      return "Add a verse, passage, or excerpt...";
    case "quote":
      return "Add a quote or commentary excerpt...";
    case "question":
      return "Add a discussion question...";
    case "checklist":
      return "One action item per line...";
    default:
      return "Add content...";
  }
}

export function PlannerOutlinePane({
  lessonPlan,
  lessonBlocks,
  isActive,
  onFocus,
  onClose,
  onHeaderPointerDown,
  onRenamePlan,
  onUpdateBlock,
  onAddBlock,
  onDeleteBlock,
  onMoveBlock,
  onExportMarkdown,
}: PlannerOutlinePaneProps) {
  return (
    <WorkspacePaneShell
      kicker="Lesson Outline"
      title={lessonPlan?.title ?? "No Plan Selected"}
      meta={lessonPlan ? getLessonPlanTypeLabel(lessonPlan.type) : null}
      isActive={isActive}
      onFocus={onFocus}
      onClose={onClose}
      onHeaderPointerDown={onHeaderPointerDown}
      actions={
        <button
          type="button"
          onClick={onExportMarkdown}
          disabled={!lessonPlan}
          className="shell-button shell-button-primary"
        >
          Export Markdown
        </button>
      }
    >
      {!lessonPlan ? (
        <div className="shell-empty-state">
          <p className="shell-serif text-xl italic text-white/90">Open a lesson plan.</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
            Keep this outline beside your reading panes and build the lesson from captured material.
          </p>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[var(--border-color)] px-5 py-4">
            <p className="shell-kicker">Document Title</p>
            <input
              type="text"
              value={lessonPlan.title}
              onChange={(event) => onRenamePlan(event.target.value)}
              className="shell-outline-title mt-3"
              placeholder="Untitled Lesson"
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <div className="space-y-4">
              {lessonBlocks.map((block, index) => (
                <article key={block.id} className="shell-block">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="shell-kicker">{kindLabel(block.kind)}</p>
                      {block.reference_label && (
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                          {block.reference_label}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onMoveBlock(block.id, "up")}
                        disabled={index === 0}
                        className="shell-button"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveBlock(block.id, "down")}
                        disabled={index === lessonBlocks.length - 1}
                        className="shell-button"
                      >
                        Down
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteBlock(block.id)}
                        className="shell-button shell-button-danger"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {block.kind === "heading" ? (
                    <input
                      type="text"
                      value={block.content}
                      onChange={(event) => onUpdateBlock(block.id, { content: event.target.value })}
                      placeholder={blockPlaceholder(block.kind)}
                      className="mt-4 w-full bg-transparent text-2xl font-black uppercase tracking-[-0.04em] text-[var(--text-primary)] outline-none"
                    />
                  ) : (
                    <textarea
                      value={block.content}
                      onChange={(event) => onUpdateBlock(block.id, { content: event.target.value })}
                      placeholder={blockPlaceholder(block.kind)}
                      className="shell-textarea mt-4"
                    />
                  )}
                </article>
              ))}
            </div>

            <div className="mt-5 border-t border-[var(--border-color)] pt-5">
              <p className="shell-kicker">Add Block</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  ["heading", "text", "scripture", "quote", "question", "checklist"] as const
                ).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => onAddBlock(kind)}
                    className="shell-button"
                  >
                    + {kindLabel(kind)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </WorkspacePaneShell>
  );
}
