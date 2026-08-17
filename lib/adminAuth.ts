import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase/admin";

type AdminAuthResult = { ok: true; email: string } | { ok: false; response: NextResponse };

// Who is allowed into the admin tools, as a comma-separated list of Google
// account emails in RECAP_ADMIN_EMAILS.
//
// Email rather than uid purely for setup: you can put your own address in
// .env.local without first signing in somewhere to look up an opaque id. The
// tradeoff is that email is less stable than a uid, which is fine for a
// single-owner personal tool and would not be for anything multi-tenant.
function allowedEmails(): string[] {
  return (process.env.RECAP_ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

// Gate for every admin route. Fails closed in every direction that matters:
// no env var configured means nobody is an admin, not everybody.
export async function requireAdmin(req: NextRequest): Promise<AdminAuthResult> {
  const allowed = allowedEmails();
  if (allowed.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Admin isn't configured. Set RECAP_ADMIN_EMAILS in .env.local." },
        { status: 503 }
      ),
    };
  }

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    return { ok: false, response: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  }

  let email: string | undefined;
  let emailVerified = false;
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(header.slice(7));
    email = decoded.email;
    emailVerified = decoded.email_verified === true;
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Session expired." }, { status: 401 }) };
  }

  // Requiring email_verified matters: matching on an unverified address would
  // let anyone who can set an email claim walk in. Google sign-in always
  // verifies, so this only ever rejects something that shouldn't be here.
  if (!email || !emailVerified || !allowed.includes(email.toLowerCase())) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${email ?? "That account"} isn't an admin.`, signedInAs: email ?? null },
        { status: 403 }
      ),
    };
  }

  return { ok: true, email };
}
