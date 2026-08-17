import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireHostKey } from "@/lib/hostAuth";
import { normalisePhoto } from "@/lib/types/photo";

// Host moderation. Unlike the guest path in lib/deletePhoto.ts, this is
// properly enforced - the host key is checked server-side and the Admin SDK
// bypasses the Firestore rules entirely, so the host can remove anyone's
// photo, not only their own.
//
// Still a soft delete. Nothing is removed from Storage here; permanent removal
// only ever happens from the admin routes.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; photoId: string }> }
) {
  const { boardId, photoId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  const photoRef = adminDb.collection("photos").doc(photoId);
  const photoDoc = await photoRef.get();
  if (!photoDoc.exists) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  // A host key only authorises its own board. Without this a host could pass
  // their own board's key and delete a photo belonging to someone else's.
  const photo = normalisePhoto(photoDoc.id, photoDoc.data() ?? {});
  if (photo.boardId !== boardId) {
    return NextResponse.json({ error: "That photo is not on this board." }, { status: 403 });
  }

  await photoRef.update({ deletedAt: Date.now(), deletedBy: "host" });

  return NextResponse.json({ ok: true });
}
