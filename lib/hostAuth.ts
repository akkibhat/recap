import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminDb, adminApp } from "@/lib/firebase/admin";
import { normaliseBoardSecret } from "@/lib/types/boardSecret";
import { normaliseBoard } from "@/lib/types/board";

type HostAuthResult =
  | { ok: true; uid: string | null }
  | { ok: false; response: NextResponse };

// Verifies a Firebase ID token from the Authorization header. Returns null for
// anything unusable rather than throwing, because arriving without a token is
// the normal case for a host who never signed in.
async function verifiedUid(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(header.slice(7));
    return decoded.uid;
  } catch {
    return null;
  }
}

// Shared by every host-privileged API route. Either of two credentials is
// accepted, deliberately:
//
//  - The board's hostKey, from localStorage. Works without being signed in on
//    this device, but dies with the browser.
//  - A Google sign-in whose uid matches the board's ownerUid. Survives a
//    cleared browser and a new phone.
//
// Boards created before sign-in existed have ownerUid === null, and no uid can
// ever equal null, so they keep working on the hostKey alone.
export async function requireHostKey(req: NextRequest, boardId: string): Promise<HostAuthResult> {
  // Most routes are called via fetch() with a header. The export route is a
  // plain browser navigation (triggers a file download), which can't set
  // custom headers, so it falls back to a query param instead.
  const hostKey = req.headers.get("x-host-key") ?? req.nextUrl.searchParams.get("hostKey");
  const uid = await verifiedUid(req);

  if (!hostKey && !uid) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in, or open this board on the device that created it." }, { status: 401 }),
    };
  }

  const [secretDoc, boardDoc] = await Promise.all([
    adminDb.collection("boardSecrets").doc(boardId).get(),
    adminDb.collection("boards").doc(boardId).get(),
  ]);
  if (!secretDoc.exists || !boardDoc.exists) {
    return { ok: false, response: NextResponse.json({ error: "Board not found." }, { status: 404 }) };
  }

  const secret = normaliseBoardSecret(secretDoc.data() ?? {});
  const board = normaliseBoard(boardDoc.id, boardDoc.data() ?? {});

  const keyMatches = Boolean(hostKey) && secret.hostKey === hostKey;
  const ownerMatches = Boolean(uid) && board.ownerUid === uid;

  if (!keyMatches && !ownerMatches) {
    return { ok: false, response: NextResponse.json({ error: "Not the host of this board." }, { status: 403 }) };
  }

  return { ok: true, uid };
}
