import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuth } from "firebase-admin/auth";
import { adminDb, adminApp } from "@/lib/firebase/admin";
import { newBoardFields } from "@/lib/types/board";
import { newBoardSecretFields } from "@/lib/types/boardSecret";
import { generateRoomCode } from "@/lib/roomCode";

const MAX_ROOM_CODE_ATTEMPTS = 5;

export async function POST(req: NextRequest) {
  const { title } = await req.json();
  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }

  const roomCode = await findUnusedRoomCode();
  if (!roomCode) {
    return NextResponse.json({ error: "Could not allocate a room code, try again." }, { status: 500 });
  }

  // Signing in is optional. Creating a board without it still works and still
  // mints a hostKey - it just produces a board that can't be recovered if the
  // browser is cleared, which is exactly the pre-sign-in behaviour.
  const authHeader = req.headers.get("authorization");
  let ownerUid: string | null = null;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      ownerUid = (await getAuth(adminApp).verifyIdToken(authHeader.slice(7))).uid;
    } catch {
      // A token that doesn't verify is treated as no token at all rather than
      // a failure. An expired session shouldn't stop someone starting a board
      // at a party; it only costs them the recovery path.
      ownerUid = null;
    }
  }

  const hostKey = nanoid(24);
  const boardRef = adminDb.collection("boards").doc();

  await adminDb.runTransaction(async (tx) => {
    tx.set(boardRef, newBoardFields({ title: title.trim(), roomCode, ownerUid }));
    tx.set(adminDb.collection("boardSecrets").doc(boardRef.id), newBoardSecretFields({ hostKey }));
  });

  return NextResponse.json({ boardId: boardRef.id, roomCode, hostKey });
}

async function findUnusedRoomCode(): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt++) {
    const candidate = generateRoomCode();
    const existing = await adminDb.collection("boards").where("roomCode", "==", candidate).limit(1).get();
    if (existing.empty) return candidate;
  }
  return null;
}
