import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getAuth } from "firebase-admin/auth";
import { adminDb, adminApp } from "@/lib/firebase/admin";
import { getGooglePhotosAuthUrl } from "@/lib/googlePhotos";

// How long a pending OAuth handshake stays valid. Long enough to pick an
// account and read a consent screen, short enough that abandoned states expire
// rather than accumulating.
const STATE_TTL_MS = 15 * 60 * 1000;

// Connecting Google Photos is now an account-level action, not a board-level
// one, so this requires a signed-in identity rather than a board's host key.
// Connect once and every board you run can archive.
export async function POST(req: NextRequest) {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Sign in before connecting Google Photos." }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await getAuth(adminApp).verifyIdToken(header.slice(7))).uid;
  } catch {
    return NextResponse.json({ error: "Your session has expired - sign in again." }, { status: 401 });
  }

  // The OAuth `state` is an unguessable nonce recorded server-side, rather than
  // the uid itself. The callback arrives as a plain browser redirect with no
  // way to authenticate it, so a state that names its own subject would let
  // someone finish a handshake against an account that isn't theirs.
  const state = nanoid(32);
  await adminDb.collection("oauthStates").doc(state).set({
    uid,
    createdAt: Date.now(),
    expiresAt: Date.now() + STATE_TTL_MS,
  });

  return NextResponse.json({ authUrl: getGooglePhotosAuthUrl(state) });
}
