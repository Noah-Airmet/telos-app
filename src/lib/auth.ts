import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User,
} from "firebase/auth";
import type { FirebaseServices } from "./firebase";

export function subscribeToAuth(
  services: FirebaseServices,
  callback: (user: User | null) => void
) {
  return onAuthStateChanged(services.auth, callback);
}

export async function signInWithGoogle(services: FirebaseServices) {
  try {
    await signInWithPopup(services.auth, services.googleProvider);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error
      ? String(error.code)
      : "";

    if (code === "auth/popup-blocked" || code === "auth/cancelled-popup-request") {
      await signInWithRedirect(services.auth, services.googleProvider);
      return;
    }

    throw error;
  }
}

export async function signInTest(services: FirebaseServices) {
  await signInAnonymously(services.auth);
}

export async function signOutUser(services: FirebaseServices) {
  await signOut(services.auth);
}
