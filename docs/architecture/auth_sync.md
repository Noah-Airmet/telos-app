# Auth & Sync Architecture

Telos now supports an optional sync layer for study data while keeping the core reading experience local-first.

## 1. Goals

- Let a second tester sign in quickly with Google and see their own synced notes/highlights.
- Keep the app usable when Firebase is not configured.
- Preserve offline-first reading and annotation behavior.
- Avoid coupling UI components directly to a specific persistence backend.

## 2. Current Stack

- **Auth:** Firebase Authentication with Google OAuth
- **Sync store:** Cloud Firestore
- **Offline support:** Firestore local cache plus optimistic writes
- **Fallback mode:** local-only repository backed by `localStorage`

## 3. Current Data Scope

The sync layer currently covers:

- highlights
- notes
- reading state

Private imported resources such as dictionary JSON files are currently local-only.

## 4. Repository Boundary

The UI reads and writes study data through a repository abstraction in `src/lib/studyRepository.ts`.

Current implementations:

- `createLocalStudyRepository()` for local-only mode
- `createFirestoreStudyRepository()` for authenticated sync mode

This keeps reader and note components agnostic about where data is stored.

## 5. Auth Flow

1. `src/lib/firebase.ts` checks for Firebase environment variables.
2. If config exists, `AuthProvider` subscribes to Firebase auth state.
3. Signed-in users get a Firestore-backed study repository.
4. Signed-out users, or builds without Firebase config, use the local repository.
5. On first sign-in, local highlights/notes/reading state are seeded into the cloud repo if the remote store is empty.

## 6. Firestore Shape

Current collection shape:

- `users/{uid}/highlights/{highlightId}`
- `users/{uid}/notes/{noteId}`
- `users/{uid}/meta/reading_state`

This is intentionally small-scope for early testing.

## 7. Environment Variables

The app expects standard Vite Firebase env vars:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

If any are missing, the app stays in local-only mode.

## 8. Known Limits

- Sync is scoped to study data, not scripture content.
- Imported dictionaries and indices are local-only for now.
- There is no server-side moderation, sharing, or collaboration layer.
- Conflict handling currently relies on Firestore's last-write-wins document updates.

## 9. Next Steps

- Add explicit sync status indicators and failure states.
- Add deployed Firebase security rules and environment setup docs.
- Decide whether imported private resources should ever be synced per user.
- Revisit whether SQLite WASM + OPFS should become the primary local query/index layer beneath sync.
