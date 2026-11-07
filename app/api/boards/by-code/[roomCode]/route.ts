import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// Resolves a room code to a board id, server-side.
//
// Looking a board up by room code from the client would be a `list` query,
// and list rules can't inspect a query's `where` filters, so allowing it
// would let anyone enumerate every board. Doing the lookup here means clients
// only ever `get` a board they already have the id for, and listing stays
// restricted to a signed-in host querying their own boards.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ roomCode: string }> }) {
  const { roomCode } = await params;

  const snap = await adminDb
    .collection("boards")
    .where("roomCode", "==", roomCode.toUpperCase())
    .limit(1)
    .get();

  if (snap.empty) {
    return NextResponse.json({ error: "No board with that code." }, { status: 404 });
  }

  // Only the id: everything else the guest needs comes from subscribing to the
  // board document itself, which stays live as the board is renamed or ended.
  return NextResponse.json({ boardId: snap.docs[0].id });
}
