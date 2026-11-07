import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireHostKey } from "@/lib/hostAuth";
import { normaliseBoardSecret } from "@/lib/types/boardSecret";

// Hosts allowed in a pasted share link. Google Photos hands out either a
// photos.app.goo.gl short link or a photos.google.com/share/... URL. Anything
// else is rejected: whatever lands here gets written to the PUBLIC board doc
// and shown to every guest, so this field must not become a way to publish an
// arbitrary link to the party.
const ALLOWED_SHARE_HOSTS = ["photos.app.goo.gl", "photos.google.com"];

// True only for an https link on one of the allowed Google Photos hosts.
function isValidShareUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ALLOWED_SHARE_HOSTS.includes(url.hostname);
  } catch {
    return false;
  }
}

// Returns the album's productUrl, which lives in boardSecrets and therefore
// can't be read by the client directly. Host-only - not because the URL is
// especially sensitive, but because it only opens for the account that
// authorised, so there's no reason for anyone else to have it.
export async function GET(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  const secretDoc = await adminDb.collection("boardSecrets").doc(boardId).get();
  const secret = normaliseBoardSecret(secretDoc.data() ?? {});

  return NextResponse.json({ albumUrl: secret.googlePhotosAlbumUrl });
}

// Saves the share link the host created by hand in the Google Photos app.
// Google removed the sharing scope on 2025-03-31 - albums.share now returns
// 403 PERMISSION_DENIED with no exception for app-created albums - so this
// paste-back is the only route to a link guests can actually open.
export async function POST(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const raw = typeof body?.shareUrl === "string" ? body.shareUrl.trim() : "";

  // An empty string is a deliberate "remove it again", not an error - the host
  // may have pasted the wrong thing, or stopped sharing the album.
  if (raw && !isValidShareUrl(raw)) {
    return NextResponse.json(
      { error: "That doesn't look like a Google Photos share link." },
      { status: 400 }
    );
  }

  const shareUrl = raw || null;
  await adminDb.collection("boards").doc(boardId).update({ googlePhotosShareUrl: shareUrl });

  return NextResponse.json({ ok: true, shareUrl });
}
