"use client";

// Creating a board (POST /api/boards) mints a hostKey server-side and returns
// it once. This keeps that key per board in localStorage, so coming back to
// /host/[boardId] in the same browser keeps host privileges. A signed-in
// owner on another device gets it back from /api/boards/[boardId]/host-key.

// The localStorage key a board's hostKey is kept under.
function storageKey(boardId: string): string {
  return `recap:hostKey:${boardId}`;
}

// Stores the hostKey for a board in this browser.
export function saveHostKey(boardId: string, hostKey: string): void {
  localStorage.setItem(storageKey(boardId), hostKey);
}

// The stored hostKey for a board, or null if this browser doesn't have one.
export function getHostKey(boardId: string): string | null {
  return localStorage.getItem(storageKey(boardId));
}
