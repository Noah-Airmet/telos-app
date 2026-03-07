import type { LessonPlan, PreferredWorkspace } from "../db/db";

interface WorkspaceChooserProps {
  preferredWorkspace?: PreferredWorkspace | null;
  lastPlan?: LessonPlan | null;
  onChooseReader: () => void;
  onChoosePlanner: () => void;
}

function WorkspaceCard({
  eyebrow,
  title,
  description,
  hint,
  recommended,
  onClick,
}: {
  eyebrow: string;
  title: string;
  description: string;
  hint: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-80 flex-col justify-between border border-[var(--border-color)] bg-[var(--bg-canvas)] p-7 text-left transition-colors hover:border-[var(--border-strong)]"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <span className="shell-kicker">{eyebrow}</span>
          {recommended && (
            <span className="shell-meta">
              Recommended
            </span>
          )}
        </div>

        <div>
          <h2 className="text-4xl font-black uppercase tracking-[-0.06em] text-white">
            {title}
          </h2>
          <p className="mt-4 max-w-md text-sm leading-7 text-[var(--text-secondary)]">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[var(--border-color)] pt-5">
        <p className="shell-meta">{hint}</p>
        <span className="shell-kicker text-white transition-transform group-hover:translate-x-1">
          Open →
        </span>
      </div>
    </button>
  );
}

export function WorkspaceChooser({
  preferredWorkspace,
  lastPlan,
  onChooseReader,
  onChoosePlanner,
}: WorkspaceChooserProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg-app)] px-6 py-12 text-[var(--text-primary)]">
      <div className="w-full max-w-6xl">
        <div className="mx-auto max-w-4xl text-center">
          <p className="shell-kicker">Telos Workspace</p>
          <h1 className="mt-5 text-6xl font-black uppercase leading-[0.88] tracking-[-0.06em] text-white md:text-8xl">
            STUDY OR
            <br />
            BUILD
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">
            The reader is your calm study environment. The planner is where scriptures,
            notes, and quotes become a teachable outline or the draft for an academic essay.
          </p>
          {lastPlan && (
            <p className="mt-4 shell-meta">
              Last Open Plan: <span className="text-white">{lastPlan.title}</span>
            </p>
          )}
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <WorkspaceCard
            eyebrow="Reader"
            title="Open Reader"
            description="Browse the library, compare translations, highlight, annotate, and keep studying in the existing multi-pane reading workspace."
            hint="Best when you want scripture text front and center."
            recommended={preferredWorkspace === "reader"}
            onClick={onChooseReader}
          />

          <WorkspaceCard
            eyebrow="Planner"
            title="Open Planner"
            description="Start from a recent lesson, choose a template, collect source material, and shape it into a structured lesson plan."
            hint={lastPlan ? "Jump back into your active lesson plan." : "Create a new document or open a recent one."}
            recommended={preferredWorkspace !== "reader"}
            onClick={onChoosePlanner}
          />
        </div>
      </div>
    </main>
  );
}
