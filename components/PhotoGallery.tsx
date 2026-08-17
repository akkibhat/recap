"use client";

import { useEffect, useState } from "react";
import { Photo, REACTION_EMOJIS, reactionCounts, ReactionEmoji } from "@/lib/types/photo";
import { setReaction } from "@/lib/setReaction";

const EMOJI_GLYPH: Record<ReactionEmoji, string> = {
  heart: "❤️",
  laugh: "😂",
  fire: "🔥",
  wow: "😮",
};

// Tailwind's `sm` and `lg`, so the gallery steps at the same widths as the
// rest of the app's layout.
const TWO_COLUMN_QUERY = "(min-width: 40rem)";
const THREE_COLUMN_QUERY = "(min-width: 64rem)";

type Frame = { photo: Photo; number: string };

// Edge printing, as found along the rebate of a developed negative. Real 35mm
// alternates plain and "A"-suffixed numbers between the sprockets; a single
// consistent suffix reads the same at a glance and can't be misread as two
// different frames.
function frameNumber(index: number): string {
  return `${String(index + 1).padStart(2, "0")}A`;
}

// One strip on a phone, two on a tablet, three on a desktop.
//
// A phone gets a single strip on purpose. Splitting a ~343px content width in
// two leaves each 3:2 frame about 136px across and 91px tall, which is too
// small to make out a face - and there is no lightbox to fall back on. One
// strip gives roughly 313px-wide frames instead, which is the point of looking
// at photos at all.
//
// Starts at 1 on both server and client and only widens after mount: reading
// matchMedia during the first render would make the two disagree and break
// hydration.
function useColumnCount(): number {
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const two = window.matchMedia(TWO_COLUMN_QUERY);
    const three = window.matchMedia(THREE_COLUMN_QUERY);
    const sync = () => setColumns(three.matches ? 3 : two.matches ? 2 : 1);
    sync();

    // Listening to plain resize as well as each query's own change event. The
    // change event is the right API and fires on a real phone rotating, but it
    // is not dispatched under devtools viewport emulation, which makes the
    // responsive behaviour impossible to test. Re-running sync costs nothing
    // when the answer hasn't changed - React bails out of the re-render when
    // the state is identical.
    two.addEventListener("change", sync);
    three.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      two.removeEventListener("change", sync);
      three.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return columns;
}

// Deals the frames across the strips in rotation rather than filling one strip
// before starting the next. Every frame is the same height, so rotation keeps
// the strips level without measuring anything, and it also means reading the
// top row left to right gives you the most recent photos.
function dealIntoColumns(frames: Frame[], columnCount: number): Frame[][] {
  const columns: Frame[][] = Array.from({ length: columnCount }, () => []);
  frames.forEach((frame, index) => columns[index % columnCount].push(frame));
  // A board with fewer photos than columns would otherwise render empty strips
  // of bare sprockets alongside the real one.
  return columns.filter((column) => column.length > 0);
}

export function PhotoGallery({ photos, guestId }: { photos: Photo[]; guestId: string }) {
  const columnCount = useColumnCount();

  if (photos.length === 0) {
    return (
      <div className="border border-dashed border-line py-16 text-center">
        <p className="text-sm text-bone-dim">Nothing developed yet</p>
        <p className="mt-1 text-xs text-bone-faint">First frame of the night goes here</p>
      </div>
    );
  }

  // `photos` arrives oldest-first, which is the order the roll was actually
  // shot in - so a photo's index IS its frame number. Number before reversing,
  // otherwise the newest photo would come out as frame 1.
  const frames: Frame[] = photos.map((photo, index) => ({
    photo,
    number: frameNumber(index),
  }));
  frames.reverse();

  return (
    <div className="flex gap-3">
      {dealIntoColumns(frames, columnCount).map((column, index) => (
        <FilmStrip key={index} frames={column} guestId={guestId} />
      ))}
    </div>
  );
}

// One continuous length of film running down the page, perforated down both
// sides. The sprockets belong to the strip rather than to each frame, so the
// perforations run unbroken past the rebate between one frame and the next -
// which is the whole reason this reads as a roll rather than as a stack of
// separate cards.
function FilmStrip({ frames, guestId }: { frames: Frame[]; guestId: string }) {
  return (
    <div className="flex min-w-0 flex-1 bg-frame">
      <div className="sprocket-column" />
      <div className="min-w-0 flex-1 py-1.5">
        {frames.map(({ photo, number }) => (
          <PhotoFrame key={photo.id} photo={photo} number={number} guestId={guestId} />
        ))}
      </div>
      <div className="sprocket-column" />
    </div>
  );
}

function PhotoFrame({
  photo,
  number,
  guestId,
}: {
  photo: Photo;
  number: string;
  guestId: string;
}) {
  const counts = reactionCounts(photo);
  const myReaction = photo.reactedBy[guestId];

  return (
    <div className="py-1.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.downloadUrl}
        alt={photo.caption || "Party photo"}
        className="aspect-3/2 w-full object-cover"
      />

      {photo.caption && <p className="pt-1.5 text-xs leading-snug text-bone">{photo.caption}</p>}

      <p className="truncate pt-1.5 font-mono text-[11px] tracking-widest text-edge uppercase">
        {number} {photo.contributorName}
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
      </div>
    </div>
  );
}
