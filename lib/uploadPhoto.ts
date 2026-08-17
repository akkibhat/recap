"use client";

import { nanoid } from "nanoid";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection } from "firebase/firestore";
import { storage, db } from "@/lib/firebase/client";
import { newPhotoFields } from "@/lib/types/photo";

export async function uploadPhoto(input: {
  boardId: string;
  file: File;
  caption: string;
  contributorName: string;
  contributorGuestId: string;
}): Promise<void> {
  const extension = input.file.name.split(".").pop() ?? "jpg";
  const storagePath = `boards/${input.boardId}/photos/${nanoid(12)}.${extension}`;
  const storageRef = ref(storage, storagePath);

  await uploadBytes(storageRef, input.file, { contentType: input.file.type });
  const downloadUrl = await getDownloadURL(storageRef);

  await addDoc(
    collection(db, "boards", input.boardId, "photos"),
    newPhotoFields({
      storagePath,
      downloadUrl,
      caption: input.caption.trim(),
      contributorName: input.contributorName.trim(),
      contributorGuestId: input.contributorGuestId,
    })
  );
}
