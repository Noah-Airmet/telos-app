import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  type Firestore,
} from "firebase/firestore";

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  googleProvider: GoogleAuthProvider;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let cachedServices: FirebaseServices | null | undefined;

export function hasFirebaseConfig() {
  return Object.values(firebaseConfig).every(
    (value) => typeof value === "string" && value.length > 0
  );
}

export function getFirebaseServices(): FirebaseServices | null {
  if (cachedServices !== undefined) {
    return cachedServices;
  }

  if (!hasFirebaseConfig()) {
    cachedServices = null;
    return cachedServices;
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

  let db: Firestore;
  try {
    db = initializeFirestore(app, {
      localCache: persistentLocalCache(),
    });
  } catch {
    db = getFirestore(app);
  }

  const auth = getAuth(app);
  auth.useDeviceLanguage();

  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({
    prompt: "select_account",
  });

  cachedServices = {
    app,
    auth,
    db,
    googleProvider,
  };

  return cachedServices;
}
