import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { exchangeCodeForTokens, createAlbum } from "@/lib/googlePhotos";
import { normaliseBoard } from "@/lib/types/board";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const boardId = req.nextUrl.searchParams.get("state");
  const origin = req.nextUrl.origin;

  if (!code || !boardId) {
    return NextResponse.redirect(`${origin}/?error=google-photos-cancelled`);
  }

  const boardDoc = await adminDb.collection("boards").doc(boardId).get();
  if (!boardDoc.exists) {
    return NextResponse.redirect(`${origin}/?error=board-not-found`);
  }
  const board = normaliseBoard(boardDoc.id, boardDoc.data() ?? {});

  try {
    const { accessToken, refreshToken } = await exchangeCodeForTokens(code);
    if (!refreshToken) {
      // Shouldn't happen with access_type=offline&prompt=consent, but
      // without one there's nothing to archive with once this token expires.
      throw new Error("Google did not return a refresh token.");
    }

    const album = await createAlbum(accessToken, board.title);

    await adminDb.runTransaction(async (tx) => {
      tx.update(adminDb.collection("boardSecrets").doc(boardId), {
        googlePhotosRefreshToken: refreshToken,
        googlePhotosAlbumId: album.id,
        googlePhotosAlbumUrl: album.productUrl,
      });
      tx.update(adminDb.collection("boards").doc(boardId), { googlePhotosConnected: true });
    });

    return NextResponse.redirect(`${origin}/host/${boardId}`);
  } catch (err) {
    console.error("Google Photos connect failed:", err);
    return NextResponse.redirect(`${origin}/host/${boardId}?error=google-photos-failed`);
  }
}
