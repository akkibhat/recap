// Account-level state for a signed-in host, keyed by Firebase uid.
//
// Google Photos used to be connected per board: every party meant another
// consent screen, and the refresh token lived in that board's boardSecrets.
// It belongs to the Google account, not to one night, so it lives here and is
// granted once.
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

export function newUserAccountFields(): UserAccount {
  return { googlePhotosConnected: false, googlePhotosConnectedAt: null };
}

export function normaliseUserAccount(data: Partial<UserAccount>): UserAccount {
  return {
    googlePhotosConnected: data.googlePhotosConnected ?? false,
    googlePhotosConnectedAt: data.googlePhotosConnectedAt ?? null,
  };
}

export function normaliseUserSecret(data: Partial<UserSecret>): UserSecret {
  return {
    googlePhotosRefreshToken: data.googlePhotosRefreshToken ?? null,
    deletedAlbumId: data.deletedAlbumId ?? null,
    deletedAlbumUrl: data.deletedAlbumUrl ?? null,
  };
}
