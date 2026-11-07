import { NextRequest, NextResponse } from "next/server";
import { emailAllowed, parseEmailList, readIdToken } from "@/lib/idToken";

type AdminAuthResult = { ok: true; email: string } | { ok: false; response: NextResponse };

// Who is allowed into the admin tools, as a comma-separated list of Google
// account emails in RECAP_ADMIN_EMAILS.
//
// Email rather than uid purely for setup: you can put your own address in
// .env.local without first signing in somewhere to look up an opaque id. The
// tradeoff is that email is less stable than a uid, which is fine for a
// single-owner personal tool and would not be for anything multi-tenant.
function allowedEmails(): string[] {
  return parseEmailList(process.env.RECAP_ADMIN_EMAILS ?? "");
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

  const token = await readIdToken(req);
  if (token.status === "missing") {
    return { ok: false, response: NextResponse.json({ error: "Sign in first." }, { status: 401 }) };
  }
  if (token.status === "invalid") {
    return { ok: false, response: NextResponse.json({ error: "Session expired." }, { status: 401 }) };
  }

  const email = token.email;
  if (!emailAllowed(token, allowed)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `${email ?? "That account"} isn't an admin.`, signedInAs: email ?? null },
        { status: 403 }
      ),
    };
  }

  return { ok: true, email: email! };
}
