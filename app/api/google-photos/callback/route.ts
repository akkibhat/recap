import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { exchangeCodeForTokens } from "@/lib/googlePhotos";

// Completes the account-level Google Photos handshake. No album is created
// here any more: albums are per board and named after it, so one gets made at
// archive time instead. Connecting used to leave an empty album behind for
// every board, whether or not anything was ever archived to it.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const origin = req.nextUrl.origin;

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/?error=google-photos-cancelled`);
  }

  // The nonce is consumed whatever happens next, so a state can't be replayed.
  const stateRef = adminDb.collection("oauthStates").doc(state);
  const stateDoc = await stateRef.get();
  await stateRef.delete().catch(() => {});

  if (!stateDoc.exists) {
    return NextResponse.redirect(`${origin}/?error=google-photos-state`);
  }
  const { uid, expiresAt } = stateDoc.data() as { uid: string; expiresAt: number };
  if (!uid || Date.now() > expiresAt) {
    return NextResponse.redirect(`${origin}/?error=google-photos-expired`);
  }

  try {
    const { refreshToken } = await exchangeCodeForTokens(code);
    if (!refreshToken) {
      // Shouldn't happen with access_type=offline&prompt=consent, but without
      // one there's nothing to archive with once the access token expires.
      throw new Error("Google did not return a refresh token.");
    }

    await adminDb.runTransaction(async (tx) => {
      tx.set(adminDb.collection("userSecrets").doc(uid), { googlePhotosRefreshToken: refreshToken }, { merge: true });
      tx.set(
        adminDb.collection("users").doc(uid),
        { googlePhotosConnected: true, googlePhotosConnectedAt: Date.now() },
        { merge: true }
      );
    });

    return NextResponse.redirect(`${origin}/boards?connected=google-photos`);
  } catch (err) {
    console.error("Google Photos connect failed:", err);
    return NextResponse.redirect(`${origin}/boards?error=google-photos-failed`);
  }
}
