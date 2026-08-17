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

// Auth is for HOSTS ONLY. Guests never sign in - they stay on a localStorage
// nanoid, which is the whole point of being able to join a board by scanning a
// code. Signing in gives a host a durable identity so their boards survive a
// cleared browser or a new phone, and so the admin page has something real to
// check against.
//
// Persistence is pinned to localStorage rather than Firebase's default, which
// prefers IndexedDB. The IndexedDB persistence layer closes its database
// whenever document.visibilityState becomes 'hidden' and then throws
// "Database is closing/hidden" on the next write:
//
//     async _openDb() {
//         if (this.isHiding) { throw new Error('Database is closing/hidden'); }
//
// Opening the sign-in popup takes focus off the page, so the tab reports
// hidden exactly as Firebase is trying to persist the new token - a race the
// popup usually wins on mobile, where the popup is a whole separate tab.
// localStorage has no open/close lifecycle, so there is nothing to race.
//
// This has to be set at initialisation, not with a later setPersistence call:
// the session is READ through the same mechanism, so writing tokens to one
// store and restoring from another would silently sign the host out on reload.
function createAuth(): Auth {
  // No localStorage during SSR, and nothing signs in there anyway.
  if (typeof window === "undefined") return getAuth(app);

  try {
    return initializeAuth(app, {
      // A list, so a browser that refuses localStorage (Safari private mode is
      // the classic) degrades to a session-scoped store and then to memory,
      // rather than failing sign-in outright. Note what is NOT in the list:
      // indexedDBLocalPersistence, the whole point of this change.
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
