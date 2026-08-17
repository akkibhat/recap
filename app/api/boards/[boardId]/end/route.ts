import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireHostKey } from "@/lib/hostAuth";
import { archiveBoardToGooglePhotos } from "@/lib/archiveToGooglePhotos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  // Archiving is strictly opt-in per board: the host ticks a box in the end
  // dialog. Defaulting to false (rather than "archive whenever connected")
  // means a malformed body, an older client, or a test run can never trigger
  // the irreversible half of this - uploading to a real album and deleting the
  // Storage originals. Connecting Google Photos grants the ability to archive,
  // not the obligation.
  const body = await req.json().catch(() => ({}));
  const wantsArchive = body?.archiveToGooglePhotos === true;

  const boardDoc = await adminDb.collection("boards").doc(boardId).get();
  if (!boardDoc.exists) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }

  let archiveError: string | null = null;
  let archivedCount = 0;
  let albumUrl: string | null = null;
  let archivedAt: number | null = null;

  // Whether Google Photos is actually connected is the archiver's business
  // now, since the grant belongs to the owning account rather than the board.
  // It returns a zero result rather than throwing when there's nothing to
  // archive with.
  if (wantsArchive) {
    try {
      const result = await archiveBoardToGooglePhotos(boardId);
      archivedCount = result.archivedCount;
      albumUrl = result.albumUrl;
      // Only stamped when photos actually moved. The gallery keys off this to
      // know the Storage copies are gone, so a failed or no-op archive must
      // leave it null - otherwise the host sees broken frames for photos that
      // are in fact still there.
      if (archivedCount > 0) archivedAt = Date.now();
    } catch (err) {
      // Don't block ending the board on an archive failure - the photos stay
      // in Storage either way, so nothing is lost, just not yet archived.
      archiveError = err instanceof Error ? err.message : "Archiving to Google Photos failed.";
      console.error("Google Photos archive failed:", err);
    }
  }

  await adminDb.collection("boards").doc(boardId).update({
    endedAt: Date.now(),
    googlePhotosArchivedAt: archivedAt,
  });

  return NextResponse.json({ ok: true, archiveError, archivedCount, albumUrl });
}
