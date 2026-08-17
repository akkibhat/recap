"use client";

import { useCallback, useEffect } from "react";
import { REACTION_EMOJIS, reactionCounts, ReactionEmoji } from "@/lib/types/photo";
import type { RollPhoto } from "@/lib/hooks/usePhotos";
import { setReaction } from "@/lib/setReaction";

const EMOJI_GLYPH: Record<ReactionEmoji, string> = {
  heart: "❤️",
  laugh: "😂",
  fire: "🔥",
  wow: "😮",
};

function shotAt(uploadedAt: number): string {
  return new Date(uploadedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Full view of a single frame.
//
// The gallery crops every photo to 2:3, which suits a phone shot but throws
// away more than half of a landscape one. This is where the photo is finally
// shown whole - hence object-contain rather than object-cover - and where the
// caption appears in full rather than truncated to the strip's one line.
export function PhotoLightbox({
  frames,
  index,
  guestId,
  onNavigate,
  onClose,
  onRemove,
  canRemove,
}: {
  frames: RollPhoto[];
  index: number;
  guestId: string;
  onNavigate: (nextIndex: number) => void;
  onClose: () => void;
  onRemove: (photo: RollPhoto) => void;
  canRemove: (photo: RollPhoto) => boolean;
}) {
  const photo = frames[index];
  const counts = reactionCounts(photo);
  const myReaction = photo.reactedBy[guestId];

  // Frames are displayed newest-first, so "previous" is the newer photo. Both
  // ends stop rather than wrap: a roll has a first and last frame, and looping
  // makes it impossible to tell you've reached either.
  const goPrev = useCallback(() => index > 0 && onNavigate(index - 1), [index, onNavigate]);
  const goNext = useCallback(
    () => index < frames.length - 1 && onNavigate(index + 1),
    [index, frames.length, onNavigate]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, goPrev, goNext]);

  // Stops the gallery scrolling underneath on mobile, where a fixed overlay
  // otherwise still lets the page move behind it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Frame ${photo.frameNumber} by ${photo.contributorName}`}
      className="fixed inset-0 z-50 flex flex-col bg-ink/95"
      // Clicking the backdrop closes. The inner panels stop propagation so a
      // tap on the photo or the caption doesn't dismiss what you opened.
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="truncate font-mono text-[11px] tracking-widest text-edge uppercase">
          {photo.frameNumber} {photo.contributorName}
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="font-mono text-[11px] text-bone-faint">{shotAt(photo.uploadedAt)}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center text-bone-dim hover:text-bone"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {index > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label="Newer frame"
            className="absolute left-1 z-10 flex size-11 items-center justify-center text-bone-dim hover:text-bone"
          >
            ‹
          </button>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.downloadUrl}
          alt={photo.caption || `Frame ${photo.frameNumber}`}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full object-contain"
        />

        {index < frames.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="Older frame"
            className="absolute right-1 z-10 flex size-11 items-center justify-center text-bone-dim hover:text-bone"
          >
            ›
          </button>
        )}
      </div>

      <div
        className="flex flex-col gap-3 px-4 py-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wrapping, not truncated - this is the only place the whole caption
            is readable, since the strip has exactly one line for it. */}
        {photo.caption && <p className="text-sm leading-relaxed text-bone">{photo.caption}</p>}

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setReaction(photo.id, guestId, emoji, myReaction)}
                aria-label={`React ${emoji}`}
                className={`flex min-w-10 items-center justify-center gap-1 rounded-sm px-2 py-2 text-sm transition-transform active:scale-90 ${
                  myReaction === emoji ? "bg-safelight/15 text-safelight" : "text-bone-dim"
                }`}
              >
                <span>{EMOJI_GLYPH[emoji]}</span>
                {counts[emoji] > 0 && <span className="tabular-nums text-xs">{counts[emoji]}</span>}
              </button>
            ))}
          </div>

          {canRemove(photo) && (
            <button
              onClick={() => onRemove(photo)}
              className="shrink-0 text-xs text-bone-faint underline underline-offset-4 hover:text-safelight"
            >
              Remove
            </button>
          )}
        </div>

        <p className="text-center font-mono text-[11px] text-bone-faint">
          {index + 1} of {frames.length}
        </p>
      </div>
    </div>
  );
}
