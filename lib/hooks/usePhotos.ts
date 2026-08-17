"use client";

import { useMemo } from "react";
import { collection, query, where, orderBy } from "firebase/firestore";
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
    () => ({
      // Numbering happens BEFORE the filter, deliberately. Frame numbers are
      // exposed onto real film and don't move, so deleting frame 3 must not
      // renumber 4 into 3. Numbering the filtered list would do exactly that,
      // and the whole strip would silently reshuffle mid-party.
      data: result.data.map(toRollPhoto).filter(isVisible),
      loading: result.loading,
    }),
    [result.data, result.loading]
  );
}
