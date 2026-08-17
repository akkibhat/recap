import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { normalisePhoto } from "@/lib/types/photo";
import { normaliseBoardSecret } from "@/lib/types/boardSecret";
import { refreshAccessToken, addPhotoToAlbum } from "@/lib/googlePhotos";

export type ArchiveResult = {
  // How many photos made it into the album. Surfaced to the host so a silent
  // "archived 0 of 12" can't masquerade as success.
  archivedCount: number;
  // The album's productUrl. Opens the album for the account that authorised -
  // i.e. the host only. Guests need a manually created share link instead.
  albumUrl: string | null;
};

// Called on session end, but ONLY when the host explicitly asks for it - see
// the end route. Pushes every photo into the connected album, then deletes the
// Firebase Storage copies so nothing sits racking up quota after the event.
//
// The upload and the delete are deliberately two separate passes. Interleaving
// them (upload one, delete one) means a failure partway through leaves the
// earlier photos gone from Storage but the later ones never archived - an
// unrecoverable split. Uploading everything first makes any failure purely
// additive: the album may end up with duplicates on a retry, but no photo is
// ever deleted unless the whole batch reached Google.
export async function archiveBoardToGooglePhotos(boardId: string): Promise<ArchiveResult> {
  const secretDoc = await adminDb.collection("boardSecrets").doc(boardId).get();
  const secret = normaliseBoardSecret(secretDoc.data() ?? {});
  if (!secret.googlePhotosRefreshToken || !secret.googlePhotosAlbumId) {
    return { archivedCount: 0, albumUrl: null };
  }

  const accessToken = await refreshAccessToken(secret.googlePhotosRefreshToken);
  const albumId = secret.googlePhotosAlbumId;

  const photosSnap = await adminDb.collection("photos").where("boardId", "==", boardId).get();
  const bucket = adminStorage.bucket();

  // Pass 1 - upload. Anything that throws here aborts before a single delete,
  // leaving Storage exactly as it was.
  const uploadedPaths: string[] = [];
  for (const doc of photosSnap.docs) {
    const photo = normalisePhoto(doc.id, doc.data());
    const [bytes] = await bucket.file(photo.storagePath).download();
    const filename = photo.storagePath.split("/").pop() ?? `${doc.id}.jpg`;

    await addPhotoToAlbum(accessToken, albumId, bytes, filename);
    uploadedPaths.push(photo.storagePath);
  }

  // Pass 2 - reclaim Storage, now that every photo is known to be safe in the
  // album. Parallel is fine here: these are small delete calls against our own
  // bucket, not the slow third-party uploads above.
  await Promise.all(
    uploadedPaths.map((path) => bucket.file(path).delete({ ignoreNotFound: true }))
  );

  return { archivedCount: uploadedPaths.length, albumUrl: secret.googlePhotosAlbumUrl };
}
