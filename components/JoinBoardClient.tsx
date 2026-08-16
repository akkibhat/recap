"use client";

import { useState } from "react";
import { useBoardByRoomCode } from "@/lib/hooks/useBoard";
import { usePhotos } from "@/lib/hooks/usePhotos";
import { getOrCreateGuestId, getGuestName, setGuestName } from "@/lib/guestIdentity";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { PhotoGallery } from "@/components/PhotoGallery";
import { LogoMark, Wordmark } from "@/components/Logo";
import { inputClass, buttonPrimaryClass, labelClass } from "@/components/ui";

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
    return <CentredMessage title="Loading…" />;
  }

  if (!board) {
    return (
      <CentredMessage title="No board with that code" detail={`Double check it — you tried ${roomCode}.`} />
    );
  }

  if (board.endedAt) {
    return <CentredMessage title={board.title} detail="This board has ended." />;
  }

  if (!guestName) {
    return <NamePrompt boardTitle={board.title} onSet={setGuestNameState} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h1 className="text-xl font-medium tracking-tight">{board.title}</h1>
        <Wordmark size={18} />
      </div>
      <PhotoUploadForm boardId={board.id} guestId={guestId} guestName={guestName} />
      <PhotoGallery photos={photos} guestId={guestId} />
    </div>
  );
}

function CentredMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-bone-faint">
        <LogoMark size={32} />
      </span>
      <p className="text-lg font-medium">{title}</p>
      {detail && <p className="text-sm text-bone-dim">{detail}</p>}
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-bone">
          <LogoMark size={36} />
        </span>
        <p className={labelClass}>Joining</p>
        <h1 className="text-2xl font-medium tracking-tight">{boardTitle}</h1>
      </div>
      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={40}
          className={inputClass}
        />
        <button type="submit" disabled={!name.trim()} className={buttonPrimaryClass}>
          Join
        </button>
      </form>
    </div>
  );
}
