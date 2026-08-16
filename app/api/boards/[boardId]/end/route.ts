import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireHostKey } from "@/lib/hostAuth";
import { archiveBoardToGooglePhotos } from "@/lib/archiveToGooglePhotos";

export async function POST(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  let archiveError: string | null = null;
  try {
    await archiveBoardToGooglePhotos(boardId);
  } catch (err) {
    // Don't block ending the board on an archive failure - the photos stay
    // in Storage either way, so nothing is lost, just not yet archived.
    archiveError = err instanceof Error ? err.message : "Archiving to Google Photos failed.";
    console.error("Google Photos archive failed:", err);
  }

  await adminDb.collection("boards").doc(boardId).update({ endedAt: Date.now() });

  return NextResponse.json({ ok: true, archiveError });
}
