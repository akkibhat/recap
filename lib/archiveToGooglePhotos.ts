import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { normalisePhoto } from "@/lib/types/photo";
import { normaliseBoardSecret } from "@/lib/types/boardSecret";
import { refreshAccessToken, addPhotoToAlbum } from "@/lib/googlePhotos";

// Called on session end when a board has a connected Google Photos album.
// Pushes every photo into that album, then deletes the Firebase Storage
// copy - the album is the permanent home once this succeeds, so nothing
// sits in Storage racking up quota after the event is over.
export async function archiveBoardToGooglePhotos(boardId: string): Promise<void> {
  const secretDoc = await adminDb.collection("boardSecrets").doc(boardId).get();
  const secret = normaliseBoardSecret(secretDoc.data() ?? {});
  if (!secret.googlePhotosRefreshToken || !secret.googlePhotosAlbumId) return;

  const accessToken = await refreshAccessToken(secret.googlePhotosRefreshToken);
  const albumId = secret.googlePhotosAlbumId;

  const photosSnap = await adminDb.collection("photos").where("boardId", "==", boardId).get();
  const bucket = adminStorage.bucket();

  for (const doc of photosSnap.docs) {
    const photo = normalisePhoto(doc.id, doc.data());
    const [bytes] = await bucket.file(photo.storagePath).download();
    const filename = photo.storagePath.split("/").pop() ?? `${doc.id}.jpg`;

    await addPhotoToAlbum(accessToken, albumId, bytes, filename);
    await bucket.file(photo.storagePath).delete({ ignoreNotFound: true });
  }
}
