import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { normalisePhoto, isVisible, storageFilename, Photo } from "@/lib/types/photo";
import { normaliseBoard } from "@/lib/types/board";
import { normaliseBoardSecret } from "@/lib/types/boardSecret";
import { normaliseUserSecret } from "@/lib/types/userAccount";
import {
  refreshAccessToken,
  createAlbum,
  uploadPhotoBytes,
  createMediaItems,
  MEDIA_ITEM_BATCH_LIMIT,
} from "@/lib/googlePhotos";

// How many byte uploads to run at once. The bottleneck here is this server
// talking to Google, not a guest's phone on party wifi - which is exactly why
// the guest upload path stays sequential and this one does not.
const UPLOAD_CONCURRENCY = 5;

export type ArchiveResult = {
  // How many photos made it into the album this run. Surfaced to the host so a
  // silent "archived 0 of 12" can't masquerade as success.
  archivedCount: number;
  // Already in the album from an earlier attempt, so not sent again.
  skippedCount: number;
  // The album's productUrl. Opens the album for the account that authorised -
  // i.e. the host only. Guests need a manually created share link instead.
  albumUrl: string | null;
};

// Runs `worker` over `items` with a fixed number in flight, preserving order.
// Promise.all over everything would open one connection per photo at once.
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

// Called on session end, but ONLY when the host explicitly asks for it - see
// the end route. Pushes every photo into an album named after the board, then
// deletes the Firebase Storage copies so nothing sits racking up quota after
// the event.
//
// Upload and delete are deliberately separate passes. Interleaving them means a
// failure partway through leaves earlier photos gone from Storage but later
// ones never archived - an unrecoverable split. Uploading everything first
// makes any failure purely additive: nothing is deleted unless it is known to
// have reached Google.
export async function archiveBoardToGooglePhotos(boardId: string): Promise<ArchiveResult> {
  const nothingToDo = (albumUrl: string | null, skippedCount = 0): ArchiveResult => ({
    archivedCount: 0,
    skippedCount,
    albumUrl,
  });

  const [boardDoc, boardSecretDoc] = await Promise.all([
    adminDb.collection("boards").doc(boardId).get(),
    adminDb.collection("boardSecrets").doc(boardId).get(),
  ]);
  if (!boardDoc.exists) return nothingToDo(null);

  const board = normaliseBoard(boardDoc.id, boardDoc.data() ?? {});
  const boardSecret = normaliseBoardSecret(boardSecretDoc.data() ?? {});

  // The Google grant belongs to the account that ran the board, not the board
  // itself, so an unowned board (created before sign-in existed) has nothing
  // to archive with even if the host is standing right there.
  if (!board.ownerUid) return nothingToDo(boardSecret.googlePhotosAlbumUrl);

  const userSecretDoc = await adminDb.collection("userSecrets").doc(board.ownerUid).get();
  const userSecret = normaliseUserSecret(userSecretDoc.data() ?? {});
  if (!userSecret.googlePhotosRefreshToken) return nothingToDo(boardSecret.googlePhotosAlbumUrl);

  const photosSnap = await adminDb.collection("boards").doc(boardId).collection("photos").get();
  const refs = new Map<string, FirebaseFirestore.DocumentReference>();
  const live: Photo[] = [];
  for (const doc of photosSnap.docs) {
    const photo = normalisePhoto(doc.id, doc.data());
    // Deleted photos are skipped on both counts: they must not be pushed into
    // the album, and the delete pass must not touch their Storage copy - a soft
    // delete is meant to stay recoverable, and this is the one code path in the
    // app that removes bytes for good.
    if (!isVisible(photo)) continue;
    refs.set(photo.id, doc.ref);
    live.push(photo);
  }

  // Anything already carrying a media item id reached the album on a previous
  // attempt. Re-sending would duplicate it, so a retry after a timeout resumes
  // rather than starting over.
  const pending = live.filter((photo) => !photo.googlePhotosMediaItemId);
  const skippedCount = live.length - pending.length;
  if (pending.length === 0) return nothingToDo(boardSecret.googlePhotosAlbumUrl, skippedCount);

  const accessToken = await refreshAccessToken(userSecret.googlePhotosRefreshToken);
  const bucket = adminStorage.bucket();

  // Reuse the album from an earlier partial run rather than creating a second
  // one named the same thing.
  const album = boardSecret.googlePhotosAlbumId
    ? { id: boardSecret.googlePhotosAlbumId, productUrl: boardSecret.googlePhotosAlbumUrl }
    : await createAlbum(accessToken, `Recap - ${board.title}`);

  // Pass 1 - upload bytes, several at a time. Nothing is deleted yet.
  const uploaded = await mapWithConcurrency(pending, UPLOAD_CONCURRENCY, async (photo) => {
    const [bytes] = await bucket.file(photo.storagePath).download();
    const uploadToken = await uploadPhotoBytes(accessToken, bytes, photo.contentType);
    return { photo, uploadToken };
  });

  // Pass 2 - turn tokens into album entries 50 at a time rather than one call
  // per photo, recording each media item id as its batch lands so a failure
  // partway through doesn't cost the work already done.
  const archived: Photo[] = [];
  for (let i = 0; i < uploaded.length; i += MEDIA_ITEM_BATCH_LIMIT) {
    const chunk = uploaded.slice(i, i + MEDIA_ITEM_BATCH_LIMIT);
    const created = await createMediaItems(
      accessToken,
      album.id,
      chunk.map(({ photo, uploadToken }) => ({
        uploadToken,
        filename: storageFilename(photo),
      }))
    );

    const idByToken = new Map(created.map((item) => [item.uploadToken, item.mediaItemId]));
    const batch = adminDb.batch();
    for (const { photo, uploadToken } of chunk) {
      const ref = refs.get(photo.id);
      // Falling back to the album id keeps the field truthy even if Google
      // omits the media item id, since its only job is "this one is done".
      if (ref) batch.update(ref, { googlePhotosMediaItemId: idByToken.get(uploadToken) ?? album.id });
      archived.push(photo);
    }
    await batch.commit();
  }

  // Pass 3 - reclaim Storage, now that every photo is known to be in the album.
  // Parallel is fine: small deletes against our own bucket, not slow
  // third-party uploads. Thumbnails go too, or they would be orphaned.
  const paths = archived.flatMap((photo) =>
    photo.thumbPath ? [photo.storagePath, photo.thumbPath] : [photo.storagePath]
  );
  await Promise.all(paths.map((path) => bucket.file(path).delete({ ignoreNotFound: true })));

  await adminDb
    .collection("boardSecrets")
    .doc(boardId)
    .set({ googlePhotosAlbumId: album.id, googlePhotosAlbumUrl: album.productUrl }, { merge: true });

  return { archivedCount: archived.length, skippedCount, albumUrl: album.productUrl };
}
