import type {
  AppPaneDescriptor,
  CaptureTrayPaneState,
  NotesPaneState,
  NotesPaneScope,
  PaneLauncherPaneState,
  PlannerHomePaneState,
  PlannerOutlinePaneState,
  ReadingPaneState,
  ShellLayoutState,
  TextAnchor,
} from "../db/db";

export function createReadingPane(
  state: Partial<ReadingPaneState> = {}
): Extract<AppPaneDescriptor, { type: "reading" }> {
  return {
    id: crypto.randomUUID(),
    type: "reading",
    state: {
      profile: state.profile ?? "lds-bom",
      book_id: state.book_id ?? null,
      chapter: state.chapter ?? 1,
      sync_group_id: state.sync_group_id ?? null,
      linked_to_pane_id: state.linked_to_pane_id ?? null,
      show_comparison_diffs: state.show_comparison_diffs ?? false,
    },
  };
}

export function createPlannerHomePane(
  state: PlannerHomePaneState = {}
): AppPaneDescriptor {
  return {
    id: crypto.randomUUID(),
    type: "plannerHome",
    state,
  };
}

export function createPaneLauncherPane(
  state: PaneLauncherPaneState = {}
): AppPaneDescriptor {
  return {
    id: crypto.randomUUID(),
    type: "paneLauncher",
    state,
  };
}

export function createPlannerOutlinePane(
  planId: string | null,
  state: Partial<PlannerOutlinePaneState> = {}
): AppPaneDescriptor {
  return {
    id: crypto.randomUUID(),
    type: "plannerOutline",
    state: {
      plan_id: planId,
      ...state,
    },
  };
}

export function createNotesPane(
  state: NotesPaneState = {}
): AppPaneDescriptor {
  return {
    id: crypto.randomUUID(),
    type: "notes",
    state,
  };
}

export function createCaptureTrayPane(
  planId: string | null,
  state: Partial<CaptureTrayPaneState> = {}
): AppPaneDescriptor {
  return {
    id: crypto.randomUUID(),
    type: "captureTray",
    state: {
      plan_id: planId,
      ...state,
    },
  };
}

export function createShellLayoutState(
  panes: AppPaneDescriptor[],
  activePaneId?: string | null
): ShellLayoutState {
  return {
    id: "default",
    active_pane_id: activePaneId ?? panes[0]?.id ?? null,
    panes,
    pane_widths: createEqualWidths(panes),
    updated_at: Date.now(),
  };
}

export function createEqualWidths(panes: AppPaneDescriptor[]) {
  if (panes.length === 0) return {};
  const width = 100 / panes.length;
  return Object.fromEntries(panes.map((pane) => [pane.id, width]));
}

export function normalizePaneWidths(
  panes: AppPaneDescriptor[],
  paneWidths?: Record<string, number>
) {
  if (panes.length === 0) return {};

  const next: Record<string, number> = {};
  const explicit = panes.map((pane) => paneWidths?.[pane.id] ?? 0);
  const explicitTotal = explicit.reduce((sum, value) => sum + value, 0);

  if (explicitTotal <= 0) {
    return createEqualWidths(panes);
  }

  panes.forEach((pane, index) => {
    next[pane.id] = (explicit[index] / explicitTotal) * 100;
  });

  return next;
}

export function insertPaneAfter(
  layout: ShellLayoutState,
  pane: AppPaneDescriptor,
  afterPaneId?: string | null
): ShellLayoutState {
  const panes = [...layout.panes];
  const index = afterPaneId
    ? panes.findIndex((entry) => entry.id === afterPaneId)
    : panes.length - 1;

  panes.splice(index + 1, 0, pane);

  return {
    ...layout,
    panes,
    active_pane_id: pane.id,
    pane_widths: createEqualWidths(panes),
    updated_at: Date.now(),
  };
}

export function updatePaneInLayout(
  layout: ShellLayoutState,
  paneId: string,
  updater: (pane: AppPaneDescriptor) => AppPaneDescriptor
): ShellLayoutState {
  return {
    ...layout,
    panes: layout.panes.map((pane) => (pane.id === paneId ? updater(pane) : pane)),
    updated_at: Date.now(),
  };
}

export function replacePaneInLayout(
  layout: ShellLayoutState,
  paneId: string,
  replacementPane: AppPaneDescriptor
): ShellLayoutState {
  const panes = layout.panes.map((pane) =>
    pane.id === paneId
      ? {
          ...replacementPane,
          id: pane.id,
        }
      : pane
  );

  const paneWidths = { ...(layout.pane_widths ?? {}) };
  if (replacementPane.id !== paneId) {
    paneWidths[paneId] = paneWidths[paneId] ?? paneWidths[replacementPane.id] ?? 0;
    delete paneWidths[replacementPane.id];
  }

  return {
    ...layout,
    panes,
    active_pane_id: paneId,
    pane_widths: paneWidths,
    updated_at: Date.now(),
  };
}

export function removePaneFromLayout(
  layout: ShellLayoutState,
  paneId: string
): ShellLayoutState {
  const panes = layout.panes.filter((pane) => pane.id !== paneId);
  const activePaneId =
    layout.active_pane_id === paneId
      ? panes[Math.max(0, layout.panes.findIndex((pane) => pane.id === paneId) - 1)]?.id ??
        panes[0]?.id ??
        null
      : layout.active_pane_id;

  return {
    ...layout,
    panes,
    active_pane_id: activePaneId,
    pane_widths: createEqualWidths(panes),
    updated_at: Date.now(),
  };
}

export function movePaneToIndex(
  layout: ShellLayoutState,
  paneId: string,
  targetIndex: number
): ShellLayoutState {
  const currentIndex = layout.panes.findIndex((pane) => pane.id === paneId);
  if (currentIndex < 0) return layout;

  const remainingPanes = layout.panes.filter((pane) => pane.id !== paneId);
  const clampedIndex = Math.max(0, Math.min(targetIndex, remainingPanes.length));
  const movedPane = layout.panes[currentIndex];
  const panes = [...remainingPanes];
  panes.splice(clampedIndex, 0, movedPane);

  return {
    ...layout,
    panes,
    updated_at: Date.now(),
  };
}

export function findFirstPaneByType(
  layout: ShellLayoutState,
  type: AppPaneDescriptor["type"]
) {
  return layout.panes.find((pane) => pane.type === type) ?? null;
}

export function findOpenPlanId(layout: ShellLayoutState) {
  for (const pane of layout.panes) {
    if (pane.type === "plannerOutline" && pane.state.plan_id) return pane.state.plan_id;
    if (pane.type === "captureTray" && pane.state.plan_id) return pane.state.plan_id;
  }
  return null;
}

export function withNotesDraftAnchor(
  layout: ShellLayoutState,
  draftAnchor: TextAnchor
): ShellLayoutState {
  const notesPane = findFirstPaneByType(layout, "notes");
  if (!notesPane) {
    return insertPaneAfter(
      layout,
      createNotesPane({ draft_anchor: draftAnchor, scope: "currentChapter", selected_note_id: null }),
      layout.active_pane_id
    );
  }

  return {
    ...updatePaneInLayout(layout, notesPane.id, (pane) =>
      pane.type === "notes"
        ? {
            ...pane,
            state: {
              ...pane.state,
              draft_anchor: draftAnchor,
              scope: pane.state.scope ?? "currentChapter",
              selected_note_id: null,
            },
          }
        : pane
    ),
    active_pane_id: notesPane.id,
  };
}

export function withNotesSelection(
  layout: ShellLayoutState,
  selection: {
    selectedNoteId: string | null;
    scope?: NotesPaneScope;
  }
): ShellLayoutState {
  const notesPane = findFirstPaneByType(layout, "notes");
  if (!notesPane) {
    return insertPaneAfter(
      layout,
      createNotesPane({
        scope: selection.scope ?? "allNotes",
        selected_note_id: selection.selectedNoteId,
      }),
      layout.active_pane_id
    );
  }

  return {
    ...updatePaneInLayout(layout, notesPane.id, (pane) =>
      pane.type === "notes"
        ? {
            ...pane,
            state: {
              ...pane.state,
              scope: selection.scope ?? pane.state.scope ?? "allNotes",
              selected_note_id: selection.selectedNoteId,
            },
          }
        : pane
    ),
    active_pane_id: notesPane.id,
  };
}
