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

// The host's sign-in control. Hosts need it to start a board; guests never do.
// `variant="header"` is the compact version for the top bar of the home page:
// a single "Sign in", or "Your boards · Sign out" once signed in.
export function HostSignIn({ variant = "default" }: { variant?: "default" | "header" }) {
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Runs a sign-in or sign-out, turning any failure into a readable message.
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

  if (loading) return <div className="h-6" />;

  const header = variant === "header";

  if (user) {
    return (
      <div className={`flex items-center gap-3 text-bone-dim ${header ? "text-[17px]" : "justify-center text-sm"}`}>
        <Link href="/boards" className="press text-bone hover:opacity-70">
          Your boards
        </Link>
        <span aria-hidden="true">·</span>
        <button onClick={() => run(signOutHost)} disabled={busy} className="press hover:text-bone disabled:opacity-30">
          Sign out
        </button>
      </div>
    );
  }

  if (header) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          onClick={() => run(signInWithGoogle)}
          disabled={busy}
          title="Optional. Signing in keeps your boards across devices."
          className="press text-[17px] text-bone hover:opacity-70 disabled:opacity-30"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {error && <p className="max-w-[260px] text-right text-sm text-safelight">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => run(signInWithGoogle)}
        disabled={busy}
        className="press text-sm text-bone underline decoration-safelight decoration-2 underline-offset-4 hover:decoration-bone disabled:opacity-30"
      >
        {busy ? "Signing in…" : "Sign in to keep your boards"}
      </button>
      <p className="text-center text-sm text-bone-faint">Optional. Without it a board only lives in this browser.</p>
      {error && <p className="text-sm text-safelight">{error}</p>}
    </div>
  );
}
