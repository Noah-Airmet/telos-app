import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import {
  deleteLocalLessonBlock,
  deleteLocalLessonPlan,
  deleteLocalLessonSource,
  deleteLocalHighlight,
  deleteLocalNote,
  getLocalHighlights,
  getLocalLessonBlocks,
  getLocalLessonPlans,
  getLocalLessonSources,
  getLocalNotes,
  getLocalPlannerState,
  getLocalReadingState,
  getLocalShellLayoutState,
  saveLocalLessonBlock,
  saveLocalLessonPlan,
  saveLocalLessonSource,
  saveLocalHighlight,
  saveLocalNote,
  saveLocalPlannerState,
  saveLocalReadingState,
  saveLocalShellLayoutState,
  subscribeToLocalStudyData,
  type AppPaneDescriptor,
  type Highlight,
  type LessonBlock,
  type LessonPlan,
  type LessonSource,
  type Note,
  type PlannerState,
  type ReadingState,
  type ShellLayoutState,
} from "../db/db";
import type { Firestore } from "firebase/firestore";

export interface StudyRepository {
  mode: "local" | "cloud";
  canSync: boolean;
  listHighlights(): Promise<Highlight[]>;
  subscribeHighlights(callback: (highlights: Highlight[]) => void): () => void;
  saveHighlight(highlight: Highlight): Promise<void>;
  deleteHighlight(id: string): Promise<void>;
  listNotes(): Promise<Note[]>;
  subscribeNotes(callback: (notes: Note[]) => void): () => void;
  saveNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  listLessonPlans(): Promise<LessonPlan[]>;
  subscribeLessonPlans(callback: (lessonPlans: LessonPlan[]) => void): () => void;
  saveLessonPlan(lessonPlan: LessonPlan): Promise<void>;
  deleteLessonPlan(id: string): Promise<void>;
  listLessonBlocks(lessonPlanId: string): Promise<LessonBlock[]>;
  subscribeLessonBlocks(
    lessonPlanId: string,
    callback: (lessonBlocks: LessonBlock[]) => void
  ): () => void;
  saveLessonBlock(lessonBlock: LessonBlock): Promise<void>;
  deleteLessonBlock(lessonPlanId: string, id: string): Promise<void>;
  listLessonSources(lessonPlanId: string): Promise<LessonSource[]>;
  subscribeLessonSources(
    lessonPlanId: string,
    callback: (lessonSources: LessonSource[]) => void
  ): () => void;
  saveLessonSource(lessonSource: LessonSource): Promise<void>;
  deleteLessonSource(lessonPlanId: string, id: string): Promise<void>;
  getPlannerState(): Promise<PlannerState | null>;
  subscribePlannerState(callback: (plannerState: PlannerState | null) => void): () => void;
  savePlannerState(plannerState: PlannerState): Promise<void>;
  getShellLayoutState(): Promise<ShellLayoutState | null>;
  subscribeShellLayoutState(callback: (shellLayoutState: ShellLayoutState | null) => void): () => void;
  saveShellLayoutState(shellLayoutState: ShellLayoutState): Promise<void>;
  getReadingState(): Promise<ReadingState | null>;
  subscribeReadingState(callback: (readingState: ReadingState | null) => void): () => void;
  saveReadingState(readingState: ReadingState): Promise<void>;
}

function sortHighlights(highlights: Highlight[]) {
  return [...highlights].sort((a, b) => a.created_at - b.created_at);
}

function sortNotes(notes: Note[]) {
  return [...notes].sort((a, b) => b.updated_at - a.updated_at);
}

function sortLessonPlans(lessonPlans: LessonPlan[]) {
  return [...lessonPlans].sort((a, b) => b.last_opened_at - a.last_opened_at);
}

function sortLessonBlocks(lessonBlocks: LessonBlock[]) {
  return [...lessonBlocks].sort((a, b) => a.order - b.order);
}

function sortLessonSources(lessonSources: LessonSource[]) {
  return [...lessonSources].sort((a, b) => b.created_at - a.created_at);
}

function handleFirestoreSubscriptionError<T>(
  label: string,
  callback: (value: T) => void,
  fallback: T
) {
  return (error: Error) => {
    console.error(`Firestore subscription failed for ${label}.`, error);
    callback(fallback);
  };
}

export function createLocalStudyRepository(): StudyRepository {
  return {
    mode: "local",
    canSync: false,
    async listHighlights() {
      return sortHighlights(getLocalHighlights());
    },
    subscribeHighlights(callback) {
      callback(sortHighlights(getLocalHighlights()));
      return subscribeToLocalStudyData(() => {
        callback(sortHighlights(getLocalHighlights()));
      });
    },
    async saveHighlight(highlight) {
      saveLocalHighlight(highlight);
    },
    async deleteHighlight(id) {
      deleteLocalHighlight(id);
    },
    async listNotes() {
      return sortNotes(getLocalNotes());
    },
    subscribeNotes(callback) {
      callback(sortNotes(getLocalNotes()));
      return subscribeToLocalStudyData(() => {
        callback(sortNotes(getLocalNotes()));
      });
    },
    async saveNote(note) {
      saveLocalNote(note);
    },
    async deleteNote(id) {
      deleteLocalNote(id);
    },
    async listLessonPlans() {
      return sortLessonPlans(getLocalLessonPlans());
    },
    subscribeLessonPlans(callback) {
      callback(sortLessonPlans(getLocalLessonPlans()));
      return subscribeToLocalStudyData(() => {
        callback(sortLessonPlans(getLocalLessonPlans()));
      });
    },
    async saveLessonPlan(lessonPlan) {
      saveLocalLessonPlan(lessonPlan);
    },
    async deleteLessonPlan(id) {
      deleteLocalLessonPlan(id);
    },
    async listLessonBlocks(lessonPlanId) {
      return sortLessonBlocks(getLocalLessonBlocks(lessonPlanId));
    },
    subscribeLessonBlocks(lessonPlanId, callback) {
      callback(sortLessonBlocks(getLocalLessonBlocks(lessonPlanId)));
      return subscribeToLocalStudyData(() => {
        callback(sortLessonBlocks(getLocalLessonBlocks(lessonPlanId)));
      });
    },
    async saveLessonBlock(lessonBlock) {
      saveLocalLessonBlock(lessonBlock);
    },
    async deleteLessonBlock(_lessonPlanId, id) {
      deleteLocalLessonBlock(id);
    },
    async listLessonSources(lessonPlanId) {
      return sortLessonSources(getLocalLessonSources(lessonPlanId));
    },
    subscribeLessonSources(lessonPlanId, callback) {
      callback(sortLessonSources(getLocalLessonSources(lessonPlanId)));
      return subscribeToLocalStudyData(() => {
        callback(sortLessonSources(getLocalLessonSources(lessonPlanId)));
      });
    },
    async saveLessonSource(lessonSource) {
      saveLocalLessonSource(lessonSource);
    },
    async deleteLessonSource(_lessonPlanId, id) {
      deleteLocalLessonSource(id);
    },
    async getPlannerState() {
      return getLocalPlannerState();
    },
    subscribePlannerState(callback) {
      callback(getLocalPlannerState());
      return subscribeToLocalStudyData(() => {
        callback(getLocalPlannerState());
      });
    },
    async savePlannerState(plannerState) {
      saveLocalPlannerState(plannerState);
    },
    async getShellLayoutState() {
      return getLocalShellLayoutState();
    },
    subscribeShellLayoutState(callback) {
      callback(getLocalShellLayoutState());
      return subscribeToLocalStudyData(() => {
        callback(getLocalShellLayoutState());
      });
    },
    async saveShellLayoutState(shellLayoutState) {
      saveLocalShellLayoutState(shellLayoutState);
    },
    async getReadingState() {
      return getLocalReadingState();
    },
    subscribeReadingState(callback) {
      callback(getLocalReadingState());
      return subscribeToLocalStudyData(() => {
        callback(getLocalReadingState());
      });
    },
    async saveReadingState(readingState) {
      saveLocalReadingState(readingState);
    },
  };
}

function userCollection(
  db: Firestore,
  uid: string,
  collectionName: "highlights" | "notes" | "lesson_plans"
) {
  return collection(db, "users", uid, collectionName);
}

function readingStateDoc(db: Firestore, uid: string) {
  return doc(db, "users", uid, "meta", "reading_state");
}

function plannerStateDoc(db: Firestore, uid: string) {
  return doc(db, "users", uid, "meta", "planner_state");
}

function shellLayoutStateDoc(db: Firestore, uid: string) {
  return doc(db, "users", uid, "meta", "shell_layout_state");
}

function lessonPlanBlocksCollection(db: Firestore, uid: string, lessonPlanId: string) {
  return collection(db, "users", uid, "lesson_plans", lessonPlanId, "blocks");
}

function lessonPlanSourcesCollection(db: Firestore, uid: string, lessonPlanId: string) {
  return collection(db, "users", uid, "lesson_plans", lessonPlanId, "sources");
}

export function createFirestoreStudyRepository(
  db: Firestore,
  uid: string
): StudyRepository {
  return {
    mode: "cloud",
    canSync: true,
    async listHighlights() {
      const snapshot = await getDocs(
        query(userCollection(db, uid, "highlights"), orderBy("created_at", "asc"))
      );

      return snapshot.docs.map((item) => item.data() as Highlight);
    },
    subscribeHighlights(callback) {
      return onSnapshot(
        query(userCollection(db, uid, "highlights"), orderBy("created_at", "asc")),
        (snapshot) => {
          callback(snapshot.docs.map((item) => item.data() as Highlight));
        },
        handleFirestoreSubscriptionError("highlights", callback, [])
      );
    },
    async saveHighlight(highlight) {
      await setDoc(doc(db, "users", uid, "highlights", highlight.id), highlight, {
        merge: true,
      });
    },
    async deleteHighlight(id) {
      await deleteDoc(doc(db, "users", uid, "highlights", id));
    },
    async listNotes() {
      const snapshot = await getDocs(
        query(userCollection(db, uid, "notes"), orderBy("updated_at", "desc"))
      );

      return snapshot.docs.map((item) => item.data() as Note);
    },
    subscribeNotes(callback) {
      return onSnapshot(
        query(userCollection(db, uid, "notes"), orderBy("updated_at", "desc")),
        (snapshot) => {
          callback(snapshot.docs.map((item) => item.data() as Note));
        },
        handleFirestoreSubscriptionError("notes", callback, [])
      );
    },
    async saveNote(note) {
      await setDoc(doc(db, "users", uid, "notes", note.id), note, {
        merge: true,
      });
    },
    async deleteNote(id) {
      await deleteDoc(doc(db, "users", uid, "notes", id));
    },
    async listLessonPlans() {
      const snapshot = await getDocs(
        query(userCollection(db, uid, "lesson_plans"), orderBy("last_opened_at", "desc"))
      );

      return snapshot.docs.map((item) => item.data() as LessonPlan);
    },
    subscribeLessonPlans(callback) {
      return onSnapshot(
        query(userCollection(db, uid, "lesson_plans"), orderBy("last_opened_at", "desc")),
        (snapshot) => {
          callback(snapshot.docs.map((item) => item.data() as LessonPlan));
        },
        handleFirestoreSubscriptionError("lesson plans", callback, [])
      );
    },
    async saveLessonPlan(lessonPlan) {
      await setDoc(doc(db, "users", uid, "lesson_plans", lessonPlan.id), lessonPlan, {
        merge: true,
      });
    },
    async deleteLessonPlan(id) {
      await deleteDoc(doc(db, "users", uid, "lesson_plans", id));
    },
    async listLessonBlocks(lessonPlanId) {
      const snapshot = await getDocs(
        query(lessonPlanBlocksCollection(db, uid, lessonPlanId), orderBy("order", "asc"))
      );

      return snapshot.docs.map((item) => item.data() as LessonBlock);
    },
    subscribeLessonBlocks(lessonPlanId, callback) {
      return onSnapshot(
        query(lessonPlanBlocksCollection(db, uid, lessonPlanId), orderBy("order", "asc")),
        (snapshot) => {
          callback(snapshot.docs.map((item) => item.data() as LessonBlock));
        },
        handleFirestoreSubscriptionError(`lesson blocks:${lessonPlanId}`, callback, [])
      );
    },
    async saveLessonBlock(lessonBlock) {
      await setDoc(
        doc(db, "users", uid, "lesson_plans", lessonBlock.lesson_plan_id, "blocks", lessonBlock.id),
        lessonBlock,
        { merge: true }
      );
    },
    async deleteLessonBlock(lessonPlanId, id) {
      await deleteDoc(doc(db, "users", uid, "lesson_plans", lessonPlanId, "blocks", id));
    },
    async listLessonSources(lessonPlanId) {
      const snapshot = await getDocs(
        query(lessonPlanSourcesCollection(db, uid, lessonPlanId), orderBy("created_at", "desc"))
      );

      return snapshot.docs.map((item) => item.data() as LessonSource);
    },
    subscribeLessonSources(lessonPlanId, callback) {
      return onSnapshot(
        query(lessonPlanSourcesCollection(db, uid, lessonPlanId), orderBy("created_at", "desc")),
        (snapshot) => {
          callback(snapshot.docs.map((item) => item.data() as LessonSource));
        },
        handleFirestoreSubscriptionError(`lesson sources:${lessonPlanId}`, callback, [])
      );
    },
    async saveLessonSource(lessonSource) {
      await setDoc(
        doc(db, "users", uid, "lesson_plans", lessonSource.lesson_plan_id, "sources", lessonSource.id),
        lessonSource,
        { merge: true }
      );
    },
    async deleteLessonSource(lessonPlanId, id) {
      await deleteDoc(doc(db, "users", uid, "lesson_plans", lessonPlanId, "sources", id));
    },
    async getPlannerState() {
      const snapshot = await getDoc(plannerStateDoc(db, uid));
      return snapshot.exists() ? (snapshot.data() as PlannerState) : null;
    },
    subscribePlannerState(callback) {
      return onSnapshot(
        plannerStateDoc(db, uid),
        (snapshot) => {
          callback(snapshot.exists() ? (snapshot.data() as PlannerState) : null);
        },
        handleFirestoreSubscriptionError("planner state", callback, null)
      );
    },
    async savePlannerState(plannerState) {
      await setDoc(plannerStateDoc(db, uid), plannerState, {
        merge: true,
      });
    },
    async getShellLayoutState() {
      const snapshot = await getDoc(shellLayoutStateDoc(db, uid));
      return snapshot.exists() ? (snapshot.data() as ShellLayoutState) : null;
    },
    subscribeShellLayoutState(callback) {
      return onSnapshot(
        shellLayoutStateDoc(db, uid),
        (snapshot) => {
          callback(snapshot.exists() ? (snapshot.data() as ShellLayoutState) : null);
        },
        handleFirestoreSubscriptionError("shell layout state", callback, null)
      );
    },
    async saveShellLayoutState(shellLayoutState) {
      await setDoc(shellLayoutStateDoc(db, uid), shellLayoutState, {
        merge: true,
      });
    },
    async getReadingState() {
      const snapshot = await getDoc(readingStateDoc(db, uid));
      return snapshot.exists() ? (snapshot.data() as ReadingState) : null;
    },
    subscribeReadingState(callback) {
      return onSnapshot(
        readingStateDoc(db, uid),
        (snapshot) => {
          callback(snapshot.exists() ? (snapshot.data() as ReadingState) : null);
        },
        handleFirestoreSubscriptionError("reading state", callback, null)
      );
    },
    async saveReadingState(readingState) {
      await setDoc(readingStateDoc(db, uid), readingState, {
        merge: true,
      });
    },
  };
}

function migrateLegacyReadingStateToShell(
  readingState: ReadingState,
  plannerState: PlannerState | null
): ShellLayoutState {
  const readingPaneId = crypto.randomUUID();
  const notesPaneId = crypto.randomUUID();
  const syncGroupId = crypto.randomUUID();
  const panes: AppPaneDescriptor[] = [
    {
      id: readingPaneId,
      type: "reading",
      state: {
        profile: readingState.profile,
        book_id: readingState.book_id,
        chapter: readingState.chapter,
        sync_group_id: syncGroupId,
        linked_to_pane_id: null,
        show_comparison_diffs: false,
      },
    },
    {
      id: notesPaneId,
      type: "notes",
      state: {},
    },
  ];

  if (readingState.secondary_profile) {
    panes.push({
      id: crypto.randomUUID(),
      type: "reading",
      state: {
        profile: readingState.secondary_profile,
        book_id: readingState.book_id,
        chapter: readingState.chapter,
        sync_group_id: syncGroupId,
        linked_to_pane_id: readingPaneId,
        show_comparison_diffs: true,
      },
    });
  }

  if (plannerState?.last_opened_plan_id) {
    panes.push({
      id: crypto.randomUUID(),
      type: "plannerOutline",
      state: { plan_id: plannerState.last_opened_plan_id },
    });
  }

  return {
    id: "default",
    active_pane_id: readingPaneId,
    panes,
    updated_at: Date.now(),
  };
}

export async function migrateLocalStudyData(
  localRepository: StudyRepository,
  cloudRepository: StudyRepository
) {
  if (cloudRepository.mode !== "cloud") return;

  const [
    localHighlights,
    localNotes,
    localLessonPlans,
    localPlannerState,
    localShellLayoutState,
    localReadingState,
  ] =
    await Promise.all([
    localRepository.listHighlights(),
    localRepository.listNotes(),
    localRepository.listLessonPlans(),
    localRepository.getPlannerState(),
    localRepository.getShellLayoutState(),
    localRepository.getReadingState(),
  ]);

  const [
    remoteHighlights,
    remoteNotes,
    remoteLessonPlans,
    remotePlannerState,
    remoteShellLayoutState,
    remoteReadingState,
  ] =
    await Promise.all([
    cloudRepository.listHighlights(),
    cloudRepository.listNotes(),
    cloudRepository.listLessonPlans(),
    cloudRepository.getPlannerState(),
    cloudRepository.getShellLayoutState(),
    cloudRepository.getReadingState(),
  ]);

  const writes: Array<Promise<void>> = [];

  if (remoteHighlights.length === 0) {
    for (const highlight of localHighlights) {
      writes.push(cloudRepository.saveHighlight(highlight));
    }
  }

  if (remoteNotes.length === 0) {
    for (const note of localNotes) {
      writes.push(cloudRepository.saveNote(note));
    }
  }

  if (remoteLessonPlans.length === 0) {
    for (const lessonPlan of localLessonPlans) {
      writes.push(cloudRepository.saveLessonPlan(lessonPlan));

      const [blocks, sources] = await Promise.all([
        localRepository.listLessonBlocks(lessonPlan.id),
        localRepository.listLessonSources(lessonPlan.id),
      ]);

      for (const block of blocks) {
        writes.push(cloudRepository.saveLessonBlock(block));
      }

      for (const source of sources) {
        writes.push(cloudRepository.saveLessonSource(source));
      }
    }
  }

  if (!remotePlannerState && localPlannerState) {
    writes.push(cloudRepository.savePlannerState(localPlannerState));
  }

  if (!remoteShellLayoutState) {
    if (localShellLayoutState) {
      writes.push(cloudRepository.saveShellLayoutState(localShellLayoutState));
    } else if (localReadingState) {
      writes.push(
        cloudRepository.saveShellLayoutState(
          migrateLegacyReadingStateToShell(localReadingState, localPlannerState)
        )
      );
    }
  }

  if (!remoteReadingState && localReadingState) {
    writes.push(cloudRepository.saveReadingState(localReadingState));
  }

  await Promise.all(writes);
}
