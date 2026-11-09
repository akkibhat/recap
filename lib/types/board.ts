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
  // Uploads so far, counting ones later removed. Guests bump it in the same
  // batch as each photo, and the Firestore rules refuse the batch once it
  // would pass MAX_PHOTOS_PER_BOARD. lastPhotoId is the photo that batch
  // created: the rules use it to tie every +1 to a real new photo, so the
  // counter can't be pushed up on its own to close someone's board.
  photoCount: number;
  lastPhotoId: string | null;
};

// Limits for a public board. Mirrored in firestore.rules and storage.rules,
// which are what actually enforce them; these are for the UI.
export const MAX_PHOTOS_PER_BOARD = 500;
export const BOARD_OPEN_DAYS = 7;
const BOARD_OPEN_MS = BOARD_OPEN_DAYS * 24 * 60 * 60 * 1000;

// Why a board isn't taking photos, or null while it still is.
export function boardClosedReason(board: Board, now = Date.now()): "ended" | "expired" | "full" | null {
  if (board.endedAt) return "ended";
  if (now >= board.createdAt + BOARD_OPEN_MS) return "expired";
  if (board.photoCount >= MAX_PHOTOS_PER_BOARD) return "full";
  return null;
}

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
    photoCount: 0,
    lastPhotoId: null,
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
    photoCount: data.photoCount ?? 0,
    lastPhotoId: data.lastPhotoId ?? null,
  };
}
