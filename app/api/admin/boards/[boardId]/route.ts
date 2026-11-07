import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/adminAuth";
import { normaliseBoard } from "@/lib/types/board";

// Firestore caps a batched write at 500 operations.
const BATCH_LIMIT = 500;

// Deletes every document in a snapshot, BATCH_LIMIT at a time.
async function deleteAll(snap: FirebaseFirestore.QuerySnapshot): Promise<void> {
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = adminDb.batch();
    for (const doc of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(doc.ref);
    await batch.commit();
  }
}

// Permanently removes a board and everything belonging to it: photo documents,
// the Storage objects behind them, the board's secret, and the board itself.
//
// This is the one genuinely irreversible operation in the app. Deleting a
// photo from a board is soft precisely so it can be undone; this is the escape
// hatch for when a whole board should stop existing. It requires the caller to
// echo back the board's room code, so a mistap can't trigger it.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const boardDoc = await adminDb.collection("boards").doc(boardId).get();
  if (!boardDoc.exists) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }
  const board = normaliseBoard(boardDoc.id, boardDoc.data() ?? {});

  const body = await req.json().catch(() => ({}));
  if (typeof body?.confirmRoomCode !== "string" || body.confirmRoomCode.toUpperCase() !== board.roomCode) {
    return NextResponse.json(
      { error: `Type the room code (${board.roomCode}) to confirm.` },
      { status: 400 }
    );
  }

  // Storage first. If this half fails the board still exists and the operation
  // can simply be retried; doing it last would risk orphaning files with no
  // remaining record of which board they belonged to.
  const bucket = adminStorage.bucket();
  await bucket.deleteFiles({ prefix: `boards/${boardId}/` });

  const photosSnap = await adminDb.collection("boards").doc(boardId).collection("photos").get();
  await deleteAll(photosSnap);

  // Deleting a document in Firestore does NOT delete its subcollections, so
  // comments have to be cleared explicitly. Skipping this would leave orphaned
  // comments that nothing can ever reach or remove.
  const commentsSnap = await adminDb.collection("boards").doc(boardId).collection("comments").get();
  await deleteAll(commentsSnap);

  await adminDb.collection("boardSecrets").doc(boardId).delete();
  await adminDb.collection("boards").doc(boardId).delete();

  return NextResponse.json({
    ok: true,
    deletedPhotos: photosSnap.size,
    deletedComments: commentsSnap.size,
  });
}
