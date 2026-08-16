"use client";

import { useMemo } from "react";
import { collection, doc, query, where, limit } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normaliseBoard, Board } from "@/lib/types/board";
import { useCollectionList, useDocumentData } from "./useFirestore";

export function useBoardById(boardId: string | null) {
  const ref = useMemo(() => (boardId ? doc(db, "boards", boardId) : null), [boardId]);
  return useDocumentData<Board>(ref, normaliseBoard);
}

// Guests arrive via a room code, not a document id, so this resolves the
// code to a board id via a one-off query. Falls back gracefully to "not
// found" (empty result) if the code is wrong or the board was deleted.
export function useBoardByRoomCode(roomCode: string | null) {
  const q = useMemo(
    () =>
      roomCode
        ? query(collection(db, "boards"), where("roomCode", "==", roomCode.toUpperCase()), limit(1))
        : null,
    [roomCode]
  );
  const { data, loading } = useCollectionList<Board>(q, normaliseBoard);
  return { data: data[0] ?? null, loading };
}
