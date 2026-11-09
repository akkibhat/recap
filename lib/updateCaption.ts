"use client";

import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export const MAX_CAPTION_LENGTH = 280;

// Editing the caption on your own photo. The Firestore rule only allows it
// when the photo's contributorGuestId is the signed-in guest's uid, touches
// nothing but the caption, and keeps it within the length cap.
export async function updateCaption(
  boardId: string,
  photoId: string,
  caption: string
): Promise<void> {
  await updateDoc(doc(db, "boards", boardId, "photos", photoId), {
    caption: caption.trim().slice(0, MAX_CAPTION_LENGTH),
  });
}
