import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireHostKey } from "@/lib/hostAuth";
import { archiveBoardToGooglePhotos } from "@/lib/archiveToGooglePhotos";
import { applyDeletedReview, DeletedDecision, ReviewOutcome } from "@/lib/deletedAlbum";
import { normalisePhoto, isVisible } from "@/lib/types/photo";
import { normaliseBoard } from "@/lib/types/board";

// Ends a board: optionally archives it to Google Photos, applies the host's
// decisions about removed photos, then stamps endedAt.
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

  // What the host decided about frames taken off the roll during the night.
  // Anything absent from this map defaults to keeping - see DEFAULT_DECISION.
  const decisions: Record<string, DeletedDecision> =
    body?.deletedDecisions && typeof body.deletedDecisions === "object" ? body.deletedDecisions : {};

  const boardDoc = await adminDb.collection("boards").doc(boardId).get();
  if (!boardDoc.exists) {
    return NextResponse.json({ error: "Board not found." }, { status: 404 });
  }
  const board = normaliseBoard(boardDoc.id, boardDoc.data() ?? {});

  let archiveError: string | null = null;
  let archivedCount = 0;
  let skippedCount = 0;
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
      skippedCount = result.skippedCount;
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

  // Deleted frames are settled AFTER archiving, so a photo the host chose to
  // restore has already had its chance to reach the board's own album rather
  // than being brought back only to be left out of it.
  let review: ReviewOutcome = { restored: 0, kept: 0, purged: 0, deletedAlbumUrl: null };
  let reviewError: string | null = null;
  try {
    const photosSnap = await adminDb.collection("boards").doc(boardId).collection("photos").get();
    const deleted = photosSnap.docs
      .map((doc) => ({ photo: normalisePhoto(doc.id, doc.data()), ref: doc.ref }))
      .filter(({ photo }) => !isVisible(photo));

    review = await applyDeletedReview(boardId, board.ownerUid, deleted, decisions);
  } catch (err) {
    // Same posture as the archive: never block ending the board. A failure
    // here leaves deleted photos exactly as they were, which is the safe state.
    reviewError = err instanceof Error ? err.message : "Reviewing deleted frames failed.";
    console.error("Deleted review failed:", err);
  }

  await adminDb.collection("boards").doc(boardId).update({
    endedAt: Date.now(),
    googlePhotosArchivedAt: archivedAt,
  });

  return NextResponse.json({
    ok: true,
    archiveError,
    archivedCount,
    skippedCount,
    albumUrl,
    reviewError,
    review,
  });
}
