import type { NextRequest } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { adminApp } from "@/lib/firebase/admin";

// What a request's Firebase sign-in turned out to be. "missing" (no Bearer
// header) and "invalid" (bad or expired token) are kept apart because the
// routes answer them with different messages.
export type IdToken =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "ok"; uid: string; email: string | undefined; emailVerified: boolean };

// Reads and verifies the Firebase ID token in the Authorization header. Never
// throws: each caller decides what a missing or invalid token means for it.
export async function readIdToken(req: NextRequest): Promise<IdToken> {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return { status: "missing" };
  try {
    const decoded = await getAuth(adminApp).verifyIdToken(header.slice(7));
    return {
      status: "ok",
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
    };
  } catch {
    return { status: "invalid" };
  }
}

// True when the token's email is verified and on the allow-list. Requiring
// email_verified matters: matching on an unverified address would let anyone
// who can set an email claim walk in. Google sign-in always verifies.
export function emailAllowed(token: Extract<IdToken, { status: "ok" }>, allowed: string[]): boolean {
  return Boolean(token.email) && token.emailVerified && allowed.includes(token.email!.toLowerCase());
}

// Splits a comma-separated env var into trimmed, lower-case emails, dropping
// blanks. Used for both the admin and the host allow-lists.
export function parseEmailList(raw: string): string[] {
  return raw
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}
