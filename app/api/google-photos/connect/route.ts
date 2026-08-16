import { NextRequest, NextResponse } from "next/server";
import { requireHostKey } from "@/lib/hostAuth";
import { getGooglePhotosAuthUrl } from "@/lib/googlePhotos";

export async function POST(req: NextRequest) {
  const { boardId } = await req.json();
  const auth = await requireHostKey(req, boardId);
  if (!auth.ok) return auth.response;

  return NextResponse.json({ authUrl: getGooglePhotosAuthUrl(boardId) });
}
