"use client";

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export const MAX_CAPTION_LENGTH = 280;

// Editing the caption on your own photo.
//
// The Firestore rule validates the shape - caption is the only field this can
// touch, and it has a length cap - but it cannot tell WHO is editing. There is
// no auth for guests, and contributorGuestId is readable by anyone who can read
// the photo, so a determined client could edit someone else's caption.
//
// That is the same limitation the soft-delete rules carry, with one difference
// worth knowing: a delete can be undone, and a caption edit overwrites the old
// text. The honest fix for the whole class is guest auth; until then this is
// bounded by a board only being reachable by people holding its room code.
export async function updateCaption(
  boardId: string,
  photoId: string,
  caption: string
): Promise<void> {
  await updateDoc(doc(db, "boards", boardId, "photos", photoId), {
    caption: caption.trim().slice(0, MAX_CAPTION_LENGTH),
  });
}
