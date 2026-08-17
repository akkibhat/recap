import { NextRequest, NextResponse } from "next/server";
import { Readable } from "node:stream";
import * as archiver from "archiver";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { requireHostKey } from "@/lib/hostAuth";
import { normalisePhoto, isVisible } from "@/lib/types/photo";
import { normaliseBoard } from "@/lib/types/board";

export async function GET(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  const boardDoc = await adminDb.collection("boards").doc(boardId).get();
  if (!boardDoc.exists) return NextResponse.json({ error: "Board not found." }, { status: 404 });
  const board = normaliseBoard(boardDoc.id, boardDoc.data() ?? {});

  const photosSnap = await adminDb.collection("boards").doc(boardId).collection("photos").get();
  const bucket = adminStorage.bucket();

  // `store: true` rather than deflate. Everything going in here is a JPEG, a
  // PNG or an MP4 - all already compressed - so the old zlib level 9 spent a
  // lot of CPU per photo to save approximately nothing.
  const archive = new archiver.ZipArchive({ store: true });

  // Nothing is awaited here: appending from a read stream is lazy, so the
  // archive pulls each photo from Storage as the client drains the response.
  // The previous version downloaded every photo into a Buffer and then
  // concatenated the entire zip in memory, so peak usage was the size of the
  // whole board - a few hundred photos was enough to exhaust the function.
  for (const doc of photosSnap.docs) {
    const photo = normalisePhoto(doc.id, doc.data());
    // A deleted photo shouldn't reappear in the zip - that would be the one
    // route by which something a guest removed still gets handed out.
    if (!isVisible(photo)) continue;

    const filename = photo.storagePath.split("/").pop() ?? `${photo.id}.jpg`;
    archive.append(bucket.file(photo.storagePath).createReadStream(), {
      name: `${photo.contributorName}-${filename}`,
    });
  }

  // Deliberately not awaited. finalize() only resolves once everything has
  // been read out of the archive, which cannot happen until the response is
  // being consumed - awaiting it here would deadlock.
  archive.finalize();

  const filename = board.title.replace(/[^a-z0-9]/gi, "-");
  return new NextResponse(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}.zip"`,
    },
  });
}
