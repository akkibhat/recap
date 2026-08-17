"use client";

import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { newCommentFields, MAX_COMMENT_LENGTH } from "@/lib/types/comment";

export async function addComment(input: {
  boardId: string;
  photoId: string;
  body: string;
  authorName: string;
  authorGuestId: string;
}): Promise<void> {
  const body = input.body.trim().slice(0, MAX_COMMENT_LENGTH);
  if (!body) return;

  await addDoc(
    collection(db, "boards", input.boardId, "comments"),
    newCommentFields({
      photoId: input.photoId,
      body,
      authorName: input.authorName.trim(),
      authorGuestId: input.authorGuestId,
    })
  );
}

// Soft, exactly like photo deletion, and for the same reason: authorGuestId is
// a localStorage string, so "only your own" is a speed bump rather than a
// boundary. Nothing a client does here destroys anything.
//
// The host's own moderation goes through the API route instead, which the
// Admin SDK enforces properly.
export async function deleteOwnComment(
  boardId: string,
  commentId: string,
  guestId: string
): Promise<void> {
  await updateDoc(doc(db, "boards", boardId, "comments", commentId), {
    deletedAt: Date.now(),
    deletedBy: guestId,
  });
}
