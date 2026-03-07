import type { PointerEventHandler } from "react";
import type { LessonPlan, LessonPlanType } from "../db/db";
import { PLANNER_TEMPLATES, getLessonPlanTypeLabel } from "../lib/planner";
import { WorkspacePaneShell } from "./WorkspacePaneShell";

interface PlannerHomePaneProps {
  lessonPlans: LessonPlan[];
  pinnedPlanIds?: string[];
  isActive?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
  onCreatePlan: (type: LessonPlanType) => void;
  onOpenPlan: (planId: string) => void;
  onDeletePlan: (planId: string) => void;
  onOpenReader: () => void;
}

export function PlannerHomePane({
  lessonPlans,
  pinnedPlanIds,
  isActive,
  onFocus,
  onClose,
  onHeaderPointerDown,
  onCreatePlan,
  onOpenPlan,
  onDeletePlan,
  onOpenReader,
}: PlannerHomePaneProps) {
  const pinnedSet = new Set(pinnedPlanIds ?? []);

  return (
    <WorkspacePaneShell
      kicker="Workspace Home"
      title="Plans"
      meta={`${lessonPlans.length} total`}
      isActive={isActive}
      onFocus={onFocus}
      onClose={onClose}
      onHeaderPointerDown={onHeaderPointerDown}
      actions={
        <button type="button" onClick={onOpenReader} className="shell-button">
          Open Reader
        </button>
      }
    >
      <div className="grid h-full min-h-0 grid-cols-1 divide-y divide-[var(--border-color)] xl:grid-cols-[1.05fr_0.95fr] xl:divide-x xl:divide-y-0">
        <section className="min-h-0 overflow-y-auto p-5">
          <p className="shell-kicker">Templates</p>
          <h3 className="shell-title mt-3">START SOMEWHERE CLEAR</h3>
          <div className="mt-6 space-y-3">
            {PLANNER_TEMPLATES.map((template, index) => (
              <button
                key={template.type}
                type="button"
                onClick={() => onCreatePlan(template.type)}
                className="shell-list-item"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="shell-kicker">{String(index + 1).padStart(2, "0")}</div>
                    <h4 className="mt-2 text-xl font-black uppercase tracking-[-0.04em]">
                      {template.label}
                    </h4>
                  </div>
                  <span className="shell-meta">Template</span>
                </div>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {template.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section className="min-h-0 overflow-y-auto p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="shell-kicker">Recent</p>
              <h3 className="shell-title mt-3">RETURN TO WORK</h3>
            </div>
            <button
              type="button"
              onClick={() => onCreatePlan("custom")}
              className="shell-button shell-button-primary"
            >
              New Blank Slate
            </button>
          </div>

          <div className="mt-6 space-y-3">
            {lessonPlans.length === 0 ? (
              <div className="shell-empty-state">
                <p className="shell-serif text-lg italic text-white/90">
                  No plans yet.
                </p>
                <p className="mt-3 max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
                  Start with a template and keep the scriptures open beside it while you build.
                </p>
              </div>
            ) : (
              lessonPlans.map((plan) => (
                <div key={plan.id} className="shell-list-item">
                  <div className="flex items-start justify-between gap-4">
                    <button
                      type="button"
                      onClick={() => onOpenPlan(plan.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <h4 className="truncate text-lg font-black uppercase tracking-[-0.04em]">
                        {plan.title}
                      </h4>
                      <p className="mt-2 text-sm text-[var(--text-secondary)]">
                        {getLessonPlanTypeLabel(plan.type)}
                      </p>
                    </button>
                    <div className="flex items-center gap-3">
                      {pinnedSet.has(plan.id) && <span className="shell-meta">Pinned</span>}
                      <button
                        type="button"
                        onClick={() => onDeletePlan(plan.id)}
                        className="shell-button shell-button-danger"
                        aria-label={`Delete ${plan.title}`}
                      >
                        X
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </WorkspacePaneShell>
  );
}
