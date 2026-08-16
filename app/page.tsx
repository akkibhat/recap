"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api";
import { saveHostKey } from "@/lib/hostIdentity";

type CreateBoardResponse = { boardId: string; roomCode: string; hostKey: string };

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await postJson<CreateBoardResponse>("/api/boards", { title });
      saveHostKey(res.boardId, res.hostKey);
      router.push(`/host/${res.boardId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setCreating(false);
    }
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    if (code) router.push(`/join/${code}`);
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-4xl font-semibold tracking-tight text-center">Recap</h1>
        <p className="mt-2 text-center text-sm text-zinc-500">
          Everyone adds the memories. Relive it together after.
        </p>

        <form onSubmit={handleCreate} className="mt-10 flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="title">
            Start a new board
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Saturday night"
            maxLength={60}
            className="rounded-lg border border-zinc-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={creating || !title.trim()}
            className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
          >
            {creating ? "Creating…" : "Create board"}
          </button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <div className="my-8 flex items-center gap-3 text-xs uppercase text-zinc-400">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          or
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <label className="text-sm font-medium" htmlFor="roomCode">
            Join with a room code
          </label>
          <input
            id="roomCode"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value)}
            placeholder="ABCDE"
            maxLength={5}
            className="rounded-lg border border-zinc-300 px-4 py-3 text-base uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            disabled={!roomCodeInput.trim()}
            className="rounded-lg border border-zinc-300 px-4 py-3 font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Join board
          </button>
        </form>
      </div>
    </div>
  );
}
