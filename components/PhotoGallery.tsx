"use client";

import { Photo, REACTION_EMOJIS, reactionCounts, ReactionEmoji } from "@/lib/types/photo";
import { setReaction } from "@/lib/setReaction";

const EMOJI_GLYPH: Record<ReactionEmoji, string> = {
  heart: "❤️",
  laugh: "😂",
  fire: "🔥",
  wow: "😮",
};

export function PhotoGallery({ photos, guestId }: { photos: Photo[]; guestId: string }) {
  if (photos.length === 0) {
    return (
      <div className="border border-dashed border-line py-16 text-center">
        <p className="text-sm text-bone-dim">Nothing developed yet</p>
        <p className="mt-1 text-xs text-bone-faint">First photo of the night goes here</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {[...photos].reverse().map((photo) => (
        <PhotoCard key={photo.id} photo={photo} guestId={guestId} />
      ))}
    </div>
  );
}

function PhotoCard({ photo, guestId }: { photo: Photo; guestId: string }) {
  const counts = reactionCounts(photo);
  const myReaction = photo.reactedBy[guestId];

  return (
    <div className="flex flex-col border border-line bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.downloadUrl}
        alt={photo.caption || "Party photo"}
        className="aspect-square w-full object-cover"
      />
      <div className="flex flex-col gap-2 p-2.5">
        {photo.caption && <p className="text-xs leading-relaxed text-bone">{photo.caption}</p>}
        <p className="text-[11px] uppercase tracking-wider text-bone-faint">{photo.contributorName}</p>
        <div className="flex gap-1">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setReaction(photo.id, guestId, emoji, myReaction)}
              aria-label={`React ${emoji}`}
              className={`flex min-w-9 items-center justify-center gap-1 border px-1.5 py-1.5 text-xs transition-transform active:scale-90 ${
                myReaction === emoji
                  ? "border-safelight bg-safelight/15 text-safelight"
                  : "border-line text-bone-dim hover:border-line-bright"
              }`}
            >
              <span>{EMOJI_GLYPH[emoji]}</span>
              {counts[emoji] > 0 && <span className="tabular-nums">{counts[emoji]}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
