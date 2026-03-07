import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import type { AppPaneDescriptor } from "../db/db";
import { normalizePaneWidths } from "../lib/workspace";

interface PaneHostProps {
  panes: AppPaneDescriptor[];
  activePaneId: string | null;
  paneWidths?: Record<string, number>;
  onFocusPane: (paneId: string) => void;
  onResizePanes: (paneWidths: Record<string, number>) => void;
  onReorderPane: (paneId: string, targetIndex: number) => void;
  renderPane: (
    pane: AppPaneDescriptor,
    controls: {
      onHeaderPointerDown: (event: PointerEvent<HTMLElement>) => void;
    }
  ) => ReactNode;
}

export function PaneHost({
  panes,
  activePaneId,
  paneWidths,
  onFocusPane,
  onResizePanes,
  onReorderPane,
  renderPane,
}: PaneHostProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerStateRef = useRef<{
    paneId: string;
    pointerId: number;
    latestX: number;
    latestY: number;
  } | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    paneId: string;
    placeholderIndex: number;
    placeholderWidth: number;
  } | null>(null);
  const [dragState, setDragState] = useState<{
    paneId: string;
    placeholderIndex: number;
    placeholderWidth: number;
  } | null>(null);
  const resolvedWidths = useMemo(
    () => normalizePaneWidths(panes, paneWidths),
    [paneWidths, panes]
  );

  useEffect(() => {
    return () => {
      clearPendingDrag();
      pointerStateRef.current = null;
      dragStateRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!dragStateRef.current) return;
    if (!panes.some((pane) => pane.id === dragStateRef.current?.paneId)) {
      clearPendingDrag();
      pointerStateRef.current = null;
      dragStateRef.current = null;
      setDragState(null);
    }
  }, [panes]);

  const clearPendingDrag = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const getPlaceholderIndex = (paneId: string, pointerX: number) => {
    const container = containerRef.current;
    if (!container) return 0;

    const remainingPanes = panes.filter((pane) => pane.id !== paneId);
    if (remainingPanes.length === 0) return 0;

    const paneElements = remainingPanes
      .map((pane) => container.querySelector<HTMLElement>(`[data-pane-id="${pane.id}"]`))
      .filter((pane): pane is HTMLElement => Boolean(pane));

    for (let index = 0; index < paneElements.length; index += 1) {
      const rect = paneElements[index].getBoundingClientRect();
      if (pointerX < rect.left + rect.width / 2) {
        return index;
      }
    }

    return paneElements.length;
  };

  const beginPaneDrag = (paneId: string) => {
    const container = containerRef.current;
    const pointerState = pointerStateRef.current;
    if (!container || !pointerState) return;

    const paneElement = container.querySelector<HTMLElement>(`[data-pane-id="${paneId}"]`);
    const paneRect = paneElement?.getBoundingClientRect();

    setDragState({
      paneId,
      placeholderIndex: getPlaceholderIndex(paneId, pointerState.latestX),
      placeholderWidth: paneRect?.width ?? 280,
    });
    dragStateRef.current = {
      paneId,
      placeholderIndex: getPlaceholderIndex(paneId, pointerState.latestX),
      placeholderWidth: paneRect?.width ?? 280,
    };
  };

  const beginResize = (leftPaneId: string, rightPaneId: string, startX: number) => {
    const container = containerRef.current;
    if (!container) return;

    const containerWidth = container.getBoundingClientRect().width;
    const startLeft = resolvedWidths[leftPaneId] ?? 50;
    const startRight = resolvedWidths[rightPaneId] ?? 50;

    const onMouseMove = (event: MouseEvent) => {
      const deltaPercent = ((event.clientX - startX) / containerWidth) * 100;
      const nextLeft = Math.max(18, Math.min(82, startLeft + deltaPercent));
      const shared = startLeft + startRight;
      const nextRight = Math.max(18, shared - nextLeft);
      const normalizedLeft = shared - nextRight;

      onResizePanes({
        ...resolvedWidths,
        [leftPaneId]: normalizedLeft,
        [rightPaneId]: nextRight,
      });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const handleHeaderPointerDown = (paneId: string, event: PointerEvent<HTMLElement>) => {
    if (
      (event.target as HTMLElement).closest(
        "button, input, textarea, select, a, [data-no-pane-drag]"
      )
    ) {
      return;
    }

    onFocusPane(paneId);
    pointerStateRef.current = {
      paneId,
      pointerId: event.pointerId,
      latestX: event.clientX,
      latestY: event.clientY,
    };

    clearPendingDrag();
    holdTimerRef.current = window.setTimeout(() => {
      beginPaneDrag(paneId);
      holdTimerRef.current = null;
    }, 180);

    const onPointerMove = (moveEvent: globalThis.PointerEvent) => {
      if (!pointerStateRef.current || moveEvent.pointerId !== pointerStateRef.current.pointerId) {
        return;
      }

      pointerStateRef.current = {
        ...pointerStateRef.current,
        latestX: moveEvent.clientX,
        latestY: moveEvent.clientY,
      };

      if (dragStateRef.current) {
        const nextDragState = {
          ...dragStateRef.current,
          placeholderIndex: getPlaceholderIndex(dragStateRef.current.paneId, moveEvent.clientX),
        };
        dragStateRef.current = nextDragState;
        setDragState(nextDragState);
      }
    };

    const onPointerUp = (upEvent: globalThis.PointerEvent) => {
      if (!pointerStateRef.current || upEvent.pointerId !== pointerStateRef.current.pointerId) {
        return;
      }

      const activeDrag = dragStateRef.current;
      clearPendingDrag();
      pointerStateRef.current = null;
      dragStateRef.current = null;
      setDragState(null);

      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);

      if (activeDrag) {
        onReorderPane(activeDrag.paneId, activeDrag.placeholderIndex);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  return (
    <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
      {panes.map((pane, index) => {
        const showPlaceholderBefore =
          dragState &&
          dragState.paneId !== pane.id &&
          dragState.placeholderIndex === panes.filter((entry) => entry.id !== dragState.paneId).findIndex(
            (entry) => entry.id === pane.id
          );

        return (
          <Fragment key={pane.id}>
            {showPlaceholderBefore && (
              <div
                className="shell-drop-placeholder"
                style={{ width: `${dragState.placeholderWidth}px` }}
              >
                <div className="shell-drop-placeholder-inner" />
              </div>
            )}

            <div
              data-pane-id={pane.id}
              className={`relative flex min-h-0 min-w-0 ${
                dragState?.paneId === pane.id ? "opacity-45" : ""
              }`}
              style={{ width: `${resolvedWidths[pane.id] ?? 100 / panes.length}%` }}
            >
              <div className="flex min-h-0 min-w-0 flex-1" onClick={() => onFocusPane(pane.id)}>
                {renderPane(pane, {
                  onHeaderPointerDown: (event) => handleHeaderPointerDown(pane.id, event),
                })}
              </div>

              {index < panes.length - 1 && (
                <div
                  className="shell-resize-rail"
                  onMouseDown={(event) => beginResize(pane.id, panes[index + 1].id, event.clientX)}
                >
                  <div className="shell-resize-grip" />
                </div>
              )}

              {pane.id === activePaneId && <div className="shell-active-rail" />}
            </div>
          </Fragment>
        );
      })}

      {dragState &&
        dragState.placeholderIndex === panes.filter((pane) => pane.id !== dragState.paneId).length && (
          <div
            className="shell-drop-placeholder"
            style={{ width: `${dragState.placeholderWidth}px` }}
          >
            <div className="shell-drop-placeholder-inner" />
          </div>
        )}
    </div>
  );
}
