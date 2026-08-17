import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireHostKey } from "@/lib/hostAuth";

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

  // Nesting means a photo cannot belong to another board by construction, so
  // the explicit cross-board ownership check this route used to need is now
  // the path itself.
  const photoRef = adminDb.collection("boards").doc(boardId).collection("photos").doc(photoId);
  if (!(await photoRef.get()).exists) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  await photoRef.update({ deletedAt: Date.now(), deletedBy: "host" });

  return NextResponse.json({ ok: true });
}

// Undo for the host. The client rule deliberately won't let anyone reverse a
// host removal (deletedBy 'host' never matches a contributorGuestId), so the
// host's own undo has to come back through here.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; photoId: string }> }
) {
  const { boardId, photoId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  const photoRef = adminDb.collection("boards").doc(boardId).collection("photos").doc(photoId);
  if (!(await photoRef.get()).exists) {
    return NextResponse.json({ error: "Photo not found." }, { status: 404 });
  }

  await photoRef.update({ deletedAt: null, deletedBy: null });

  return NextResponse.json({ ok: true });
}
