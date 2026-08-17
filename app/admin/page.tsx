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
  buttonDangerClass,
  labelClass,
} from "@/components/ui";

type AdminBoard = {
  id: string;
  title: string;
  roomCode: string;
  createdAt: number;
  endedAt: number | null;
  ownerUid: string | null;
  googlePhotosConnected: boolean;
  photoCount: number;
  deletedCount: number;
};

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
        <p className="text-lg font-medium">Admin</p>
        <button onClick={() => signInWithGoogle()} className={buttonPrimaryClass}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h1 className="text-xl font-medium tracking-tight">Admin</h1>
        <Wordmark size={18} />
      </div>

      <div className="flex items-center justify-between text-xs text-bone-faint">
        <span className="truncate">{user.email}</span>
        <button
          onClick={() => signOutHost()}
          className="shrink-0 underline underline-offset-4 hover:text-bone"
        >
          Sign out
        </button>
      </div>

      {error && (
        <div className="border border-line bg-surface p-4">
          <p className="text-sm text-safelight">{error}</p>
          <p className="mt-2 text-xs text-bone-faint">
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
                className="flex items-center justify-between gap-3 border border-line bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/host/${board.id}`}
                    className="block truncate text-sm text-bone hover:text-safelight"
                  >
                    {board.title}
                  </Link>
                  <span className="mt-0.5 block font-mono text-[11px] tracking-widest text-bone-faint">
                    {board.roomCode} · {new Date(board.createdAt).toLocaleDateString()} ·{" "}
                    {board.photoCount} photo{board.photoCount === 1 ? "" : "s"}
                    {board.deletedCount > 0 && ` · ${board.deletedCount} deleted`}
                    {!board.ownerUid && " · unowned"}
                  </span>
                </div>
                <button
                  onClick={() => setConfirming(board)}
                  className={`${buttonDangerClass} shrink-0`}
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
        className="w-full max-w-sm border border-line bg-surface p-6"
      >
        <h2 id="delete-board-title" className="text-lg font-medium tracking-tight">
          Delete this board?
        </h2>
        <p className="mt-2 text-sm text-bone-dim">
          {board.title} — {board.photoCount + board.deletedCount} photo
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
            className={`${inputClass} mt-2 uppercase tracking-[0.3em]`}
          />
        </label>

        {error && <p className="mt-4 text-sm text-safelight">{error}</p>}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} disabled={busy} className={buttonSecondaryClass}>
            Cancel
          </button>
          <button onClick={handleDelete} disabled={!matches || busy} className={buttonDangerClass}>
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Centred({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-bone-dim">{children}</div>
  );
}
