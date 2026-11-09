"use client";

import { nanoid } from "nanoid";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, doc, increment, writeBatch } from "firebase/firestore";
import { storage, db } from "@/lib/firebase/client";
import { newPhotoFields } from "@/lib/types/photo";
import { probeMedia } from "@/lib/makeThumbnail";

// Uploads one photo or video (plus its thumbnail, if one could be made) to
// Storage, then adds its document to the board.
export async function uploadPhoto(input: {
  boardId: string;
  file: File;
  caption: string;
  contributorName: string;
  contributorGuestId: string;
}): Promise<void> {
  const extension = input.file.name.split(".").pop() ?? "jpg";
  const id = nanoid(12);

  // The original goes up untouched - full resolution is what the lightbox
  // shows, what the zip export contains, and what reaches Google Photos.
  const storagePath = `boards/${input.boardId}/photos/${id}.${extension}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, input.file, { contentType: input.file.type });
  const downloadUrl = await getDownloadURL(storageRef);

  // Plus a small copy for the gallery, so a board with two hundred frames
  // doesn't pull two hundred full-size photos onto a phone. Same folder as the
  // original, so the Storage rules and the admin cascade already cover it.
  let thumbPath: string | null = null;
  let thumbUrl: string | null = null;
  const { thumbnail, durationSeconds } = await probeMedia(input.file);
  if (thumbnail) {
    thumbPath = `boards/${input.boardId}/photos/${id}-thumb.${thumbnail.extension}`;
    const thumbRef = ref(storage, thumbPath);
    await uploadBytes(thumbRef, thumbnail.blob, { contentType: thumbnail.blob.type });
    thumbUrl = await getDownloadURL(thumbRef);
  }

  // The photo and the board's upload counter go in one batch, because the
  // rules only accept each when they see the other: a photo needs the count
  // to rise by exactly one (and stay within the cap), and the count may only
  // rise alongside a new photo. Either both land or neither does.
  const photoRef = doc(collection(db, "boards", input.boardId, "photos"));
  const batch = writeBatch(db);
  batch.set(
    photoRef,
    newPhotoFields({
      storagePath,
      downloadUrl,
      thumbPath,
      thumbUrl,
      contentType: input.file.type,
      durationSeconds,
      caption: input.caption.trim(),
      contributorName: input.contributorName.trim(),
      contributorGuestId: input.contributorGuestId,
    })
  );
  batch.update(doc(db, "boards", input.boardId), {
    photoCount: increment(1),
    lastPhotoId: photoRef.id,
  });
  await batch.commit();
}
