"use client";

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

// A guest removing their own photo. Soft only: this marks the doc and leaves
// both the document and the Storage object intact, so nothing here is
// destructive and a misfire stays recoverable from the admin page.
//
// The matching Firestore rule only allows this on a photo whose
// contributorGuestId is the signed-in guest's uid, with deletedBy set to that
// same uid. The write stays soft anyway, so a misfire is always recoverable.
export async function deleteOwnPhoto(
  boardId: string,
  photoId: string,
  guestId: string
): Promise<void> {
  await updateDoc(doc(db, "boards", boardId, "photos", photoId), {
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
export async function restoreOwnPhoto(boardId: string, photoId: string): Promise<void> {
  await updateDoc(doc(db, "boards", boardId, "photos", photoId), {
    deletedAt: null,
    deletedBy: null,
  });
}
