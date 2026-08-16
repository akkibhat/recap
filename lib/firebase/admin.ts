import { initializeApp, getApps, applicationDefault, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Server-only (API routes / server actions) - never imported from a
// "use client" file. Uses Application Default Credentials (your own
// `gcloud auth application-default login` as akki@pi.co.nz) rather than a
// separate service account key, since this is single-owner personal use -
// no key file to keep out of git, no extra IAM identity to manage.
function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  return initializeApp({
    credential: applicationDefault(),
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

export const adminDb = getFirestore(getAdminApp());
export const adminStorage = getStorage(getAdminApp());
