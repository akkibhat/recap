"use client";

import { useEffect, useMemo, useState } from "react";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { normaliseBoard, Board } from "@/lib/types/board";
import { useDocumentData } from "./useFirestore";

export function useBoardById(boardId: string | null) {
  const ref = useMemo(() => (boardId ? doc(db, "boards", boardId) : null), [boardId]);
  return useDocumentData<Board>(ref, normaliseBoard);
}

// Guests arrive via a room code, not a document id, so this resolves the code
// first and then subscribes to the board by id.
//
// The resolve step is a server call rather than a Firestore query on purpose.
// Querying boards by roomCode from the client is a `list`, and list rules can't
// see a query's where-filters - so permitting it at all would permit
// enumerating every board on the project. See app/api/boards/by-code.
//
// The subscription afterwards is a plain document `get`, which guests are
// allowed, so the board stays live once resolved.
export function useBoardByRoomCode(roomCode: string | null) {
  const [boardId, setBoardId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    if (!roomCode) return;

    let cancelled = false;
    fetch(`/api/boards/by-code/${encodeURIComponent(roomCode)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { boardId: string } | null) => {
        if (cancelled) return;
        setBoardId(data?.boardId ?? null);
        setResolving(false);
      })
      .catch(() => {
        // An unknown code and a failed lookup are the same thing to a guest:
        // no board. JoinBoardClient shows "no board with that code" for both.
        if (!cancelled) setResolving(false);
      });

    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  const { data, loading } = useBoardById(boardId);

  // Stay "loading" across the whole two-step resolve, so the caller never
  // briefly sees a null board and renders "no board with that code" before the
  // lookup has even come back.
  return { data, loading: resolving || (boardId !== null && loading) };
}
