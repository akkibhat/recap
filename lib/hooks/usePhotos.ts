"use client";

import { useMemo } from "react";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normalisePhoto, isVisible, Photo } from "@/lib/types/photo";
import { useCollectionList } from "./useFirestore";

// A photo with its position on the roll attached. The number is derived, not
// stored: it's the photo's rank in upload order across the whole board, so it
// needs the unfiltered list to be correct and can't live on the document
// without a counter and the write contention that comes with one.
export type RollPhoto = Photo & { frameNumber: string };

// Edge printing, as found along the rebate of a developed negative. Real 35mm
// alternates plain and "A"-suffixed numbers between the sprockets; a single
// consistent suffix reads the same at a glance and can't be misread as two
// different frames.
function toRollPhoto(photo: Photo, index: number): RollPhoto {
  return { ...photo, frameNumber: `${String(index + 1).padStart(2, "0")}A` };
}

// The board's visible photos, live, oldest first, each with its frame number.
export function usePhotos(boardId: string | null) {
  const q = useMemo(
    () =>
      boardId
        ? query(collection(db, "boards", boardId, "photos"), orderBy("uploadedAt", "asc"))
        : null,
    [boardId]
  );
  const result = useCollectionList<Photo>(q, normalisePhoto);

  // Deleted photos are filtered here rather than in the query, because
  // `where("deletedAt", "==", null)` would need a composite index deployed
  // before this code could run. The tradeoff: a deleted photo's document still
  // reaches the client, so this hides it from the UI, not from the network
  // tab. If deletion ever needs to mean "unreachable", move it into the query
  // and ship the index first.
  return useMemo(
    () => ({
      // Number BEFORE filtering, so deleting frame 3 doesn't renumber 4 into 3
      // and reshuffle every frame mid-party.
      data: result.data.map(toRollPhoto).filter(isVisible),
      loading: result.loading,
    }),
    [result.data, result.loading]
  );
}
