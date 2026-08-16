// Public shape only - no hostKey here. A board doc is readable by anyone who
// knows its id (guests need this to join), so anything host-privileged lives
// in the separate BoardSecret doc instead, which clients can never read.
export type Board = {
  id: string;
  roomCode: string;
  title: string;
  createdAt: number;
  endedAt: number | null;
  googlePhotosConnected: boolean;
};

export function newBoardFields(input: { title: string; roomCode: string }): Omit<Board, "id"> {
  return {
    roomCode: input.roomCode,
    title: input.title,
    createdAt: Date.now(),
    endedAt: null,
    googlePhotosConnected: false,
  };
}

// Fills defaults for any field missing on an older/partial document, so every
// read site sees a complete Board regardless of when it was written.
export function normaliseBoard(id: string, data: Partial<Board>): Board {
  return {
    id,
    roomCode: data.roomCode ?? "",
    title: data.title ?? "Untitled board",
    createdAt: data.createdAt ?? Date.now(),
    endedAt: data.endedAt ?? null,
    googlePhotosConnected: data.googlePhotosConnected ?? false,
  };
}
