import type { PointerEventHandler } from "react";
import type { LessonPlan, LessonSource } from "../db/db";
import { WorkspacePaneShell } from "./WorkspacePaneShell";

interface CaptureTrayPaneProps {
  lessonPlan: LessonPlan | null;
  lessonSources: LessonSource[];
  isActive?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
  onInsertSourceIntoOutline: (sourceId: string) => void;
  onRemoveSource: (sourceId: string) => void;
}

export function CaptureTrayPane({
  lessonPlan,
  lessonSources,
  isActive,
  onFocus,
  onClose,
  onHeaderPointerDown,
  onInsertSourceIntoOutline,
  onRemoveSource,
}: CaptureTrayPaneProps) {
  return (
    <WorkspacePaneShell
      kicker="Capture Tray"
      title={lessonPlan ? lessonPlan.title : "No Plan Selected"}
      meta={lessonPlan ? "Source Material" : null}
      isActive={isActive}
      onFocus={onFocus}
      onClose={onClose}
      onHeaderPointerDown={onHeaderPointerDown}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
        <div className="shell-block mb-5">
          <p className="shell-kicker">What Lives Here</p>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
            Capture Tray is a staging area for scriptures, quotes, and note excerpts you may
            want to place into the outline. It is collected source material, not your main writing surface.
          </p>
        </div>

        {!lessonPlan ? (
          <div className="shell-empty-state">
            <p className="shell-serif text-lg italic text-white/90">No capture target yet.</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
              Open a lesson plan, then send verses and notes here from any reading pane.
            </p>
          </div>
        ) : lessonSources.length === 0 ? (
          <div className="shell-empty-state">
            <p className="shell-serif text-lg italic text-white/90">Nothing captured yet.</p>
            <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
              Select text in a reading pane or send a note into the workspace to collect source material.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {lessonSources.map((source, index) => (
              <article key={source.id} className="shell-list-item">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="shell-kicker">{String(index + 1).padStart(2, "0")}</p>
                    <h4 className="mt-2 text-base font-black uppercase tracking-[-0.04em]">
                      {source.label}
                    </h4>
                    {source.reference_label && (
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                        {source.reference_label}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onRemoveSource(source.id)}
                    className="shell-button shell-button-danger"
                  >
                    Remove
                  </button>
                </div>

                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--text-secondary)]">
                  {source.content}
                </p>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => onInsertSourceIntoOutline(source.id)}
                    className="shell-button shell-button-primary"
                  >
                    Insert Into Document
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        </div>
      </div>
    </WorkspacePaneShell>
  );
}
