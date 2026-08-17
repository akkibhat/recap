"use client";

import Link from "next/link";
import { useAuth, signInWithGoogle } from "@/lib/hooks/useAuth";
import { useMyBoards } from "@/lib/hooks/useMyBoards";
import { LogoMark, Wordmark } from "@/components/Logo";
import { buttonPrimaryClass, labelClass } from "@/components/ui";

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
        <p className="text-lg font-medium">Sign in to see your boards</p>
        <p className="max-w-xs text-sm text-bone-dim">
          Boards you started while signed in show up here, on any device.
        </p>
        <button onClick={() => signInWithGoogle()} className={buttonPrimaryClass}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h1 className="text-xl font-medium tracking-tight">Your boards</h1>
        <Wordmark size={18} />
      </div>

      {boardsLoading ? (
        <p className="py-8 text-center text-sm text-bone-dim">Loading…</p>
      ) : boards.length === 0 ? (
        <div className="border border-dashed border-line py-16 text-center">
          <p className="text-sm text-bone-dim">No boards yet</p>
          <p className="mt-1 text-xs text-bone-faint">
            Boards started before you signed in won&apos;t appear here
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {boards.map((board) => (
            <li key={board.id}>
              <Link
                href={`/host/${board.id}`}
                className="flex items-center justify-between gap-3 border border-line bg-surface px-4 py-3 hover:border-line-bright"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-bone">{board.title}</span>
                  <span className="mt-0.5 block font-mono text-[11px] tracking-widest text-bone-faint">
                    {new Date(board.createdAt).toLocaleDateString()}
                    {board.endedAt ? " · developed" : " · still rolling"}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm tracking-[0.2em] text-safelight">
                  {board.roomCode}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/"
        className="text-center text-xs text-bone-dim underline underline-offset-4 hover:text-bone"
      >
        Start another board
      </Link>
    </div>
  );
}

function Centred({ title }: { title: string }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 text-sm text-bone-dim">
      <p className={labelClass}>{title}</p>
    </div>
  );
}
