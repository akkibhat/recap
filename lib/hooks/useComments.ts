"use client";

import { useMemo } from "react";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normaliseComment, isCommentVisible, Comment } from "@/lib/types/comment";
import { useCollectionList } from "./useFirestore";

// Every comment on the board, grouped by photo.
//
// One subscription for the whole board rather than one per photo opened. A
// board's comments are small next to its photos, and having them all to hand
// is what lets each frame show a count without the lightbox being open. It
// also needs no composite index: the query is a plain ordered read of a
// subcollection, with the grouping done here.
export function useCommentsByPhoto(boardId: string | null): {
  byPhoto: Map<string, Comment[]>;
  loading: boolean;
} {
  const q = useMemo(
    () =>
      boardId
        ? query(collection(db, "boards", boardId, "comments"), orderBy("createdAt", "asc"))
        : null,
    [boardId]
  );
  const { data, loading } = useCollectionList<Comment>(q, normaliseComment);

  return useMemo(() => {
    const byPhoto = new Map<string, Comment[]>();
    for (const comment of data) {
      if (!isCommentVisible(comment)) continue;
      const existing = byPhoto.get(comment.photoId);
      if (existing) existing.push(comment);
      else byPhoto.set(comment.photoId, [comment]);
    }
    return { byPhoto, loading };
  }, [data, loading]);
}
