"use client";

import { doc, updateDoc, deleteField } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ReactionEmoji } from "@/lib/types/photo";

// Tapping the same reaction again clears it (toggle); tapping a different
// one replaces it - a guest only ever holds one reaction per photo.
export async function setReaction(
  photoId: string,
  guestId: string,
  emoji: ReactionEmoji,
  current: ReactionEmoji | undefined
): Promise<void> {
  const field = `reactedBy.${guestId}`;
  await updateDoc(doc(db, "photos", photoId), {
    [field]: current === emoji ? deleteField() : emoji,
  });
}
