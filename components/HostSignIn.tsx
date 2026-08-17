"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth, signInWithGoogle, signOutHost } from "@/lib/hooks/useAuth";

// Firebase's own messages are written for developers - "Database is
// closing/hidden" tells a host nothing, and closing the popup yourself isn't
// an error worth a red line at all. Anything unrecognised falls through with
// its real text, so a genuinely new failure isn't swallowed.
function signInMessage(err: unknown): string | null {
  const code = typeof err === "object" && err && "code" in err ? String(err.code) : "";

  if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return null;
  if (code === "auth/popup-blocked") return "Your browser blocked the sign-in window. Allow popups and try again.";
  if (code === "auth/network-request-failed") return "Couldn't reach Google. Check your connection and try again.";

  const message = err instanceof Error ? err.message : "";
  if (message.includes("Database is closing")) {
    return "Sign-in was interrupted. Try again without switching away from this tab.";
  }

  return message || "Sign-in didn't complete.";
}

// Sign-in is offered, never required. A host can start a board without it and
// everything works; what they give up is being able to get that board back on
// another device or after clearing their browser. The copy says so rather than
// nudging, because adding a login step to a party app needs to earn itself.
export function HostSignIn() {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(signInMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="h-5" />;

  if (user) {
    return (
      <div className="flex items-center justify-center gap-3 text-xs text-bone-faint">
        <Link href="/boards" className="text-bone-dim underline underline-offset-4 hover:text-bone">
          Your boards
        </Link>
        <span aria-hidden="true">·</span>
        <button
          onClick={() => run(signOutHost)}
          disabled={busy}
          className="underline underline-offset-4 hover:text-bone disabled:opacity-30"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => run(signInWithGoogle)}
        disabled={busy}
        className="text-xs text-bone-dim underline underline-offset-4 hover:text-bone disabled:opacity-30"
      >
        {busy ? "Signing in…" : "Sign in to keep your boards"}
      </button>
      <p className="text-center text-[11px] text-bone-faint">
        Optional. Without it a board only lives in this browser.
      </p>
      {error && <p className="text-xs text-safelight">{error}</p>}
    </div>
  );
}
