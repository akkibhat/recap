"use client";

import { useState } from "react";
import { useBoardByRoomCode } from "@/lib/hooks/useBoard";
import { usePhotos } from "@/lib/hooks/usePhotos";
import { getOrCreateGuestId, getGuestName, setGuestName } from "@/lib/guestIdentity";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { PhotoGallery } from "@/components/PhotoGallery";
import { LogoMark, Wordmark } from "@/components/Logo";
import { inputClass, buttonPrimaryClass } from "@/components/ui";

// The guest's screen for one board, reached by room code: loading and dead-end
// states, the name prompt on first visit, then the board itself - header,
// upload form and photo wall.
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
    return <CentredMessage title="Loading the roll…" />;
  }

  if (!board) {
    return (
      <CentredMessage title="No board with that code" detail={`Double check it — you tried ${roomCode}.`} />
    );
  }

  if (board.endedAt) {
    // If the host archived to Google Photos and pasted back a share link, this
    // is where the night actually pays off - guests land here later and get
    // straight to the album rather than a dead end.
    return (
      <CentredMessage
        title={board.title}
        detail={
          board.googlePhotosShareUrl
            ? "This board has ended — the photos are up."
            : "This board has ended."
        }
        action={
          board.googlePhotosShareUrl ? (
            <a
              href={board.googlePhotosShareUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonPrimaryClass}
            >
              See the album
            </a>
          ) : undefined
        }
      />
    );
  }

  if (!guestName) {
    return <NamePrompt boardTitle={board.title} onSet={setGuestNameState} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 pt-3 pb-10">
      <BoardHeader roomCode={board.roomCode} />
      <div>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{board.title}</h1>
        <BoardSubline photos={photos} live />
      </div>
      <div className="w-full max-w-xl">
        <PhotoUploadForm boardId={board.id} guestId={guestId} guestName={guestName} />
      </div>
      {/* No hostKey here: a guest can remove their own photo and nothing else. */}
      <PhotoGallery photos={photos} guestId={guestId} guestName={guestName} boardId={board.id} />
    </div>
  );
}

// The top bar of a board screen: the wordmark on the left, the room code as a
// pill on the right so a guest can read it out to someone else.
export function BoardHeader({ roomCode }: { roomCode: string }) {
  return (
    <div className="flex h-14 items-center justify-between gap-3">
      <Wordmark size={19} />
      <span className="rounded-full bg-surface px-3.5 py-1.5 text-sm text-bone-dim">
        Code{" "}
        <b className="tabular font-medium tracking-[0.06em] text-bone">{roomCode}</b>
      </span>
    </div>
  );
}

// "8 photos from 5 people", worked out from the photos already on screen,
// with a pink "live" while the board is still open.
export function BoardSubline({ photos, live }: { photos: { contributorGuestId: string }[]; live: boolean }) {
  const people = new Set(photos.map((photo) => photo.contributorGuestId)).size;
  return (
    <p className="tabular mt-1.5 text-[15px] text-bone-dim">
      {photos.length === 0
        ? "No photos yet"
        : `${photos.length} photo${photos.length === 1 ? "" : "s"} from ${people} ${
            people === 1 ? "person" : "people"
          }`}
      {live && (
        <>
          {" · "}
          <span className="text-safelight">live</span>
        </>
      )}
    </p>
  );
}

// A single centred line or two, for loading, unknown-code and ended states.
function CentredMessage({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <span className="text-bone-faint">
        <LogoMark size={32} />
      </span>
      <p className="text-[22px] font-bold tracking-tight">{title}</p>
      {detail && <p className="text-[15px] text-bone-dim">{detail}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

// First visit only: asks for the name that goes on the guest's photos.
function NamePrompt({ boardTitle, onSet }: { boardTitle: string; onSet: (name: string) => void }) {
  const [name, setName] = useState("");

  // Stores the name in this browser and lets the guest in.
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
        <p className="text-[15px] text-bone-dim">Joining</p>
        <h1 className="text-[28px] leading-tight font-bold tracking-tight">{boardTitle}</h1>
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
