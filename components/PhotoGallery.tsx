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
    return <p className="py-12 text-center text-sm text-zinc-500">No memories yet — be the first to add one.</p>;
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
    <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo.downloadUrl} alt={photo.caption || "Party photo"} className="aspect-square w-full object-cover" />
      <div className="flex flex-col gap-1.5 p-2">
        {photo.caption && <p className="text-xs text-zinc-700 dark:text-zinc-300">{photo.caption}</p>}
        <p className="text-[11px] text-zinc-400">{photo.contributorName}</p>
        <div className="flex gap-1">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setReaction(photo.id, guestId, emoji, myReaction)}
              className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs ${
                myReaction === emoji ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 dark:bg-zinc-800"
              }`}
            >
              <span>{EMOJI_GLYPH[emoji]}</span>
              {counts[emoji] > 0 && <span>{counts[emoji]}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
