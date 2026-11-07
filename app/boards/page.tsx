"use client";

import Link from "next/link";
import { useAuth, signInWithGoogle } from "@/lib/hooks/useAuth";
import { useMyBoards } from "@/lib/hooks/useMyBoards";
import { LogoMark, Wordmark } from "@/components/Logo";
import { buttonPrimaryClass, buttonSecondaryClass } from "@/components/ui";

// The signed-in host's list of their own boards, newest first, each linking
// to its host screen.
export default function MyBoardsPage() {
  const { user, loading: authLoading } = useAuth();
  const { data: boards, loading: boardsLoading } = useMyBoards(user?.uid ?? null);

  // authLoading matters here: Firebase restores a session asynchronously, so
  // without this a returning host sees "sign in" flash before their own list.
  if (authLoading) {
    return <Centred title="Loading…" />;
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-bone-faint">
          <LogoMark size={32} />
        </span>
        <p className="text-[22px] font-bold tracking-tight">Sign in to see your boards</p>
        <p className="max-w-xs text-[15px] text-bone-dim">
          Boards you started while signed in show up here, on any device.
        </p>
        <button onClick={() => signInWithGoogle()} className={buttonPrimaryClass}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-3 pb-10">
      <div>
        <div className="flex h-14 items-center justify-between gap-3">
          <Wordmark size={19} />
          <Link href="/" className="text-[15px] text-bone-dim hover:text-bone">
            ← Home
          </Link>
        </div>
        <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-tight">Your boards</h1>
      </div>

      {boardsLoading ? (
        <p className="py-8 text-center text-[15px] text-bone-dim">Loading…</p>
      ) : boards.length === 0 ? (
        <div className="rounded-2xl bg-surface px-5 py-14 text-center">
          <p className="text-[17px] text-bone">No boards yet</p>
          <p className="mt-1 text-[15px] text-bone-dim">
            Boards started before you signed in won&apos;t appear here
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/host/${board.id}`}
                className="press flex items-center justify-between gap-3 rounded-2xl bg-surface px-5 py-4 outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-safelight"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-medium text-bone">{board.title}</span>
                  <span className="tabular mt-0.5 block text-sm text-bone-dim">
                    {new Date(board.createdAt).toLocaleDateString()}
                    {" · "}
                    {board.endedAt ? "ended" : <span className="text-safelight">live</span>}
                  </span>
                </span>
                <span className="tabular shrink-0 rounded-full bg-surface-raised px-3.5 py-1.5 text-sm font-medium tracking-[0.06em] text-bone">
                  {board.roomCode}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/"
        className={`${buttonSecondaryClass} self-center`}
      >
        Start another board
      </Link>
    </div>
  );
}

// A single centred status line, for the loading state.
function Centred({ title }: { title: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6">
      <p className="text-[15px] text-bone-dim">{title}</p>
    </div>
  );
}
