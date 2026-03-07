import { useEffect, useState, type PointerEventHandler } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { LessonPlan } from "../db/db";
import { getLessonPlanTypeLabel } from "../lib/planner";
import { WorkspacePaneShell } from "./WorkspacePaneShell";

interface PlannerOutlinePaneProps {
  lessonPlan: LessonPlan | null;
  isActive?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
  onRenamePlan: (title: string) => void;
  onUpdateBodyMarkdown: (bodyMarkdown: string) => void;
  onExportMarkdown: () => void;
}

export function PlannerOutlinePane({
  lessonPlan,
  isActive,
  onFocus,
  onClose,
  onHeaderPointerDown,
  onRenamePlan,
  onUpdateBodyMarkdown,
  onExportMarkdown,
}: PlannerOutlinePaneProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");

  useEffect(() => {
    if ((lessonPlan?.body_markdown ?? "").trim()) {
      setMode("preview");
      return;
    }
    setMode("edit");
  }, [lessonPlan?.id]);

  useEffect(() => {
    setDraftTitle(lessonPlan?.title ?? "");
    setIsEditingTitle(false);
  }, [lessonPlan?.id, lessonPlan?.title]);

  const commitTitle = () => {
    const nextTitle = draftTitle.trim() || "Untitled Document";
    if (nextTitle !== (lessonPlan?.title ?? "")) {
      onRenamePlan(nextTitle);
    }
    setDraftTitle(nextTitle);
    setIsEditingTitle(false);
  };

  return (
    <WorkspacePaneShell
      kicker="Document"
      title={lessonPlan?.title ?? "No Document Selected"}
      titleContent={
        lessonPlan ? (
          isEditingTitle ? (
            <input
              type="text"
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onBlur={commitTitle}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commitTitle();
                }
                if (event.key === "Escape") {
                  setDraftTitle(lessonPlan.title);
                  setIsEditingTitle(false);
                }
              }}
              className="shell-inline-title-input"
              placeholder="Untitled Document"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsEditingTitle(true)}
              className="shell-inline-title"
              title="Rename document"
            >
              {lessonPlan.title || "Untitled Document"}
            </button>
          )
        ) : undefined
      }
      meta={lessonPlan ? getLessonPlanTypeLabel(lessonPlan.type) : null}
      isActive={isActive}
      onFocus={onFocus}
      onClose={onClose}
      onHeaderPointerDown={onHeaderPointerDown}
      actions={
        <>
          <button
            type="button"
            onClick={() => setMode("edit")}
            className={`shell-button ${mode === "edit" ? "shell-button-primary" : ""}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`shell-button ${mode === "preview" ? "shell-button-primary" : ""}`}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={onExportMarkdown}
            disabled={!lessonPlan}
            className="shell-button"
          >
            Export Markdown
          </button>
        </>
      }
    >
      {!lessonPlan ? (
        <div className="shell-empty-state">
          <p className="shell-serif text-xl italic text-white/90">Open a lesson plan.</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
            Keep this document beside your reading panes and write like a calm markdown notebook.
          </p>
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6">
            {mode === "edit" ? (
              <textarea
                value={lessonPlan.body_markdown ?? ""}
                onChange={(event) => onUpdateBodyMarkdown(event.target.value)}
                placeholder="Write in markdown..."
                className="planner-markdown-editor"
                spellCheck
              />
            ) : (
              <div className="planner-markdown-preview">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {lessonPlan.body_markdown?.trim() || "_Nothing written yet._"}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>
      )}
    </WorkspacePaneShell>
  );
}
