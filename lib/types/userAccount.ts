// Account-level state for a signed-in host, keyed by Firebase uid. The Google
// Photos grant belongs to the Google account, not to one night, so it is
// stored here and granted once.
//
// Split into two documents on the same uid, mirroring boards/boardSecrets:
// this one is readable by its owner so the UI can show connection state live,
// and UserSecret is closed to every client.
export type UserAccount = {
  googlePhotosConnected: boolean;
  googlePhotosConnectedAt: number | null;
};

export type UserSecret = {
  googlePhotosRefreshToken: string | null;
  // The one permanent album that deleted photos are appended to, created
  // lazily the first time something is kept rather than purged. Account-level
  // because it is deliberately the same album across every board.
  deletedAlbumId: string | null;
  deletedAlbumUrl: string | null;
};

// Fills defaults for any field missing on the users/{uid} document.
export function normaliseUserAccount(data: Partial<UserAccount>): UserAccount {
  return {
    googlePhotosConnected: data.googlePhotosConnected ?? false,
    googlePhotosConnectedAt: data.googlePhotosConnectedAt ?? null,
  };
}

// Fills defaults for any field missing on the userSecrets/{uid} document.
export function normaliseUserSecret(data: Partial<UserSecret>): UserSecret {
  return {
    googlePhotosRefreshToken: data.googlePhotosRefreshToken ?? null,
    deletedAlbumId: data.deletedAlbumId ?? null,
    deletedAlbumUrl: data.deletedAlbumUrl ?? null,
  };
}
