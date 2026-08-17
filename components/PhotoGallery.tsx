"use client";

import { useEffect, useState } from "react";
import { REACTION_EMOJIS, reactionCounts, ReactionEmoji } from "@/lib/types/photo";
import type { RollPhoto } from "@/lib/hooks/usePhotos";
import { setReaction } from "@/lib/setReaction";
import { deleteOwnPhoto } from "@/lib/deletePhoto";
import { deleteJson } from "@/lib/api";

const EMOJI_GLYPH: Record<ReactionEmoji, string> = {
  heart: "❤️",
  laugh: "😂",
  fire: "🔥",
  wow: "😮",
};

// Tailwind's `sm`, so the gallery steps at the same width as the rest of the
// app's layout.
const TWO_COLUMN_QUERY = "(min-width: 40rem)";


// One strip on a phone, two once there's room, and deliberately never three.
//
// A phone gets a single strip because splitting a ~343px content width in two
// leaves each frame about 136px across - too small to make out a face, with no
// lightbox to fall back on. One strip gives 313x470 frames instead, which is
// the point of looking at photos at all.
//
// It stops at two for the same reason at the other end. The page is capped at
// max-w-2xl, so the gallery never exceeds ~640px however large the screen is;
// a third strip divides that into 175px-wide frames, narrower than a phone
// shows. That would leave the biggest screens displaying the smallest photos.
// Adding a third strip only makes sense alongside widening the page container.
//
// Starts at 1 on both server and client and only widens after mount: reading
// matchMedia during the first render would make the two disagree and break
// hydration.
function useColumnCount(): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const query = window.matchMedia(TWO_COLUMN_QUERY);
    const sync = () => setColumns(query.matches ? 2 : 1);
    sync();

    // Listening to plain resize as well as the query's own change event. The
    // change event is the right API and fires on a real phone rotating, but it
    // is not dispatched under devtools viewport emulation, which makes the
    // responsive behaviour impossible to test. Re-running sync costs nothing
    // when the answer hasn't changed - React bails out of the re-render when
    // the state is identical.
    query.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      query.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return columns;
}

// Deals the frames across the strips in rotation rather than filling one strip
// before starting the next. Every frame is the same height, so rotation keeps
// the strips level without measuring anything, and it also means reading the
// top row left to right gives you the most recent photos.
function dealIntoColumns(frames: RollPhoto[], columnCount: number): RollPhoto[][] {
  const columns: RollPhoto[][] = Array.from({ length: columnCount }, () => []);
  frames.forEach((frame, index) => columns[index % columnCount].push(frame));
  // A board with fewer photos than columns would otherwise render empty strips
  // of bare sprockets alongside the real one.
  return columns.filter((column) => column.length > 0);
}

export function PhotoGallery({
  photos,
  guestId,
  boardId,
  // Present only on the host's own screen. Its presence is what turns on
  // moderation - the ability to remove someone else's photo, not just your own.
  hostKey,
}: {
  photos: RollPhoto[];
  guestId: string;
  boardId: string;
  hostKey?: string | null;
}) {
  const columnCount = useColumnCount();

  if (photos.length === 0) {
    return (
      <div className="border border-dashed border-line py-16 text-center">
        <p className="text-sm text-bone-dim">Nothing developed yet</p>
        <p className="mt-1 text-xs text-bone-faint">First frame of the night goes here</p>
      </div>
    );
  }

  // Frame numbers already came off the roll in usePhotos, assigned from the
  // unfiltered upload order so deletions can't shift them. All that's left is
  // to show the newest first.
  const frames = [...photos].reverse();

  return (
    <div className="flex gap-3">
      {dealIntoColumns(frames, columnCount).map((column, index) => (
        <FilmStrip
          key={index}
          frames={column}
          guestId={guestId}
          boardId={boardId}
          hostKey={hostKey}
        />
      ))}
    </div>
  );
}

// One continuous length of film running down the page, perforated down both
// sides. The sprockets belong to the strip rather than to each frame, so the
// perforations run unbroken past the rebate between one frame and the next -
// which is the whole reason this reads as a roll rather than as a stack of
// separate cards.
function FilmStrip({
  frames,
  guestId,
  boardId,
  hostKey,
}: {
  frames: RollPhoto[];
  guestId: string;
  boardId: string;
  hostKey?: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-1 bg-frame">
      <div className="sprocket-column" />
      <div className="min-w-0 flex-1 py-1.5">
        {frames.map((photo) => (
          <PhotoFrame
            key={photo.id}
            photo={photo}
            guestId={guestId}
            boardId={boardId}
            hostKey={hostKey}
          />
        ))}
      </div>
      <div className="sprocket-column" />
    </div>
  );
}

function PhotoFrame({
  photo,
  guestId,
  boardId,
  hostKey,
}: {
  photo: RollPhoto;
  guestId: string;
  boardId: string;
  hostKey?: string | null;
}) {
  const counts = reactionCounts(photo);
  const myReaction = photo.reactedBy[guestId];
  const [removing, setRemoving] = useState(false);

  // Your own photo goes through the client path; anything else needs the host
  // key and the API route, which is the only one of the two actually enforced.
  const isMine = photo.contributorGuestId === guestId;
  const canRemove = isMine || Boolean(hostKey);

  async function handleRemove() {
    // Says out loud that removal takes a photo off the board but doesn't
    // guarantee the host discards it - they review deleted frames when the
    // board ends and may keep them. Deleting is soft by design, so promising
    // anything stronger here would be a lie.
    const warning = isMine
      ? "Take your photo off the roll? The host still sees it when they develop the roll, and can choose to keep it."
      : "Take this photo off the roll? You'll still see it when you develop the roll.";
    if (!confirm(warning)) return;
    setRemoving(true);
    try {
      if (isMine) {
        await deleteOwnPhoto(photo.id, guestId);
      } else {
        await deleteJson(`/api/boards/${boardId}/photos/${photo.id}`, hostKey ?? undefined);
      }
      // No success branch: the photo drops out of the live query, so this
      // component unmounts on its own.
    } catch {
      setRemoving(false);
    }
  }

  return (
    <div className="py-1.5">
      {/* 2:3 rather than 35mm's native 3:2, because these are phone photos.
          A portrait shot survives this crop untouched where a landscape one
          keeps 44% - and at a party, phones are held upright. No single ratio
          is kind to both orientations, so this picks the common case. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.downloadUrl}
        alt={photo.caption || "Party photo"}
        className="aspect-2/3 w-full object-cover"
      />

      {photo.caption && <p className="pt-1.5 text-xs leading-snug text-bone">{photo.caption}</p>}

      <p className="truncate pt-1.5 font-mono text-[11px] tracking-widest text-edge uppercase">
        {photo.frameNumber} {photo.contributorName}
      </p>

      {/* On its own row rather than sharing the edge-printing line: a strip is
          roughly half the width of the old grid card, and four reaction
          targets alongside a name does not fit on a phone. */}
      <div className="flex gap-0.5 pt-0.5">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => setReaction(photo.id, guestId, emoji, myReaction)}
            aria-label={`React ${emoji}`}
            className={`flex min-w-7 flex-1 items-center justify-center gap-0.5 rounded-sm px-0.5 py-1.5 text-xs transition-transform active:scale-90 ${
              myReaction === emoji ? "bg-safelight/15 text-safelight" : "text-bone-dim"
            }`}
          >
            <span>{EMOJI_GLYPH[emoji]}</span>
            {counts[emoji] > 0 && <span className="tabular-nums">{counts[emoji]}</span>}
          </button>
        ))}

        {canRemove && (
          <button
            onClick={handleRemove}
            disabled={removing}
            aria-label={isMine ? "Remove your photo" : "Remove this photo"}
            title={isMine ? "Remove your photo" : "Remove this photo"}
            className="flex min-w-7 shrink-0 items-center justify-center rounded-sm px-0.5 py-1.5 text-xs text-bone-faint hover:text-safelight disabled:opacity-30"
          >
            {removing ? "…" : "✕"}
          </button>
        )}
      </div>
    </div>
  );
}
