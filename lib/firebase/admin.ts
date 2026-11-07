import { initializeApp, getApps, applicationDefault, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Server-only (API routes / server actions) - never imported from a
// "use client" file. Uses Application Default Credentials (the owner's own
// `gcloud auth application-default login`) rather than a separate service
// account key, since this is single-owner personal use - no key file to keep
// out of git, no extra IAM identity to manage.
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

// Exported so the auth helpers and routes can reach firebase-admin/auth off
// the same app instance rather than initialising a second one.
export const adminApp = getAdminApp();
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
