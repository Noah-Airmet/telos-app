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
  deleteLocalHighlight,
  deleteLocalNote,
  getLocalHighlights,
  getLocalNotes,
  getLocalReadingState,
  saveLocalHighlight,
  saveLocalNote,
  saveLocalReadingState,
  subscribeToLocalStudyData,
  type Highlight,
  type Note,
  type ReadingState,
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

function userCollection(db: Firestore, uid: string, collectionName: "highlights" | "notes") {
  return collection(db, "users", uid, collectionName);
}

function readingStateDoc(db: Firestore, uid: string) {
  return doc(db, "users", uid, "meta", "reading_state");
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
        }
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
        }
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
    async getReadingState() {
      const snapshot = await getDoc(readingStateDoc(db, uid));
      return snapshot.exists() ? (snapshot.data() as ReadingState) : null;
    },
    subscribeReadingState(callback) {
      return onSnapshot(readingStateDoc(db, uid), (snapshot) => {
        callback(snapshot.exists() ? (snapshot.data() as ReadingState) : null);
      });
    },
    async saveReadingState(readingState) {
      await setDoc(readingStateDoc(db, uid), readingState, {
        merge: true,
      });
    },
  };
}

export async function migrateLocalStudyData(
  localRepository: StudyRepository,
  cloudRepository: StudyRepository
) {
  if (cloudRepository.mode !== "cloud") return;

  const [localHighlights, localNotes, localReadingState] = await Promise.all([
    localRepository.listHighlights(),
    localRepository.listNotes(),
    localRepository.getReadingState(),
  ]);

  const [remoteHighlights, remoteNotes, remoteReadingState] = await Promise.all([
    cloudRepository.listHighlights(),
    cloudRepository.listNotes(),
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

  if (!remoteReadingState && localReadingState) {
    writes.push(cloudRepository.saveReadingState(localReadingState));
  }

  await Promise.all(writes);
}
