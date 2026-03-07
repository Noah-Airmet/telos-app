import { useCallback, useEffect, useMemo, useRef, useState, type PointerEventHandler } from "react";
import { LandingPage } from "./components/LandingPage";
import { WorkspaceChooser } from "./components/WorkspaceChooser";
import { Sidebar } from "./components/Sidebar";
import { CommandPalette } from "./components/CommandPalette";
import { PaneHost } from "./components/PaneHost";
import { PlannerHomePane } from "./components/PlannerHomePane";
import { PlannerOutlinePane } from "./components/PlannerOutlinePane";
import { CaptureTrayPane } from "./components/CaptureTrayPane";
import { NotesPane } from "./components/NotesPane";
import { ReadingPane } from "./components/ReadingPane";
import { useAuth } from "./context/AuthContext";
import type {
  AppPaneDescriptor,
  LessonBlock,
  LessonBlockKind,
  LessonPlan,
  LessonPlanType,
  LessonSource,
  Note,
  PlannerState,
  ReadingPaneState,
  ShellLayoutState,
  TextAnchor,
} from "./db/db";
import type { BookEntry, TranslationManifest } from "./lib/scripture";
import { loadManifest } from "./lib/scripture";
import {
  buildLessonBlockFromSource,
  createLessonPlanFromTemplate,
  createStarterBlocks,
  exportLessonPlanToMarkdown,
} from "./lib/planner";
import {
  createCaptureTrayPane,
  createNotesPane,
  createPlannerHomePane,
  createPlannerOutlinePane,
  createReadingPane,
  createShellLayoutState,
  findOpenPlanId,
  insertPaneAfter,
  normalizePaneWidths,
  movePaneToIndex,
  removePaneFromLayout,
  updatePaneInLayout,
  withNotesDraftAnchor,
} from "./lib/workspace";

function normalizeBookKey(value?: string | null) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function getFirstChapterValue(book: BookEntry | null) {
  if (!book) return 1;
  return (
    book.chapters.find((entry) => typeof entry.chapter === "number")?.chapter ||
    book.chapters[0]?.chapter ||
    1
  );
}

function getChapterValueForBook(book: BookEntry | null, chapter: number) {
  if (!book) return chapter;
  return book.chapters.some((entry) => entry.chapter === chapter)
    ? chapter
    : getFirstChapterValue(book);
}

function findMatchingBook(
  translation: TranslationManifest | undefined,
  activeBook: BookEntry | null
) {
  if (!translation || !activeBook) return null;
  const key = normalizeBookKey(activeBook.canonical_book_id || activeBook.book_id);
  const name = normalizeBookKey(activeBook.name);
  return (
    translation.books.find((book) => normalizeBookKey(book.canonical_book_id || book.book_id) === key) ||
    translation.books.find((book) => normalizeBookKey(book.name) === name) ||
    null
  );
}

function getBookFromPaneState(
  manifests: TranslationManifest[],
  state: ReadingPaneState
) {
  const translation = manifests.find((manifest) => manifest.profile === state.profile);
  const book =
    translation?.books.find((entry) => entry.book_id === state.book_id) ??
    translation?.books[0] ??
    null;

  return {
    translation,
    book,
    chapter: book ? getChapterValueForBook(book, state.chapter) : state.chapter,
  };
}

function isReadingPane(pane: AppPaneDescriptor): pane is Extract<AppPaneDescriptor, { type: "reading" }> {
  return pane.type === "reading";
}

function isPlanPane(
  pane: AppPaneDescriptor
): pane is Extract<AppPaneDescriptor, { type: "plannerOutline" | "captureTray" }> {
  return pane.type === "plannerOutline" || pane.type === "captureTray";
}

function App() {
  const { status, repository, user, mode, signOut } = useAuth();
  const [manifests, setManifests] = useState<TranslationManifest[]>([]);
  const [plannerState, setPlannerState] = useState<PlannerState | null>(null);
  const [shellLayout, setShellLayout] = useState<ShellLayoutState | null>(null);
  const shellLayoutRef = useRef<ShellLayoutState | null>(null);
  const [hasHydratedShell, setHasHydratedShell] = useState(false);
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [lessonBlocksByPlanId, setLessonBlocksByPlanId] = useState<Record<string, LessonBlock[]>>({});
  const [lessonSourcesByPlanId, setLessonSourcesByPlanId] = useState<Record<string, LessonSource[]>>({});
  const [syncBlockIds, setSyncBlockIds] = useState<Record<string, string | null>>({});
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window === "undefined") return 320;
    return Number(window.localStorage.getItem("telos_sidebar_width") ?? "320");
  });
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("telos_sidebar_collapsed") === "true";
  });

  useEffect(() => {
    let cancelled = false;
    loadManifest().then((items) => {
      if (!cancelled) setManifests(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    return repository.subscribePlannerState(setPlannerState);
  }, [repository, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    return repository.subscribeLessonPlans(setLessonPlans);
  }, [repository, status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    return repository.subscribeShellLayoutState((nextShellLayout) => {
      shellLayoutRef.current = nextShellLayout;
      setShellLayout(nextShellLayout);
      setHasHydratedShell(true);
    });
  }, [repository, status]);

  useEffect(() => {
    shellLayoutRef.current = shellLayout;
  }, [shellLayout]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("telos_sidebar_width", String(Math.round(sidebarWidth)));
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("telos_sidebar_collapsed", String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  const openPlanIds = useMemo(() => {
    if (!shellLayout) return [];
    return [...new Set(
      shellLayout.panes
        .filter(isPlanPane)
        .map((pane) => pane.state.plan_id)
        .filter((planId): planId is string => Boolean(planId))
    )];
  }, [shellLayout]);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (openPlanIds.length === 0) return;

    const unsubscribers = openPlanIds.flatMap((planId) => [
      repository.subscribeLessonBlocks(planId, (blocks) => {
        setLessonBlocksByPlanId((previous) => ({ ...previous, [planId]: blocks }));
      }),
      repository.subscribeLessonSources(planId, (sources) => {
        setLessonSourcesByPlanId((previous) => ({ ...previous, [planId]: sources }));
      }),
    ]);

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [openPlanIds, repository, status]);

  const saveShellLayout = useCallback(
    (updater: ShellLayoutState | ((previous: ShellLayoutState) => ShellLayoutState)) => {
      const base = shellLayoutRef.current ?? createShellLayoutState([]);
      const next = typeof updater === "function" ? updater(base) : updater;
      shellLayoutRef.current = next;
      setShellLayout(next);
      repository.saveShellLayoutState(next).catch(console.error);
    },
    [repository]
  );

  const beginSidebarResize = useCallback((startX: number) => {
    const startWidth = sidebarWidth;
    const onMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.max(240, Math.min(520, startWidth + event.clientX - startX));
      setSidebarWidth(nextWidth);
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [sidebarWidth]);

  const persistPlannerState = useCallback(
    (updates: Partial<PlannerState>) => {
      const nextState: PlannerState = {
        id: plannerState?.id ?? "default",
        last_opened_plan_id: plannerState?.last_opened_plan_id ?? null,
        preferred_workspace: plannerState?.preferred_workspace ?? null,
        pinned_plan_ids: plannerState?.pinned_plan_ids ?? [],
        updated_at: Date.now(),
        ...updates,
      };
      setPlannerState(nextState);
      repository.savePlannerState(nextState).catch(console.error);
    },
    [plannerState, repository]
  );

  const getPlanById = useCallback(
    (planId: string | null) =>
      planId ? lessonPlans.find((plan) => plan.id === planId) ?? null : null,
    [lessonPlans]
  );

  const activePlanId = useMemo(
    () => (shellLayout ? findOpenPlanId(shellLayout) : null) ?? plannerState?.last_opened_plan_id ?? null,
    [plannerState, shellLayout]
  );
  const activePlan = getPlanById(activePlanId);

  const activePane = shellLayout?.panes.find((pane) => pane.id === shellLayout.active_pane_id) ?? null;
  const activeReadingPane =
    (activePane && isReadingPane(activePane) ? activePane : null) ??
    shellLayout?.panes.find(isReadingPane) ??
    null;

  const activeReadingLocation = activeReadingPane
    ? getBookFromPaneState(manifests, activeReadingPane.state)
    : { translation: null, book: null, chapter: 1 };

  const createInitialReaderShell = useCallback(async () => {
    const saved = await repository.getReadingState();
    const syncGroupId = crypto.randomUUID();
    const readingPane = createReadingPane({
      profile: saved?.profile ?? "lds-bom",
      book_id: saved?.book_id ?? null,
      chapter: saved?.chapter ?? 1,
      sync_group_id: syncGroupId,
    });
    const notesPane = createNotesPane();
    const nextShellLayout = createShellLayoutState([readingPane, notesPane], readingPane.id);
    saveShellLayout(nextShellLayout);
    persistPlannerState({ preferred_workspace: "reader" });
  }, [persistPlannerState, repository, saveShellLayout]);

  const createInitialPlannerShell = useCallback(() => {
    const plannerHomePane = createPlannerHomePane();
    const nextShellLayout = createShellLayoutState([plannerHomePane], plannerHomePane.id);
    saveShellLayout(nextShellLayout);
    persistPlannerState({ preferred_workspace: "planner" });
  }, [persistPlannerState, saveShellLayout]);

  const openGlobalNotesPane = useCallback(() => {
    saveShellLayout((previous) => {
      const notesPane = previous.panes.find((pane) => pane.type === "notes");
      if (notesPane) {
        return {
          ...previous,
          active_pane_id: notesPane.id,
          updated_at: Date.now(),
        };
      }
      return insertPaneAfter(previous, createNotesPane(), previous.active_pane_id);
    });
  }, [saveShellLayout]);

  const openPlannerHomePane = useCallback(() => {
    saveShellLayout((previous) => insertPaneAfter(previous, createPlannerHomePane(), previous.active_pane_id));
    persistPlannerState({ preferred_workspace: "planner" });
  }, [persistPlannerState, saveShellLayout]);

  const openStandaloneReadingPane = useCallback(async () => {
    const saved = await repository.getReadingState();
    saveShellLayout((previous) =>
      insertPaneAfter(
        previous,
        createReadingPane({
          profile: saved?.profile ?? activeReadingPane?.state.profile ?? "lds-bom",
          book_id: saved?.book_id ?? activeReadingPane?.state.book_id ?? null,
          chapter: saved?.chapter ?? activeReadingPane?.state.chapter ?? 1,
        }),
        previous.active_pane_id
      )
    );
  }, [activeReadingPane, repository, saveShellLayout]);

  const openReadingPaneAt = useCallback(
    (profile: string, bookId: string, chapter: number) => {
      saveShellLayout((previous) =>
        insertPaneAfter(
          previous,
          createReadingPane({
            profile,
            book_id: bookId,
            chapter,
          }),
          previous.active_pane_id
        )
      );
    },
    [saveShellLayout]
  );

  const addLinkedReadingPane = useCallback(
    (sourcePaneId: string) => {
      if (!shellLayout) return;
      const sourcePane = shellLayout.panes.find((pane) => pane.id === sourcePaneId);
      if (!sourcePane || !isReadingPane(sourcePane)) return;

      const sourceLocation = getBookFromPaneState(manifests, sourcePane.state);
      const usedProfiles = new Set(
        shellLayout.panes.filter(isReadingPane).map((pane) => pane.state.profile).filter(Boolean)
      );
      const nextManifest =
        manifests.find((manifest) => !usedProfiles.has(manifest.profile)) ??
        manifests.find((manifest) => manifest.profile !== sourcePane.state.profile) ??
        manifests[0] ??
        null;
      const matchingBook =
        nextManifest && sourceLocation.book
          ? findMatchingBook(nextManifest, sourceLocation.book) ?? nextManifest.books[0] ?? null
          : nextManifest?.books[0] ?? null;

      saveShellLayout((previous) =>
        insertPaneAfter(
          previous,
          createReadingPane({
            profile: nextManifest?.profile ?? sourcePane.state.profile,
            book_id: matchingBook?.book_id ?? sourcePane.state.book_id,
            chapter: sourceLocation.chapter,
            sync_group_id: sourcePane.state.sync_group_id ?? crypto.randomUUID(),
            linked_to_pane_id: sourcePane.id,
            show_comparison_diffs: true,
          }),
          sourcePaneId
        )
      );
    },
    [manifests, saveShellLayout, shellLayout]
  );

  const closePane = useCallback(
    (paneId: string) => {
      saveShellLayout((previous) => removePaneFromLayout(previous, paneId));
    },
    [saveShellLayout]
  );

  const focusPane = useCallback(
    (paneId: string) => {
      saveShellLayout((previous) => ({
        ...previous,
        active_pane_id: paneId,
        updated_at: Date.now(),
      }));
    },
    [saveShellLayout]
  );

  const updatePaneWidths = useCallback(
    (paneWidths: Record<string, number>) => {
      saveShellLayout((previous) => ({
        ...previous,
        pane_widths: normalizePaneWidths(previous.panes, paneWidths),
        updated_at: Date.now(),
      }));
    },
    [saveShellLayout]
  );

  const updatePaneState = useCallback(
    (
      paneId: string,
      type: AppPaneDescriptor["type"],
      updater: (state: AppPaneDescriptor["state"]) => AppPaneDescriptor["state"]
    ) => {
      saveShellLayout((previous) =>
        updatePaneInLayout(previous, paneId, (pane) => {
          if (pane.type !== type) return pane;
          return {
            ...pane,
            state: updater(pane.state),
          } as AppPaneDescriptor;
        })
      );
    },
    [saveShellLayout]
  );

  const syncReadingGroupLocation = useCallback(
    (
      sourcePaneId: string,
      nextProfile: string | null,
      nextBookId: string | null,
      nextChapter: number
    ) => {
      if (!shellLayout) return;
      const sourcePane = shellLayout.panes.find((pane) => pane.id === sourcePaneId);
      if (!sourcePane || !isReadingPane(sourcePane)) return;

      const nextSourceLocation = getBookFromPaneState(manifests, {
        ...sourcePane.state,
        profile: nextProfile,
        book_id: nextBookId,
        chapter: nextChapter,
      });

      saveShellLayout((previous) => ({
        ...previous,
        panes: previous.panes.map((pane) => {
          if (!isReadingPane(pane)) return pane;
          if (pane.id === sourcePaneId) {
            return {
              ...pane,
              state: {
                ...pane.state,
                profile: nextProfile,
                book_id: nextBookId,
                chapter: nextChapter,
              },
            };
          }

          if (!pane.state.sync_group_id || pane.state.sync_group_id !== sourcePane.state.sync_group_id) {
            return pane;
          }

          if (!nextSourceLocation.book || !pane.state.profile) return pane;
          const targetManifest = manifests.find((manifest) => manifest.profile === pane.state.profile);
          const matchingBook = findMatchingBook(targetManifest, nextSourceLocation.book);
          if (!matchingBook) return pane;

          return {
            ...pane,
            state: {
              ...pane.state,
              book_id: matchingBook.book_id,
              chapter: getChapterValueForBook(matchingBook, nextChapter),
            },
          };
        }),
        updated_at: Date.now(),
      }));
    },
    [manifests, saveShellLayout, shellLayout]
  );

  const updateActiveReadingPaneLocation = useCallback(
    (profile: string, book: BookEntry, chapter: number) => {
      if (!activeReadingPane) return;
      syncReadingGroupLocation(activeReadingPane.id, profile, book.book_id, chapter);
    },
    [activeReadingPane, syncReadingGroupLocation]
  );

  const handleOpenPlan = useCallback(
    async (planId: string, sourcePaneId?: string) => {
      const plan = getPlanById(planId);
      const now = Date.now();
      if (plan) {
        await repository.saveLessonPlan({
          ...plan,
          last_opened_at: now,
          updated_at: now,
        });
      }

      persistPlannerState({
        last_opened_plan_id: planId,
        preferred_workspace: "planner",
      });

      saveShellLayout((previous) => {
        const existingOutline = previous.panes.find(
          (pane) => pane.type === "plannerOutline" && pane.state.plan_id === planId
        );
        if (existingOutline) {
          return {
            ...previous,
            active_pane_id: existingOutline.id,
            updated_at: Date.now(),
          };
        }

        const outlinePane = createPlannerOutlinePane(planId);
        const withOutline = insertPaneAfter(previous, outlinePane, sourcePaneId ?? previous.active_pane_id);
        const existingCapture = withOutline.panes.find(
          (pane) => pane.type === "captureTray" && pane.state.plan_id === planId
        );
        return existingCapture
          ? withOutline
          : insertPaneAfter(withOutline, createCaptureTrayPane(planId), outlinePane.id);
      });
    },
    [getPlanById, persistPlannerState, repository, saveShellLayout]
  );

  const handleCreatePlan = useCallback(
    async (type: LessonPlanType, sourcePaneId?: string) => {
      const plan = createLessonPlanFromTemplate(type);
      const blocks = createStarterBlocks(plan.id, type);

      await repository.saveLessonPlan(plan);
      await Promise.all(blocks.map((block) => repository.saveLessonBlock(block)));
      await handleOpenPlan(plan.id, sourcePaneId);
    },
    [handleOpenPlan, repository]
  );

  const savePlan = useCallback(
    async (planId: string, updates: Partial<LessonPlan>) => {
      const plan = getPlanById(planId);
      if (!plan) return;
      await repository.saveLessonPlan({
        ...plan,
        ...updates,
        updated_at: Date.now(),
      });
    },
    [getPlanById, repository]
  );

  const updateLessonBlock = useCallback(
    (planId: string, blockId: string, updates: Partial<LessonBlock>) => {
      const block = lessonBlocksByPlanId[planId]?.find((entry) => entry.id === blockId);
      if (!block) return;
      repository.saveLessonBlock({ ...block, ...updates }).catch(console.error);
      void savePlan(planId, {});
    },
    [lessonBlocksByPlanId, repository, savePlan]
  );

  const addLessonBlock = useCallback(
    (planId: string, kind: LessonBlockKind) => {
      const nextOrder =
        (lessonBlocksByPlanId[planId] ?? []).reduce((max, block) => Math.max(max, block.order), -1) + 1;
      repository
        .saveLessonBlock({
          id: crypto.randomUUID(),
          lesson_plan_id: planId,
          kind,
          content: "",
          order: nextOrder,
        })
        .catch(console.error);
      void savePlan(planId, {});
    },
    [lessonBlocksByPlanId, repository, savePlan]
  );

  const deleteLessonBlock = useCallback(
    (planId: string, blockId: string) => {
      repository.deleteLessonBlock(planId, blockId).catch(console.error);
      void savePlan(planId, {});
    },
    [repository, savePlan]
  );

  const moveLessonBlock = useCallback(
    async (planId: string, blockId: string, direction: "up" | "down") => {
      const ordered = [...(lessonBlocksByPlanId[planId] ?? [])].sort((a, b) => a.order - b.order);
      const index = ordered.findIndex((block) => block.id === blockId);
      if (index < 0) return;
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= ordered.length) return;
      const current = ordered[index];
      const target = ordered[swapIndex];
      await Promise.all([
        repository.saveLessonBlock({ ...current, order: target.order }),
        repository.saveLessonBlock({ ...target, order: current.order }),
      ]);
      await savePlan(planId, {});
    },
    [lessonBlocksByPlanId, repository, savePlan]
  );

  const insertSourceIntoOutline = useCallback(
    async (planId: string, sourceId: string) => {
      const source = lessonSourcesByPlanId[planId]?.find((entry) => entry.id === sourceId);
      if (!source) return;
      const nextOrder =
        (lessonBlocksByPlanId[planId] ?? []).reduce((max, block) => Math.max(max, block.order), -1) + 1;
      await repository.saveLessonBlock(buildLessonBlockFromSource(planId, nextOrder, source));
      await savePlan(planId, {});
    },
    [lessonBlocksByPlanId, lessonSourcesByPlanId, repository, savePlan]
  );

  const removeLessonSource = useCallback(
    async (planId: string, sourceId: string) => {
      await repository.deleteLessonSource(planId, sourceId);
      await savePlan(planId, {});
    },
    [repository, savePlan]
  );

  const captureSelectionToPlan = useCallback(
    async (selection: {
      blockId: string;
      text: string;
      startOffset: number;
      endOffset: number;
    }) => {
      if (!activePlanId) return;
      await repository.saveLessonSource({
        id: crypto.randomUUID(),
        lesson_plan_id: activePlanId,
        source_type: "scripture",
        label: "Scripture Selection",
        content: selection.text,
        reference_label: selection.blockId,
        anchor: {
          block_id: selection.blockId,
          start_offset: selection.startOffset,
          end_offset: selection.endOffset,
        },
        created_at: Date.now(),
      });
      await savePlan(activePlanId, {});
    },
    [activePlanId, repository, savePlan]
  );

  const captureNoteToPlan = useCallback(
    async (note: Note) => {
      if (!activePlanId) return;
      await repository.saveLessonSource({
        id: crypto.randomUUID(),
        lesson_plan_id: activePlanId,
        source_type: "note",
        label: "Study Note",
        content: note.text,
        reference_label: note.block_id,
        anchor: note.anchor,
        note_id: note.id,
        created_at: Date.now(),
      });
      await savePlan(activePlanId, {});
    },
    [activePlanId, repository, savePlan]
  );

  const exportPlanMarkdown = useCallback(
    (planId: string) => {
      const plan = getPlanById(planId);
      if (!plan) return;
      const markdown = exportLessonPlanToMarkdown(plan, lessonBlocksByPlanId[planId] ?? []);
      const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const slug = plan.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      anchor.href = url;
      anchor.download = `${slug || "lesson-plan"}.md`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
    [getPlanById, lessonBlocksByPlanId]
  );

  const openNotesWithDraft = useCallback(
    (draftAnchor: TextAnchor) => {
      saveShellLayout((previous) => withNotesDraftAnchor(previous, draftAnchor));
    },
    [saveShellLayout]
  );

  const handleVisibleReadingBlockChange = useCallback(
    (paneId: string, blockId: string) => {
      const pane = shellLayout?.panes.find((entry) => entry.id === paneId);
      if (!pane || !isReadingPane(pane) || !pane.state.sync_group_id) return;
      setSyncBlockIds((previous) => ({
        ...previous,
        [pane.state.sync_group_id as string]: blockId,
      }));
    },
    [shellLayout]
  );

  const renderPane = (
    pane: AppPaneDescriptor,
    controls: { onHeaderPointerDown: PointerEventHandler<HTMLElement> }
  ) => {
      const isActive = shellLayout?.active_pane_id === pane.id;

      if (pane.type === "plannerHome") {
        return (
          <PlannerHomePane
            lessonPlans={lessonPlans}
            pinnedPlanIds={plannerState?.pinned_plan_ids}
            isActive={isActive}
            onFocus={() => focusPane(pane.id)}
            onHeaderPointerDown={controls.onHeaderPointerDown}
            onClose={shellLayout && shellLayout.panes.length > 1 ? () => closePane(pane.id) : undefined}
            onCreatePlan={(type) => {
              void handleCreatePlan(type, pane.id);
            }}
            onOpenPlan={(planId) => {
              void handleOpenPlan(planId, pane.id);
            }}
            onOpenReader={() => {
              void openStandaloneReadingPane();
            }}
          />
        );
      }

      if (pane.type === "plannerOutline") {
        const planId = pane.state.plan_id;
        return (
          <PlannerOutlinePane
            lessonPlan={getPlanById(planId)}
            lessonBlocks={planId ? lessonBlocksByPlanId[planId] ?? [] : []}
            isActive={isActive}
            onFocus={() => focusPane(pane.id)}
            onHeaderPointerDown={controls.onHeaderPointerDown}
            onClose={shellLayout && shellLayout.panes.length > 1 ? () => closePane(pane.id) : undefined}
            onRenamePlan={(title) => {
              if (!planId) return;
              void savePlan(planId, { title });
            }}
            onUpdateBlock={(blockId, updates) => {
              if (!planId) return;
              updateLessonBlock(planId, blockId, updates);
            }}
            onAddBlock={(kind) => {
              if (!planId) return;
              addLessonBlock(planId, kind);
            }}
            onDeleteBlock={(blockId) => {
              if (!planId) return;
              deleteLessonBlock(planId, blockId);
            }}
            onMoveBlock={(blockId, direction) => {
              if (!planId) return;
              void moveLessonBlock(planId, blockId, direction);
            }}
            onExportMarkdown={() => {
              if (!planId) return;
              exportPlanMarkdown(planId);
            }}
          />
        );
      }

      if (pane.type === "captureTray") {
        const planId = pane.state.plan_id;
        return (
          <CaptureTrayPane
            lessonPlan={getPlanById(planId)}
            lessonSources={planId ? lessonSourcesByPlanId[planId] ?? [] : []}
            isActive={isActive}
            onFocus={() => focusPane(pane.id)}
            onHeaderPointerDown={controls.onHeaderPointerDown}
            onClose={shellLayout && shellLayout.panes.length > 1 ? () => closePane(pane.id) : undefined}
            onInsertSourceIntoOutline={(sourceId) => {
              if (!planId) return;
              void insertSourceIntoOutline(planId, sourceId);
            }}
            onRemoveSource={(sourceId) => {
              if (!planId) return;
              void removeLessonSource(planId, sourceId);
            }}
          />
        );
      }

      if (pane.type === "notes") {
        return (
          <NotesPane
            draftNoteTarget={pane.state.draft_anchor}
            activePlanLabel={activePlan?.title ?? null}
            isActive={isActive}
            onFocus={() => focusPane(pane.id)}
            onHeaderPointerDown={controls.onHeaderPointerDown}
            onClose={shellLayout && shellLayout.panes.length > 1 ? () => closePane(pane.id) : undefined}
            onClearDraft={() =>
              updatePaneState(pane.id, "notes", (state) => ({
                ...(state as Extract<AppPaneDescriptor, { type: "notes" }>["state"]),
                draft_anchor: null,
              }))
            }
            onSendToPlan={activePlan ? captureNoteToPlan : undefined}
          />
        );
      }

      const linkedPane =
        pane.state.linked_to_pane_id
          ? shellLayout?.panes.find((entry) => entry.id === pane.state.linked_to_pane_id)
          : null;
      const linkedReadingPane = linkedPane && isReadingPane(linkedPane) ? linkedPane : null;
      const paneLocation = getBookFromPaneState(manifests, pane.state);
      const comparisonLocation = linkedReadingPane
        ? getBookFromPaneState(manifests, linkedReadingPane.state)
        : { translation: null, book: null, chapter: 1 };

      return (
        <ReadingPane
          profile={pane.state.profile ?? ""}
          book={paneLocation.book}
          chapter={paneLocation.chapter}
          onPrev={() => {
            if (!paneLocation.book || !paneLocation.translation) return;
            const chapterIndex = paneLocation.book.chapters.findIndex(
              (entry) => entry.chapter === paneLocation.chapter
            );
            if (chapterIndex > 0) {
              syncReadingGroupLocation(
                pane.id,
                pane.state.profile,
                paneLocation.book.book_id,
                paneLocation.book.chapters[chapterIndex - 1].chapter || getFirstChapterValue(paneLocation.book)
              );
              return;
            }
            const bookIndex = paneLocation.translation.books.indexOf(paneLocation.book);
            if (bookIndex > 0) {
              const previousBook = paneLocation.translation.books[bookIndex - 1];
              syncReadingGroupLocation(
                pane.id,
                pane.state.profile,
                previousBook.book_id,
                [...previousBook.chapters]
                  .reverse()
                  .find((entry) => typeof entry.chapter === "number")?.chapter || getFirstChapterValue(previousBook)
              );
            }
          }}
          onNext={() => {
            if (!paneLocation.book || !paneLocation.translation) return;
            const chapterIndex = paneLocation.book.chapters.findIndex(
              (entry) => entry.chapter === paneLocation.chapter
            );
            if (chapterIndex < paneLocation.book.chapters.length - 1) {
              syncReadingGroupLocation(
                pane.id,
                pane.state.profile,
                paneLocation.book.book_id,
                paneLocation.book.chapters[chapterIndex + 1].chapter || getFirstChapterValue(paneLocation.book)
              );
              return;
            }
            const bookIndex = paneLocation.translation.books.indexOf(paneLocation.book);
            if (bookIndex < paneLocation.translation.books.length - 1) {
              const nextBook = paneLocation.translation.books[bookIndex + 1];
              syncReadingGroupLocation(
                pane.id,
                pane.state.profile,
                nextBook.book_id,
                getFirstChapterValue(nextBook)
              );
            }
          }}
          hasPrev={Boolean(
            paneLocation.book &&
              paneLocation.translation &&
              (paneLocation.book.chapters.findIndex((entry) => entry.chapter === paneLocation.chapter) > 0 ||
                paneLocation.translation.books.indexOf(paneLocation.book) > 0)
          )}
          hasNext={Boolean(
            paneLocation.book &&
              paneLocation.translation &&
              (paneLocation.book.chapters.findIndex((entry) => entry.chapter === paneLocation.chapter) <
                paneLocation.book.chapters.length - 1 ||
                paneLocation.translation.books.indexOf(paneLocation.book) <
                  paneLocation.translation.books.length - 1)
          )}
          manifests={manifests}
          onChangeProfile={(profile) => {
            const translation = manifests.find((manifest) => manifest.profile === profile);
            const match =
              translation && paneLocation.book ? findMatchingBook(translation, paneLocation.book) : null;
            const nextBook = match ?? translation?.books[0] ?? null;
            const nextChapter = match
              ? getChapterValueForBook(nextBook, paneLocation.chapter)
              : getFirstChapterValue(nextBook);
            syncReadingGroupLocation(pane.id, profile, nextBook?.book_id ?? null, nextChapter);
          }}
          onSelectBook={(book) => {
            syncReadingGroupLocation(pane.id, pane.state.profile, book.book_id, getFirstChapterValue(book));
          }}
          onSelectChapter={(chapter) => {
            syncReadingGroupLocation(pane.id, pane.state.profile, paneLocation.book?.book_id ?? null, chapter);
          }}
          onAddPane={() => addLinkedReadingPane(pane.id)}
          onClose={shellLayout && shellLayout.panes.length > 1 ? () => closePane(pane.id) : undefined}
          comparisonProfile={linkedReadingPane?.state.profile ?? undefined}
          comparisonBook={comparisonLocation.book}
          showComparisonDiffs={Boolean(linkedReadingPane && pane.state.show_comparison_diffs)}
          onToggleComparisonDiffs={
            linkedReadingPane
              ? () =>
                  updatePaneState(pane.id, "reading", (state) => ({
                    ...(state as Extract<AppPaneDescriptor, { type: "reading" }>["state"]),
                    show_comparison_diffs: !(
                      state as Extract<AppPaneDescriptor, { type: "reading" }>["state"]
                    ).show_comparison_diffs,
                  }))
              : undefined
          }
          isActivePane={isActive}
          onVisibleBlockChange={(blockId) => handleVisibleReadingBlockChange(pane.id, blockId)}
          syncBlockId={
            !isActive && pane.state.sync_group_id
              ? syncBlockIds[pane.state.sync_group_id] ?? undefined
              : undefined
          }
          onAddNote={openNotesWithDraft}
          activePlanLabel={activePlan?.title ?? null}
          onHeaderPointerDown={controls.onHeaderPointerDown}
          onSendSelectionToPlan={activePlan ? captureSelectionToPlan : undefined}
        />
      );
    };

  if (status === "loading" || status === "anonymous") {
    return <LandingPage />;
  }

  if (!hasHydratedShell) {
    return <div className="min-h-screen bg-[var(--bg-app)]" />;
  }

  if (!shellLayout || shellLayout.panes.length === 0) {
    return (
      <WorkspaceChooser
        preferredWorkspace={plannerState?.preferred_workspace}
        lastPlan={activePlan}
        onChooseReader={() => {
          void createInitialReaderShell();
        }}
        onChoosePlanner={createInitialPlannerShell}
      />
    );
  }

  return (
    <div className="shell-root flex h-screen w-full overflow-hidden">
      {isSidebarCollapsed ? (
        <aside className="flex w-14 flex-shrink-0 flex-col items-center justify-between border-r border-[var(--border-color)] bg-[var(--bg-app)] py-4">
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(false)}
            className="shell-button px-2"
            title="Expand library"
          >
            →
          </button>
          <div className="shell-kicker [writing-mode:vertical-rl] rotate-180">Library</div>
          <div className="shell-meta [writing-mode:vertical-rl] rotate-180">{mode}</div>
        </aside>
      ) : (
        <>
          <div style={{ width: `${sidebarWidth}px` }} className="flex min-w-0 flex-shrink-0">
            <Sidebar
              manifests={manifests}
              activeProfile={activeReadingPane?.state.profile ?? "lds-bom"}
              activeBookId={activeReadingPane?.state.book_id ?? null}
              activeChapter={activeReadingPane?.state.chapter ?? 1}
              authStatus={status}
              authMode={mode}
              userName={user?.displayName || user?.email || null}
              onSignOut={signOut}
              onCollapse={() => setIsSidebarCollapsed(true)}
              onSelectTranslation={(profile) => {
                if (!activeReadingPane) return;
                const translation = manifests.find((manifest) => manifest.profile === profile);
                const currentBook = activeReadingLocation.book;
                const match = translation && currentBook ? findMatchingBook(translation, currentBook) : null;
                const nextBook = match ?? translation?.books[0] ?? null;
                const nextChapter = match
                  ? getChapterValueForBook(nextBook, activeReadingLocation.chapter)
                  : getFirstChapterValue(nextBook);
                syncReadingGroupLocation(activeReadingPane.id, profile, nextBook?.book_id ?? null, nextChapter);
              }}
              onSelectBook={(book) => {
                if (!activeReadingPane) return;
                updateActiveReadingPaneLocation(
                  activeReadingPane.state.profile ?? "lds-bom",
                  book,
                  getFirstChapterValue(book)
                );
              }}
              onSelectChapter={(chapter) => {
                if (!activeReadingPane || !activeReadingLocation.book) return;
                updateActiveReadingPaneLocation(
                  activeReadingPane.state.profile ?? "lds-bom",
                  activeReadingLocation.book,
                  chapter
                );
              }}
            />
          </div>
          <div
            className="shell-resize-rail"
            onMouseDown={(event) => beginSidebarResize(event.clientX)}
          >
            <div className="shell-resize-grip" />
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shell-topbar">
          <div>
            <p className="shell-kicker">Authenticated Workspace</p>
            <h1 className="shell-title mt-2">TELOS SHELL</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void openStandaloneReadingPane()} className="shell-button">
              New Reader
            </button>
            <button type="button" onClick={openPlannerHomePane} className="shell-button">
              Planner Home
            </button>
            <button type="button" onClick={openGlobalNotesPane} className="shell-button">
              Notes
            </button>
            {activePlanId && (
              <button
                type="button"
                onClick={() =>
                  saveShellLayout((previous) =>
                    insertPaneAfter(previous, createCaptureTrayPane(activePlanId), previous.active_pane_id)
                  )
                }
                className="shell-button shell-button-primary"
              >
                Capture Tray
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setShellLayout(null);
                repository.saveShellLayoutState(createShellLayoutState([])).catch(console.error);
              }}
              className="shell-button"
            >
              Reset
            </button>
          </div>
        </header>

        <PaneHost
          panes={shellLayout.panes}
          activePaneId={shellLayout.active_pane_id}
          paneWidths={shellLayout.pane_widths}
          onFocusPane={focusPane}
          onResizePanes={updatePaneWidths}
          onReorderPane={(paneId, targetIndex) => {
            saveShellLayout((previous) => movePaneToIndex(previous, paneId, targetIndex));
          }}
          renderPane={renderPane}
        />
      </div>

      <CommandPalette
        manifests={manifests}
        onSelect={(profile, book, chapter) => {
          if (activeReadingPane) {
            syncReadingGroupLocation(activeReadingPane.id, profile, book.book_id, chapter);
            return;
          }
          openReadingPaneAt(profile, book.book_id, chapter);
        }}
      />
    </div>
  );
}

export default App;
