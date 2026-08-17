import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// Resolves a room code to a board id, server-side.
//
// This exists because of a Firestore rules constraint rather than a product
// one. Looking a board up by room code from the client is a `list` query, and
// list rules can't inspect a query's `where` filters - only its limit/order.
// So there is no way to write "you may list boards, but only when filtering by
// an exact room code". The choice is between allowing clients to enumerate
// every board on the project, or not letting them list boards at all.
//
// Doing the lookup here takes the third option: clients only ever `get` a
// board they already have the id for, and listing stays restricted to a signed
// -in host querying their own boards.
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
