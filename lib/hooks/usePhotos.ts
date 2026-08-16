"use client";

import { useMemo } from "react";
import { collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normalisePhoto, Photo } from "@/lib/types/photo";
import { useCollectionList } from "./useFirestore";

export function usePhotos(boardId: string | null) {
  const q = useMemo(
    () =>
      boardId
        ? query(collection(db, "photos"), where("boardId", "==", boardId), orderBy("uploadedAt", "asc"))
        : null,
    [boardId]
  );
  return useCollectionList<Photo>(q, normalisePhoto);
}
