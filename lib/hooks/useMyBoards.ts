"use client";

import { useMemo } from "react";
import { collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normaliseBoard, Board } from "@/lib/types/board";
import { useCollectionList } from "./useFirestore";

// Every board this signed-in host created, newest first. The ownerUid filter
// isn't only for correctness - the Firestore rule requires it, so a query
// without it is rejected outright rather than returning someone else's boards.
export function useMyBoards(uid: string | null) {
  const q = useMemo(
    () =>
      uid
        ? query(collection(db, "boards"), where("ownerUid", "==", uid), orderBy("createdAt", "desc"))
        : null,
    [uid]
  );
  return useCollectionList<Board>(q, normaliseBoard);
}
