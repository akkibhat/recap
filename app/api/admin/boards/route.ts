import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/adminAuth";
import { normaliseBoard } from "@/lib/types/board";
import { normalisePhoto, isVisible } from "@/lib/types/photo";

export type AdminBoard = {
  id: string;
  title: string;
  roomCode: string;
  createdAt: number;
  endedAt: number | null;
  ownerUid: string | null;
  photoCount: number;
  deletedCount: number;
};

// Lists every board, which the client deliberately cannot do for itself: the
// Firestore rule restricts `list` to a signed-in host querying their own
// boards, so admin listing has to come through the Admin SDK. That also means
// legacy boards with no ownerUid still show up here, which is exactly the set
// most likely to need cleaning out.
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const [boardsSnap, photosSnap] = await Promise.all([
    adminDb.collection("boards").orderBy("createdAt", "desc").get(),
    // Collection group rather than a top-level read: photos now live under
    // their board, and a photo's board is its grandparent in the path.
    adminDb.collectionGroup("photos").get(),
  ]);

  // One pass over all photos rather than a count query per board - at this
  // scale that's a single read against a few hundred documents, where the
  // per-board version would be one round trip each.
  const counts = new Map<string, { photos: number; deleted: number }>();
  for (const doc of photosSnap.docs) {
    const photo = normalisePhoto(doc.id, doc.data());
    const boardId = doc.ref.parent.parent?.id;
    if (!boardId) continue;
    const entry = counts.get(boardId) ?? { photos: 0, deleted: 0 };
    if (isVisible(photo)) entry.photos++;
    else entry.deleted++;
    counts.set(boardId, entry);
  }

  const boards: AdminBoard[] = boardsSnap.docs.map((doc) => {
    const board = normaliseBoard(doc.id, doc.data());
    const entry = counts.get(doc.id) ?? { photos: 0, deleted: 0 };
    return {
      id: board.id,
      title: board.title,
      roomCode: board.roomCode,
      createdAt: board.createdAt,
      endedAt: board.endedAt,
      ownerUid: board.ownerUid,
      photoCount: entry.photos,
      deletedCount: entry.deleted,
    };
  });

  return NextResponse.json({ boards });
}
