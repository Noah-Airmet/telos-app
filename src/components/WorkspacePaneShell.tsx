import type { PointerEventHandler, ReactNode } from "react";

interface WorkspacePaneShellProps {
  kicker: string;
  title: string;
  titleContent?: ReactNode;
  meta?: string | null;
  isActive?: boolean;
  onFocus?: () => void;
  onClose?: () => void;
  onHeaderPointerDown?: PointerEventHandler<HTMLElement>;
  actions?: ReactNode;
  children: ReactNode;
}

export function WorkspacePaneShell({
  kicker,
  title,
  titleContent,
  meta,
  isActive,
  onFocus,
  onClose,
  onHeaderPointerDown,
  actions,
  children,
}: WorkspacePaneShellProps) {
  return (
    <section
      className={`shell-pane flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${
        isActive ? "shell-pane-active" : "shell-pane-inactive"
      }`}
      onClick={onFocus}
    >
      <header className="shell-pane-header" onPointerDown={onHeaderPointerDown}>
        <div className="min-w-0 flex-1">
          <p className="shell-kicker">{kicker}</p>
          <div className="mt-1 flex items-end gap-3">
            {titleContent ?? (
              <h2 className="truncate text-lg font-black uppercase tracking-[-0.04em]">
                {title}
              </h2>
            )}
            {meta && <span className="shell-meta hidden sm:inline">{meta}</span>}
          </div>
        </div>

        <div className="ml-4 flex items-center gap-2">
          {actions}
          {onClose && (
            <button type="button" onClick={onClose} className="shell-button shell-button-danger">
              Close
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}
