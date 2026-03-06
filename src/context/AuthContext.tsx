import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import { signInWithGoogle, signOutUser, subscribeToAuth } from "../lib/auth";
import { getFirebaseServices } from "../lib/firebase";
import {
  createFirestoreStudyRepository,
  createLocalStudyRepository,
  migrateLocalStudyData,
  type StudyRepository,
} from "../lib/studyRepository";

type AuthStatus = "loading" | "anonymous" | "authenticated";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  repository: StudyRepository;
  hasCloudSupport: boolean;
  mode: "local" | "cloud";
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const services = useMemo(() => getFirebaseServices(), []);
  const localRepository = useMemo(() => createLocalStudyRepository(), []);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>(services ? "loading" : "anonymous");

  useEffect(() => {
    if (!services) {
      setStatus("anonymous");
      return;
    }

    return subscribeToAuth(services, (nextUser) => {
      setUser(nextUser);
      setStatus(nextUser ? "authenticated" : "anonymous");
    });
  }, [services]);

  const cloudRepository = useMemo(() => {
    if (!services || !user) return null;
    return createFirestoreStudyRepository(services.db, user.uid);
  }, [services, user]);

  useEffect(() => {
    if (!cloudRepository) return;

    migrateLocalStudyData(localRepository, cloudRepository).catch((error) => {
      console.error("Failed to migrate local study data to cloud sync.", error);
    });
  }, [cloudRepository, localRepository]);

  const value = useMemo<AuthContextValue>(() => {
    const repository = cloudRepository ?? localRepository;

    return {
      user,
      status,
      repository,
      hasCloudSupport: Boolean(services),
      mode: repository.mode,
      signIn: async () => {
        if (!services) return;
        await signInWithGoogle(services);
      },
      signOut: async () => {
        if (!services) return;
        await signOutUser(services);
      },
    };
  }, [cloudRepository, localRepository, services, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return value;
}
