import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { normaliseBoardSecret } from "@/lib/types/boardSecret";

type HostAuthResult = { ok: true } | { ok: false; response: NextResponse };

// Shared by every host-privileged API route so the hostKey check (and its
// error responses) only exist in one place.
export async function requireHostKey(req: NextRequest, boardId: string): Promise<HostAuthResult> {
  // Most routes are called via fetch() with a header. The export route is a
  // plain browser navigation (triggers a file download), which can't set
  // custom headers, so it falls back to a query param instead.
  const hostKey = req.headers.get("x-host-key") ?? req.nextUrl.searchParams.get("hostKey");
  if (!hostKey) {
    return { ok: false, response: NextResponse.json({ error: "Missing host key." }, { status: 401 }) };
  }

  const secretDoc = await adminDb.collection("boardSecrets").doc(boardId).get();
  if (!secretDoc.exists) {
    return { ok: false, response: NextResponse.json({ error: "Board not found." }, { status: 404 }) };
  }

  const secret = normaliseBoardSecret(secretDoc.data() ?? {});
  if (secret.hostKey !== hostKey) {
    return { ok: false, response: NextResponse.json({ error: "Not the host of this board." }, { status: 403 }) };
  }

  return { ok: true };
}
