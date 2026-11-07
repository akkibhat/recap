"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  browserPopupRedirectResolver,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Auth is for HOSTS ONLY. Guests never sign in; they stay on a localStorage
// nanoid. Hosts sign in to start boards and to keep them across devices.
//
// Persistence is pinned to localStorage rather than Firebase's default
// IndexedDB. The IndexedDB layer closes its database when the tab reports
// hidden and then throws "Database is closing/hidden" on the next write, and
// opening the sign-in popup hides the tab exactly as the new token is being
// saved (almost always on mobile). localStorage has nothing to race.
//
// It has to be set here at initialisation, not by a later setPersistence:
// the session is read back through the same store, so mixing the two would
// silently sign the host out on reload.
function createAuth(): Auth {
  // No localStorage during SSR, and nothing signs in there anyway.
  if (typeof window === "undefined") return getAuth(app);

  try {
    return initializeAuth(app, {
      // A list, so a browser that refuses localStorage (Safari private mode is
      // the classic) degrades to a session-scoped store and then to memory,
      // rather than failing sign-in outright. indexedDBLocalPersistence is
      // left out on purpose (see above).
      persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence],
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialised for this app. Happens constantly under HMR, which
    // re-runs this module against a Firebase app instance that outlives it.
    return getAuth(app);
  }
}

export const auth = createAuth();
