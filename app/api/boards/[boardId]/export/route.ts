import { NextRequest, NextResponse } from "next/server";
import * as archiver from "archiver";
import { adminDb, adminStorage } from "@/lib/firebase/admin";
import { requireHostKey } from "@/lib/hostAuth";
import { normalisePhoto } from "@/lib/types/photo";
import { normaliseBoard } from "@/lib/types/board";

export async function GET(req: NextRequest, { params }: { params: Promise<{ boardId: string }> }) {
  const { boardId } = await params;
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  const boardDoc = await adminDb.collection("boards").doc(boardId).get();
  if (!boardDoc.exists) return NextResponse.json({ error: "Board not found." }, { status: 404 });
  const board = normaliseBoard(boardDoc.id, boardDoc.data() ?? {});

  const photosSnap = await adminDb.collection("photos").where("boardId", "==", boardId).get();
  const bucket = adminStorage.bucket();

  const archive = new archiver.ZipArchive({ zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  archive.on("data", (chunk: Buffer) => chunks.push(chunk));

  for (const doc of photosSnap.docs) {
    const photo = normalisePhoto(doc.id, doc.data());
    const [bytes] = await bucket.file(photo.storagePath).download();
    const filename = photo.storagePath.split("/").pop() ?? `${doc.id}.jpg`;
    archive.append(bytes, { name: `${photo.contributorName}-${filename}` });
  }

  await archive.finalize();
  const zipBuffer = Buffer.concat(chunks);

  return new NextResponse(zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${board.title.replace(/[^a-z0-9]/gi, "-")}.zip"`,
    },
  });
}
