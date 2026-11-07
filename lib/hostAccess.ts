import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase/admin";
import { parseEmailList } from "@/lib/adminAuth";

type HostAccessResult = { ok: true; uid: string; email: string } | { ok: false; response: NextResponse };

// Who may START a board, as a comma-separated list of Google account emails in
// RECAP_HOST_EMAILS. Recap is a personal tool: guests never sign in, but only
// these accounts can create boards, so a stranger who finds the site can't run
// up storage on it. When RECAP_HOST_EMAILS is unset it falls back to
// RECAP_ADMIN_EMAILS (the owner), and with neither set nobody can create a
// board - it fails closed, never open.
function allowedHostEmails(): string[] {
  return parseEmailList(process.env.RECAP_HOST_EMAILS || process.env.RECAP_ADMIN_EMAILS || "");
}

/** Gate for creating a board: a verified Google sign-in on the allow-list. */
export async function requireHostAccount(req: NextRequest): Promise<HostAccessResult> {
  const allowed = allowedHostEmails();
  if (allowed.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Hosting isn't set up. Set RECAP_HOST_EMAILS in .env.local." },
        { status: 503 }
      ),
    };
  }

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Sign in to start a board." }, { status: 401 }),
    };
  }

  let uid: string;
  let email: string | undefined;
  let emailVerified = false;
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(header.slice(7));
    uid = decoded.uid;
    email = decoded.email;
    emailVerified = decoded.email_verified === true;
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: "Your sign-in expired. Sign in again." }, { status: 401 }),
    };
  }

  // email_verified matters for the same reason as in adminAuth: an unverified
  // address claim could be anything. Google sign-in always verifies.
  if (!email || !emailVerified || !allowed.includes(email.toLowerCase())) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${email ?? "That account"} can't start boards here. You can still join one with a code.` },
        { status: 403 }
      ),
    };
  }

  return { ok: true, uid, email };
}
