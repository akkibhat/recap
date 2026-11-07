import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { readIdToken } from "@/lib/idToken";
import { normaliseBoardSecret } from "@/lib/types/boardSecret";
import { normaliseBoard } from "@/lib/types/board";

// The recovery path. A host who signed in can get their board's hostKey back
// on any device, which is what makes a board survive a cleared browser or a
// new phone.
//
// Deliberately NOT using requireHostKey: that accepts the hostKey itself as
// proof, and handing out the key to whoever already presents it is circular.
// This route only ever accepts a verified Google identity matching ownerUid.
export async function GET(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;

  const token = await readIdToken(req);
  if (token.status === "missing") {
    return NextResponse.json({ error: "Sign in to recover this board." }, { status: 401 });
  }
  if (token.status === "invalid") {
    return NextResponse.json({ error: "Your session has expired - sign in again." }, { status: 401 });
  }
  const uid = token.uid;

  const boardDoc = await adminDb.collection("boards").doc(boardId).get();
  if (!boardDoc.exists) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }

  const board = normaliseBoard(boardDoc.id, boardDoc.data() ?? {});
  // Boards made before sign-in existed have ownerUid null and can't be
  // recovered this way - there's no record of who made them. Their hostKey in
  // localStorage is the only proof, which is the gap sign-in exists to close
  // going forward.
  if (!board.ownerUid || board.ownerUid !== uid) {
    return NextResponse.json({ error: "That isn't your board." }, { status: 403 });
  }

  const secretDoc = await adminDb.collection("boardSecrets").doc(boardId).get();
  const secret = normaliseBoardSecret(secretDoc.data() ?? {});

  return NextResponse.json({ hostKey: secret.hostKey });
}
