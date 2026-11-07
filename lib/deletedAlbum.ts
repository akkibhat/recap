import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { normaliseUserSecret } from "@/lib/types/userAccount";
import { Photo, storageFilename } from "@/lib/types/photo";
import { refreshAccessToken, createAlbum, uploadPhotoBytes, createMediaItems } from "@/lib/googlePhotos";

// The one Google Photos album, per account, that kept deleted photos go into.
export const DELETED_ALBUM_TITLE = "Recap - Deleted Photos";

// What the host chose for a photo they (or a guest) removed during the night.
export type DeletedDecision = "restore" | "keep" | "purge";

// Keeping is the default for anything the host didn't explicitly decide.
// This screen appears when a tired host is tapping through to finish, and
// wrongly keeping a photo costs a few megabytes; wrongly destroying one is
// permanent.
export const DEFAULT_DECISION: DeletedDecision = "keep";

// One album per Google account, not per board - the whole point is that it's
// the same album every time. Created lazily, so a host who never keeps a
// deleted photo never gets an empty album they didn't ask for.
async function getOrCreateDeletedAlbum(
  uid: string,
  accessToken: string
): Promise<{ id: string; productUrl: string | null }> {
  const secretRef = adminDb.collection("userSecrets").doc(uid);
  const secret = normaliseUserSecret((await secretRef.get()).data() ?? {});
  if (secret.deletedAlbumId) {
    return { id: secret.deletedAlbumId, productUrl: secret.deletedAlbumUrl };
  }

  // It can't be found by title on a later board either: albums.list needs
  // readonly.appcreateddata and this app only holds appendonly. So the id has
  // to be stored the first time, which is why it lives on the account.
  const album = await createAlbum(accessToken, DELETED_ALBUM_TITLE);
  await secretRef.set(
    { deletedAlbumId: album.id, deletedAlbumUrl: album.productUrl },
    { merge: true }
  );
  return { id: album.id, productUrl: album.productUrl };
}

export type ReviewOutcome = {
  restored: number;
  kept: number;
  purged: number;
  deletedAlbumUrl: string | null;
};

// Applies the host's decisions about photos removed during the night. Called
// from the end route, after archiving, so a photo that was restored has already
// had its chance to reach the board's own album.
export async function applyDeletedReview(
  boardId: string,
  ownerUid: string | null,
  photos: { photo: Photo; ref: FirebaseFirestore.DocumentReference }[],
  decisions: Record<string, DeletedDecision>
): Promise<ReviewOutcome> {
  const outcome: ReviewOutcome = { restored: 0, kept: 0, purged: 0, deletedAlbumUrl: null };
  if (photos.length === 0) return outcome;

  const bucket = adminStorage.bucket();

  const restore = photos.filter(({ photo }) => decisions[photo.id] === "restore");
  const purge = photos.filter(({ photo }) => decisions[photo.id] === "purge");
  const keep = photos.filter(
    ({ photo }) => (decisions[photo.id] ?? DEFAULT_DECISION) === "keep"
  );

  // Restores first, and they're just an undo - the document never left.
  for (const { ref } of restore) {
    await ref.update({ deletedAt: null, deletedBy: null });
    outcome.restored++;
  }

  // Keeps go to the account's permanent deleted album. Only possible when the
  // host is signed in and connected; without that they stay in Storage flagged
  // as deleted, which is still "kept", just not in Google Photos.
  if (keep.length > 0 && ownerUid) {
    const userSecret = normaliseUserSecret(
      (await adminDb.collection("userSecrets").doc(ownerUid).get()).data() ?? {}
    );

    if (userSecret.googlePhotosRefreshToken) {
      const accessToken = await refreshAccessToken(userSecret.googlePhotosRefreshToken);
      const album = await getOrCreateDeletedAlbum(ownerUid, accessToken);
      outcome.deletedAlbumUrl = album.productUrl;

      for (const { photo } of keep) {
        const [bytes] = await bucket.file(photo.storagePath).download();
        const uploadToken = await uploadPhotoBytes(accessToken, bytes, photo.contentType);
        await createMediaItems(accessToken, album.id, [
          { uploadToken, filename: storageFilename(photo) },
        ]);
        outcome.kept++;
      }
    }
  }

  // Purges last, and they are the only irreversible step in this whole flow -
  // document and bytes both. Everything else here can be walked back.
  for (const { photo, ref } of purge) {
    await bucket.file(photo.storagePath).delete({ ignoreNotFound: true });
    if (photo.thumbPath) await bucket.file(photo.thumbPath).delete({ ignoreNotFound: true });
    await ref.delete();
    outcome.purged++;
  }

  return outcome;
}
