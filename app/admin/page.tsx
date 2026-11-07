"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth, signInWithGoogle, signOutHost } from "@/lib/hooks/useAuth";
import { getJson, deleteJson } from "@/lib/api";
import { LogoMark, Wordmark } from "@/components/Logo";
import {
  inputClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  labelClass,
} from "@/components/ui";

// Type-only import of the list route's response row; erased at build.
import type { AdminBoard } from "@/app/api/admin/boards/route";

// Every board on the project, with photo counts and a guarded permanent
// delete. Only addresses in RECAP_ADMIN_EMAILS get a list back from the API.
export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [boards, setBoards] = useState<AdminBoard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AdminBoard | null>(null);

  // Every setState here happens in a promise callback rather than in the
  // function body, so calling this straight from an effect doesn't trigger a
  // synchronous cascading render.
  const load = useCallback(
    () =>
      getJson<{ boards: AdminBoard[] }>("/api/admin/boards")
        .then(({ boards: found }) => {
          setBoards(found);
          setError(null);
        })
        .catch((err: unknown) => {
          setBoards(null);
          setError(err instanceof Error ? err.message : "Couldn't load boards.");
        }),
    []
  );

  // Loads the list once someone is signed in.
  useEffect(() => {
    if (!user) return;
    load();
  }, [user, load]);

  if (authLoading) {
    return <Centred>Loading…</Centred>;
  }

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-bone-faint">
          <LogoMark size={32} />
        </span>
        <p className="text-[22px] font-bold tracking-tight">Admin</p>
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
          <Link href="/boards" className="text-[15px] text-bone-dim hover:text-bone">
            ← Your boards
          </Link>
        </div>
        <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-tight">Admin</h1>
      </div>

      <div className="flex items-center justify-between gap-3 text-[15px] text-bone-dim">
        <span className="truncate">{user.email}</span>
        <button onClick={() => signOutHost()} className={`${buttonSecondaryClass} shrink-0 px-4! py-2! text-[15px]!`}>
          Sign out
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-surface p-5">
          <p className="text-[15px] text-safelight">{error}</p>
          <p className="mt-2 text-sm text-bone-faint">
            Admin access is set with RECAP_ADMIN_EMAILS in .env.local. Add the address above and
            restart the dev server.
          </p>
        </div>
      )}

      {boards && (
        <>
          <p className={labelClass}>
            {boards.length} board{boards.length === 1 ? "" : "s"}
          </p>
          <ul className="flex flex-col gap-2">
            {boards.map((board) => (
              <li
                key={board.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-surface py-3 pr-3 pl-5"
              >
                <div className="min-w-0">
                  <Link
                    href={`/host/${board.id}`}
                    className="block truncate text-[17px] font-medium text-bone hover:text-bone-dim"
                  >
                    {board.title}
                  </Link>
                  <span className="tabular mt-0.5 block text-sm text-bone-dim">
                    <span className="font-medium tracking-[0.06em] text-bone">{board.roomCode}</span> · {new Date(board.createdAt).toLocaleDateString()} ·{" "}
                    {board.photoCount} photo{board.photoCount === 1 ? "" : "s"}
                    {board.deletedCount > 0 && ` · ${board.deletedCount} deleted`}
                    {!board.ownerUid && " · unowned"}
                  </span>
                </div>
                <button
                  onClick={() => setConfirming(board)}
                  className="press shrink-0 rounded-full bg-surface-raised px-4 py-2 text-[15px] text-bone-dim hover:bg-line-bright hover:text-bone outline-none focus-visible:ring-2 focus-visible:ring-safelight"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {confirming && (
        <DeleteBoardDialog
          board={confirming}
          onCancel={() => setConfirming(null)}
          onDeleted={() => {
            setConfirming(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// Typing the room code is the guard. This is the only irreversible action in
// the app - photo deletion is soft everywhere else - so it deserves more
// friction than a button that could be hit by accident.
function DeleteBoardDialog({
  board,
  onCancel,
  onDeleted,
}: {
  board: AdminBoard;
  onCancel: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toUpperCase() === board.roomCode;

  // Deletes the board for good, sending the typed code for the server to check.
  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteJson(`/api/admin/boards/${board.id}`, undefined, {
        confirmRoomCode: typed.trim(),
      });
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-board-title"
        className="w-full max-w-sm rounded-2xl bg-surface p-6"
      >
        <h2 id="delete-board-title" className="text-[22px] font-bold tracking-tight">
          Delete this board?
        </h2>
        <p className="mt-2 text-[15px] text-bone-dim">
          {board.title} · {board.photoCount + board.deletedCount} photo
          {board.photoCount + board.deletedCount === 1 ? "" : "s"} and their files are removed
          permanently. This can&apos;t be undone.
        </p>

        <label className="mt-5 block">
          <span className={labelClass}>Type {board.roomCode} to confirm</span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy}
            className={`${inputClass} tabular mt-2 bg-surface-raised! uppercase tracking-[0.06em]`}
          />
        </label>

        {error && <p className="mt-4 text-[15px] text-safelight">{error}</p>}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} disabled={busy} className={`${buttonSecondaryClass} bg-surface-raised!`}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={!matches || busy} className={buttonPrimaryClass}>
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// A single centred status line, for the loading state.
function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center text-[15px] text-bone-dim">{children}</div>
  );
}
