"use client";

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

// A guest removing their own photo. Soft only: this marks the doc and leaves
// both the document and the Storage object intact, so nothing here is
// destructive and a misfire stays recoverable from the admin page.
//
// The matching Firestore rule requires deletedBy to equal the photo's recorded
// contributorGuestId, so passing someone else's guestId is rejected. Both ids
// come from localStorage though, so this is a speed bump rather than a real
// boundary - which is exactly why the write is soft.
export async function deleteOwnPhoto(photoId: string, guestId: string): Promise<void> {
  await updateDoc(doc(db, "photos", photoId), {
    deletedAt: Date.now(),
    deletedBy: guestId,
  });
}

// Undo. Cheap precisely because deletion is soft - the document never went
// anywhere, so putting a photo back is just clearing the two fields.
//
// The matching rule only permits this when the photo was removed by its own
// contributor, so a guest can undo their own mistake but not a host's
// moderation decision.
export async function restoreOwnPhoto(photoId: string): Promise<void> {
  await updateDoc(doc(db, "photos", photoId), {
    deletedAt: null,
    deletedBy: null,
  });
}
