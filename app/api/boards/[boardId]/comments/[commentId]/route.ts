import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireHostKey } from "@/lib/hostAuth";

// Host moderation for comments, mirroring the photo route. The client rule
// only lets an author remove their own, so removing anyone else's - and
// undoing a host removal afterwards - has to come through here, where host
// access is checked server-side. Still soft: nothing is destroyed.

// The comment's reference, and whether it exists.
async function commentRef(boardId: string, commentId: string) {
  const ref = adminDb.collection("boards").doc(boardId).collection("comments").doc(commentId);
  const doc = await ref.get();
  return { ref, exists: doc.exists };
}

// Host removes a comment (soft).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; commentId: string }> }
) {
  const { boardId, commentId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  // Nesting means a comment can't belong to another board: the path is the
  // ownership check.
  const { ref, exists } = await commentRef(boardId, commentId);
  if (!exists) return NextResponse.json({ error: "Comment not found." }, { status: 404 });

  await ref.update({ deletedAt: Date.now(), deletedBy: "host" });
  return NextResponse.json({ ok: true });
}

// Host puts a removed comment back.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ boardId: string; commentId: string }> }
) {
  const { boardId, commentId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  const { ref, exists } = await commentRef(boardId, commentId);
  if (!exists) return NextResponse.json({ error: "Comment not found." }, { status: 404 });

  await ref.update({ deletedAt: null, deletedBy: null });
  return NextResponse.json({ ok: true });
}
