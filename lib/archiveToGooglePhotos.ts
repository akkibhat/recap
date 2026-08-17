import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { normalisePhoto, isVisible } from "@/lib/types/photo";
import { normaliseBoard } from "@/lib/types/board";
import { normaliseUserSecret } from "@/lib/types/userAccount";
import { refreshAccessToken, createAlbum, addPhotoToAlbum } from "@/lib/googlePhotos";

export type ArchiveResult = {
  // How many photos made it into the album. Surfaced to the host so a silent
  // "archived 0 of 12" can't masquerade as success.
  archivedCount: number;
  // The album's productUrl. Opens the album for the account that authorised -
  // i.e. the host only. Guests need a manually created share link instead.
  albumUrl: string | null;
};

// Called on session end, but ONLY when the host explicitly asks for it - see
// the end route. Pushes every photo into a fresh album named after the board,
// then deletes the Firebase Storage copies so nothing sits racking up quota
// after the event.
//
// The upload and the delete are deliberately two separate passes. Interleaving
// them (upload one, delete one) means a failure partway through leaves the
// earlier photos gone from Storage but the later ones never archived - an
// unrecoverable split. Uploading everything first makes any failure purely
// additive: the album may end up with duplicates on a retry, but no photo is
// ever deleted unless the whole batch reached Google.
export async function archiveBoardToGooglePhotos(boardId: string): Promise<ArchiveResult> {
  const boardDoc = await adminDb.collection("boards").doc(boardId).get();
  if (!boardDoc.exists) return { archivedCount: 0, albumUrl: null };
  const board = normaliseBoard(boardDoc.id, boardDoc.data() ?? {});

  // The Google grant belongs to the account that ran the board, not the board
  // itself, so an unowned board (created before sign-in existed) has nothing
  // to archive with even if the host is standing right there.
  if (!board.ownerUid) return { archivedCount: 0, albumUrl: null };

  const secretDoc = await adminDb.collection("userSecrets").doc(board.ownerUid).get();
  const secret = normaliseUserSecret(secretDoc.data() ?? {});
  if (!secret.googlePhotosRefreshToken) return { archivedCount: 0, albumUrl: null };

  const accessToken = await refreshAccessToken(secret.googlePhotosRefreshToken);

  const photosSnap = await adminDb.collection("boards").doc(boardId).collection("photos").get();
  const livePhotos = photosSnap.docs
    .map((doc) => normalisePhoto(doc.id, doc.data()))
    // Deleted photos are skipped on both counts: they must not be pushed into
    // the album, and pass 2 must not delete their Storage copy - a soft delete
    // is meant to stay recoverable, and this is the one code path in the app
    // that removes bytes for good.
    .filter(isVisible);

  if (livePhotos.length === 0) return { archivedCount: 0, albumUrl: null };

  // Created here rather than at connect time. Albums are per board and named
  // after it, so making one when the account connects produced an empty album
  // for a board that might never archive anything.
  const album = await createAlbum(accessToken, `Recap - ${board.title}`);
  const bucket = adminStorage.bucket();

  // Pass 1 - upload. Anything that throws here aborts before a single delete,
  // leaving Storage exactly as it was.
  // Both the original and its thumbnail, so pass 2 doesn't leave orphaned
  // thumbnails behind for photos that are no longer in Storage.
  const uploadedPaths: string[] = [];
  for (const photo of livePhotos) {
    const [bytes] = await bucket.file(photo.storagePath).download();
    const filename = photo.storagePath.split("/").pop() ?? `${photo.id}.jpg`;

    await addPhotoToAlbum(accessToken, album.id, bytes, filename, photo.contentType);
    uploadedPaths.push(photo.storagePath);
    if (photo.thumbPath) uploadedPaths.push(photo.thumbPath);
  }

  // Pass 2 - reclaim Storage, now that every photo is known to be safe in the
  // album. Parallel is fine here: these are small delete calls against our own
  // bucket, not the slow third-party uploads above.
  await Promise.all(
    uploadedPaths.map((path) => bucket.file(path).delete({ ignoreNotFound: true }))
  );

  await adminDb.collection("boardSecrets").doc(boardId).set(
    { googlePhotosAlbumId: album.id, googlePhotosAlbumUrl: album.productUrl },
    { merge: true }
  );

  return { archivedCount: uploadedPaths.length, albumUrl: album.productUrl };
}
