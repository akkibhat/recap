"use client";

import { useState } from "react";
import { useBoardByRoomCode } from "@/lib/hooks/useBoard";
import { usePhotos } from "@/lib/hooks/usePhotos";
import { getOrCreateGuestId, getGuestName, setGuestName } from "@/lib/guestIdentity";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { PhotoGallery } from "@/components/PhotoGallery";

export function JoinBoardClient({ roomCode }: { roomCode: string }) {
  // localStorage isn't available during SSR, so these resolve to null/empty
  // on the server and compute the real value on the client's first render -
  // no effect needed for a value that's synchronous once you're in a browser.
  const [guestId] = useState<string | null>(() =>
    typeof window !== "undefined" ? getOrCreateGuestId() : null
  );
  const [guestName, setGuestNameState] = useState<string>(() =>
    typeof window !== "undefined" ? getGuestName() : ""
  );
  const { data: board, loading } = useBoardByRoomCode(roomCode);
  const { data: photos } = usePhotos(board?.id ?? null);

  if (loading || !guestId) {
    return <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Loading…</div>;
  }

  if (!board) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-lg font-medium">Board not found</p>
        <p className="text-sm text-zinc-500">Double check the room code — it&apos;s {roomCode}.</p>
      </div>
    );
  }

  if (board.endedAt) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-lg font-medium">{board.title}</p>
        <p className="text-sm text-zinc-500">This board has ended.</p>
      </div>
    );
  }

  if (!guestName) {
    return <NamePrompt boardTitle={board.title} onSet={setGuestNameState} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <h1 className="text-2xl font-semibold">{board.title}</h1>
      <PhotoUploadForm boardId={board.id} guestId={guestId} guestName={guestName} />
      <PhotoGallery photos={photos} guestId={guestId} />
    </div>
  );
}

function NamePrompt({ boardTitle, onSet }: { boardTitle: string; onSet: (name: string) => void }) {
  const [name, setName] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setGuestName(name.trim());
    onSet(name.trim());
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
      <div>
        <p className="text-sm text-zinc-500">Joining</p>
        <h1 className="text-2xl font-semibold">{boardTitle}</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
          className="rounded-lg border border-zinc-300 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={!name.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
        >
          Join
        </button>
      </form>
    </div>
  );
}
