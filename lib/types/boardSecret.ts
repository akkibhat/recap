// Lives in boardSecrets/{boardId} - a collection with no client access at
// all (see firestore.rules). Only Next.js API routes, using the Admin SDK,
// ever read or write this.
export type BoardSecret = {
  hostKey: string;
  googlePhotosAlbumId: string | null;
  googlePhotosAlbumUrl: string | null;
  // No longer read: the refresh token now lives on the account, in
  // userSecrets. Still written as null on new boards.
  googlePhotosRefreshToken: string | null;
};

// The full secret document for a brand-new board.
export function newBoardSecretFields(input: { hostKey: string }): BoardSecret {
  return {
    hostKey: input.hostKey,
    googlePhotosAlbumId: null,
    googlePhotosAlbumUrl: null,
    googlePhotosRefreshToken: null,
  };
}

// Fills defaults for any field missing on an older or partial document.
export function normaliseBoardSecret(data: Partial<BoardSecret>): BoardSecret {
  return {
    hostKey: data.hostKey ?? "",
    googlePhotosAlbumId: data.googlePhotosAlbumId ?? null,
    googlePhotosAlbumUrl: data.googlePhotosAlbumUrl ?? null,
    googlePhotosRefreshToken: data.googlePhotosRefreshToken ?? null,
  };
}
