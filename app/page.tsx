"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api";
import { saveHostKey } from "@/lib/hostIdentity";
import { LogoMark } from "@/components/Logo";
import { HostSignIn } from "@/components/HostSignIn";
import { inputClass, buttonPrimaryClass, buttonSecondaryClass, labelClass } from "@/components/ui";

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
        <div className="flex flex-col items-center gap-3">
          <span className="text-bone">
            <LogoMark size={44} />
          </span>
          <h1 className="text-3xl font-medium tracking-tight">recap</h1>
          <p className="text-center text-sm text-bone-dim">
            Everyone adds a frame. Everyone gets the roll.
          </p>
        </div>

        <form onSubmit={handleCreate} className="mt-12 flex flex-col gap-3">
          <label className={labelClass} htmlFor="title">
            Start a board
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Saturday night"
            maxLength={60}
            className={inputClass}
          />
          <button type="submit" disabled={creating || !title.trim()} className={buttonPrimaryClass}>
            {creating ? "Creating…" : "Create board"}
          </button>
          {error && <p className="text-sm text-safelight">{error}</p>}
        </form>

        <div className="my-10 flex items-center gap-4">
          <div className="h-px flex-1 bg-line" />
          <span className="text-xs uppercase tracking-widest text-bone-faint">or</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleJoin} className="flex flex-col gap-3">
          <label className={labelClass} htmlFor="roomCode">
            Join a board
          </label>
          <input
            id="roomCode"
            value={roomCodeInput}
            onChange={(e) => setRoomCodeInput(e.target.value)}
            placeholder="ABCDE"
            maxLength={5}
            className={`${inputClass} uppercase tracking-[0.4em]`}
          />
          <button type="submit" disabled={!roomCodeInput.trim()} className={buttonSecondaryClass}>
            Join board
          </button>
        </form>

        <div className="mt-10 border-t border-line pt-6">
          <HostSignIn />
        </div>
      </div>
    </div>
  );
}
