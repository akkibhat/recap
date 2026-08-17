"use client";

import { useMemo } from "react";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normalisePhoto, isVisible, Photo } from "@/lib/types/photo";
import { useCollectionList } from "./useFirestore";

// The frames taken off the roll during the night - the exact complement of
// usePhotos, which filters these out. Only the host end-of-board review reads
// them, so this is not subscribed on the guest join page.
export function useDeletedPhotos(boardId: string | null): { data: Photo[]; loading: boolean } {
  const q = useMemo(
    () =>
      boardId
        ? query(collection(db, "boards", boardId, "photos"), orderBy("uploadedAt", "asc"))
        : null,
    [boardId]
  );
  const { data, loading } = useCollectionList<Photo>(q, normalisePhoto);

  return useMemo(
    () => ({ data: data.filter((photo) => !isVisible(photo)), loading }),
    [data, loading]
  );
}
