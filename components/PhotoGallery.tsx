"use client";

import { Photo, REACTION_EMOJIS, reactionCounts, ReactionEmoji } from "@/lib/types/photo";
import { setReaction } from "@/lib/setReaction";

const EMOJI_GLYPH: Record<ReactionEmoji, string> = {
  heart: "❤️",
  laugh: "😂",
  fire: "🔥",
  wow: "😮",
};

// Edge printing, as found along the rebate of a developed negative. Real 35mm
// alternates plain and "A"-suffixed numbers between the sprockets; a single
// consistent suffix reads the same at a glance and can't be misread as two
// different frames.
function frameNumber(index: number): string {
  return `${String(index + 1).padStart(2, "0")}A`;
}

export function PhotoGallery({ photos, guestId }: { photos: Photo[]; guestId: string }) {
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
  const framed = photos.map((photo, index) => ({ photo, number: frameNumber(index) }));

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {framed.reverse().map(({ photo, number }) => (
        <PhotoFrame key={photo.id} photo={photo} number={number} guestId={guestId} />
      ))}
    </div>
  );
}

// A single frame cut from the roll: sprocket edges top and bottom, the image
// at the 3:2 of real 35mm, and the contributor set as edge printing.
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
    <div className="flex flex-col bg-frame">
      <div className="sprocket-edge" />

      <div className="px-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.downloadUrl}
          alt={photo.caption || "Party photo"}
          className="aspect-3/2 w-full object-cover"
        />

        {photo.caption && (
          <p className="pt-2 text-xs leading-snug text-bone">{photo.caption}</p>
        )}

        <div className="flex items-center justify-between gap-2 py-1.5">
          <span className="truncate font-mono text-[11px] tracking-widest text-edge uppercase">
            {number} {photo.contributorName}
          </span>
          <div className="flex shrink-0 gap-0.5">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setReaction(photo.id, guestId, emoji, myReaction)}
                aria-label={`React ${emoji}`}
                className={`flex min-w-8 items-center justify-center gap-1 rounded-sm px-1 py-1.5 text-xs transition-transform active:scale-90 ${
                  myReaction === emoji ? "bg-safelight/15 text-safelight" : "text-bone-dim"
                }`}
              >
                <span>{EMOJI_GLYPH[emoji]}</span>
                {counts[emoji] > 0 && <span className="tabular-nums">{counts[emoji]}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="sprocket-edge" />
    </div>
  );
}
