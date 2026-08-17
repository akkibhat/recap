"use client";

import { useMemo } from "react";
import { collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normalisePhoto, isVisible, Photo } from "@/lib/types/photo";
import { useCollectionList } from "./useFirestore";

export function usePhotos(boardId: string | null) {
  const q = useMemo(
    () =>
      boardId
        ? query(collection(db, "photos"), where("boardId", "==", boardId), orderBy("uploadedAt", "asc"))
        : null,
    [boardId]
  );
  const result = useCollectionList<Photo>(q, normalisePhoto);

  // Deleted photos are filtered here rather than in the query. Adding
  // `where("deletedAt", "==", null)` would need a second composite index
  // deployed before this code could run at all, and getting that ordering
  // wrong takes the whole gallery down.
  //
  // The tradeoff is that a deleted photo's document still reaches the client,
  // so this hides photos from the UI without hiding them from someone reading
  // the network tab. That's proportionate for a friends-only board, but it is
  // not redaction - if deletion ever needs to mean "unreachable", this has to
  // move into the query and the index has to ship first.
  return useMemo(
    () => ({ data: result.data.filter(isVisible), loading: result.loading }),
    [result.data, result.loading]
  );
}
