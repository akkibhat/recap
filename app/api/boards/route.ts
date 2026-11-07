import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { adminDb } from "@/lib/firebase/admin";
import { requireHostAccount } from "@/lib/hostAccess";
import { newBoardFields } from "@/lib/types/board";
import { newBoardSecretFields } from "@/lib/types/boardSecret";
import { generateRoomCode } from "@/lib/roomCode";

const MAX_ROOM_CODE_ATTEMPTS = 5;

/** Create a board: allowed hosts only, returns its id, room code and host key. */
export async function POST(req: NextRequest) {
  const { title } = await req.json();
  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }

  // Only allowed host accounts may start a board (see lib/hostAccess.ts).
  // Checked before anything is written, so a refused request costs nothing.
  const host = await requireHostAccount(req);
  if (!host.ok) return host.response;
  const ownerUid = host.uid;

  const roomCode = await findUnusedRoomCode();
  if (!roomCode) {
    return NextResponse.json({ error: "Could not allocate a room code, try again." }, { status: 500 });
  }

  const hostKey = nanoid(24);
  const boardRef = adminDb.collection("boards").doc();

  await adminDb.runTransaction(async (tx) => {
    tx.set(boardRef, newBoardFields({ title: title.trim(), roomCode, ownerUid }));
    tx.set(adminDb.collection("boardSecrets").doc(boardRef.id), newBoardSecretFields({ hostKey }));
  });

  return NextResponse.json({ boardId: boardRef.id, roomCode, hostKey });
}

// Tries a few random room codes and returns the first one no board uses yet.
async function findUnusedRoomCode(): Promise<string | null> {
  for (let attempt = 0; attempt < MAX_ROOM_CODE_ATTEMPTS; attempt++) {
    const candidate = generateRoomCode();
    const existing = await adminDb.collection("boards").where("roomCode", "==", candidate).limit(1).get();
    if (existing.empty) return candidate;
  }
  return null;
}
