import type { PointerEventHandler } from "react";
import { WorkspacePaneShell } from "./WorkspacePaneShell";

interface PaneLauncherPaneProps {
  isActive?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
  onOpenReader: () => void;
  onOpenWorkspace: () => void;
  onOpenNotes: () => void;
}

interface LauncherOption {
  label: string;
  description: string;
  hint: string;
  onClick: () => void;
}

function LauncherCard({ label, description, hint, onClick }: LauncherOption) {
  return (
    <button type="button" onClick={onClick} className="shell-list-item text-left">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="shell-kicker">{hint}</p>
          <h3 className="mt-2 text-xl font-black uppercase tracking-[-0.04em] text-white">
            {label}
          </h3>
        </div>
        <span className="shell-meta text-white">Open</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
    </button>
  );
}

export function PaneLauncherPane({
  isActive,
  onFocus,
  onClose,
  onHeaderPointerDown,
  onOpenReader,
  onOpenWorkspace,
  onOpenNotes,
}: PaneLauncherPaneProps) {
  return (
    <WorkspacePaneShell
      kicker="New Pane"
      title="Open Something"
      meta="Reader, Workspace, or Notes"
      isActive={isActive}
      onFocus={onFocus}
      onClose={onClose}
      onHeaderPointerDown={onHeaderPointerDown}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="shell-block mb-5">
            <p className="shell-kicker">Launch</p>
            <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">
              Open a new pane beside your current work. Choose a reader for more text,
              a workspace for drafting and planning, or notes for study reflections.
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <LauncherCard
              label="Reader"
              hint="Study"
              description="Browse the library, compare translations, and keep another text open beside your current pane."
              onClick={onOpenReader}
            />
            <LauncherCard
              label="Workspace"
              hint="Build"
              description="Open the workspace home to start from a recent document or create a new outline."
              onClick={onOpenWorkspace}
            />
            <LauncherCard
              label="Notes"
              hint="Capture"
              description="Open a notes pane to review reflections, tags, and anchors without leaving the reader."
              onClick={onOpenNotes}
            />
          </div>
        </div>
      </div>
    </WorkspacePaneShell>
  );
}
