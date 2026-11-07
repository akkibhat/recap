// Public shape only - no hostKey here. A board doc is readable by anyone who
// knows its id (guests need this to join), so anything host-privileged lives
// in the separate BoardSecret doc instead, which clients can never read.
export type Board = {
  id: string;
  roomCode: string;
  title: string;
  createdAt: number;
  endedAt: number | null;
  // The Google account that created this board. Creating one now requires
  // sign-in, so this is only null for boards made before that, which keep
  // working on the hostKey alone. This is what makes a board survive a
  // cleared browser, and what the admin page and "my boards" list use.
  ownerUid: string | null;
  // Set once the archive has run AND the Storage copies have been deleted.
  // Doubles as the signal that photo.downloadUrl is now dead, so the gallery
  // must not try to render it - see HostBoardClient.
  googlePhotosArchivedAt: number | null;
  // A share link the host pasted in by hand. Google removed the sharing scope
  // on 2025-03-31 (albums.share now 403s), so there is no way to generate this
  // from code - the host taps Share -> Create link in the Google Photos app and
  // pastes the result. Public on purpose: this is the one album link that
  // actually opens for guests.
  googlePhotosShareUrl: string | null;
};

// The full document for a brand-new board.
export function newBoardFields(input: {
  title: string;
  roomCode: string;
  ownerUid: string | null;
}): Omit<Board, "id"> {
  return {
    roomCode: input.roomCode,
    title: input.title,
    createdAt: Date.now(),
    endedAt: null,
    ownerUid: input.ownerUid,
    googlePhotosArchivedAt: null,
    googlePhotosShareUrl: null,
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
    ownerUid: data.ownerUid ?? null,
    googlePhotosArchivedAt: data.googlePhotosArchivedAt ?? null,
    googlePhotosShareUrl: data.googlePhotosShareUrl ?? null,
  };
}
