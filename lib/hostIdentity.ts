"use client";

// The host doesn't log in - creating a board (POST /api/boards) mints a
// hostKey server-side and returns it once. This just persists that key per
// board in localStorage, so returning to /host/[boardId] in the same
// browser still has host privileges without re-authenticating.
function storageKey(boardId: string): string {
  return `recap:hostKey:${boardId}`;
}

export function saveHostKey(boardId: string, hostKey: string): void {
  localStorage.setItem(storageKey(boardId), hostKey);
}

export function getHostKey(boardId: string): string | null {
  return localStorage.getItem(storageKey(boardId));
}
