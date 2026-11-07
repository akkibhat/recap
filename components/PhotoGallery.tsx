"use client";

import { useEffect, useState } from "react";
import {
  REACTION_EMOJIS,
  reactionCounts,
  galleryUrl,
  isVideo,
  formatDuration,
  ReactionEmoji,
} from "@/lib/types/photo";
import type { RollPhoto } from "@/lib/hooks/usePhotos";
import { setReaction } from "@/lib/setReaction";
import { deleteOwnPhoto, restoreOwnPhoto } from "@/lib/deletePhoto";
import { deleteJson, postJson } from "@/lib/api";
import { PhotoLightbox } from "@/components/PhotoLightbox";
import { useCommentsByPhoto } from "@/lib/hooks/useComments";

const EMOJI_GLYPH: Record<ReactionEmoji, string> = {
  heart: "❤️",
  laugh: "😂",
  fire: "🔥",
  wow: "😮",
};

// The board's photos as a masonry wall of flat cards, newest first, plus the
// undo notice and the lightbox they open into.
//
// The layout is plain CSS columns: two on a phone, three from `sm`, four from
// `lg`. Each card keeps its photo's own shape, so a landscape shot is no longer
// cropped to a portrait frame, and the columns balance themselves without any
// measuring in JavaScript. CSS columns fill top to bottom, so the newest photo
// sits at the top of the first column.
export function PhotoGallery({
  photos,
  guestId,
  guestName,
  boardId,
  // Present only on the host's own screen. Its presence is what turns on
  // moderation - the ability to remove someone else's photo, not just your own.
  hostKey,
}: {
  photos: RollPhoto[];
  guestId: string;
  guestName: string;
  boardId: string;
  hostKey?: string | null;
}) {
  const { byPhoto: commentsByPhoto } = useCommentsByPhoto(boardId);
  // The removed photo itself, not just its id: once it leaves the live query
  // there is nothing left to look its details up from.
  const [removed, setRemoved] = useState<{ photo: RollPhoto; wasMine: boolean } | null>(null);
  // Index into the displayed order, not a photo id: the lightbox needs to step
  // to the neighbouring photo, which an id alone can't express.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photos.length === 0 && !removed) {
    return (
      <div className="rounded-2xl bg-surface px-5 py-14 text-center">
        <p className="text-[17px] text-bone">No photos yet</p>
        <p className="mt-1 text-[15px] text-bone-dim">The first one of the night goes here.</p>
      </div>
    );
  }

  // Frame numbers already came off the roll in usePhotos, assigned from the
  // unfiltered upload order so deletions can't shift them. All that's left is
  // to show the newest first.
  const frames = [...photos].reverse();

  return (
    <div className="flex flex-col gap-3">
      {removed && (
        <UndoNotice
          removed={removed}
          boardId={boardId}
          hostKey={hostKey}
          onDone={() => setRemoved(null)}
        />
      )}

      <div className="columns-2 gap-2 sm:columns-3 lg:columns-4">
        {frames.map((photo) => (
          <PhotoCard
            key={photo.id}
            photo={photo}
            guestId={guestId}
            boardId={boardId}
            hostKey={hostKey}
            onRemoved={(removedPhoto, wasMine) => setRemoved({ photo: removedPhoto, wasMine })}
            onOpen={(opened) => setOpenIndex(frames.findIndex((f) => f.id === opened.id))}
            commentCount={(commentsByPhoto.get(photo.id) ?? []).length}
          />
        ))}
      </div>

      {openIndex !== null && frames[openIndex] && (
        <PhotoLightbox
          frames={frames}
          index={openIndex}
          guestId={guestId}
          guestName={guestName}
          boardId={boardId}
          hostKey={hostKey}
          comments={commentsByPhoto.get(frames[openIndex].id) ?? []}
          onNavigate={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          canRemove={(photo) => photo.contributorGuestId === guestId || Boolean(hostKey)}
          onRemove={async (photo) => {
            // Closing first: the photo is about to leave the live query, and a
            // lightbox pointing at a photo that no longer exists would land on
            // whatever slid into that index.
            setOpenIndex(null);
            const wasMine = photo.contributorGuestId === guestId;
            try {
              if (wasMine) await deleteOwnPhoto(boardId, photo.id, guestId);
              else await deleteJson(`/api/boards/${boardId}/photos/${photo.id}`, hostKey ?? undefined);
              setRemoved({ photo, wasMine });
            } catch {
              // Nothing to roll back - the photo is still there and the
              // gallery still shows it.
            }
          }}
        />
      )}
    </div>
  );
}

// Undo is cheap only because deletion is soft: the document never left, so
// putting a photo back is clearing two fields. Shown inline above the gallery
// rather than as a floating toast, which would need fixed positioning and
// would cover a photo on a phone.
function UndoNotice({
  removed,
  boardId,
  hostKey,
  onDone,
}: {
  removed: { photo: RollPhoto; wasMine: boolean };
  boardId: string;
  hostKey?: string | null;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { photo, wasMine } = removed;

  // Clears itself after a while so a stale "removed" line doesn't sit there
  // all night. Keyed on the photo id so removing a second photo restarts it.
  useEffect(() => {
    const timer = setTimeout(onDone, 12000);
    return () => clearTimeout(timer);
  }, [photo.id, onDone]);

  // Puts the photo back, through whichever path removed it.
  async function handleUndo() {
    setBusy(true);
    try {
      // A host removal is deliberately not reversible from the client - the
      // Firestore rule only lets a contributor undo their own - so it goes
      // back through the API route instead.
      if (wasMine) await restoreOwnPhoto(boardId, photo.id);
      else await postJson(`/api/boards/${boardId}/photos/${photo.id}`, {}, hostKey ?? undefined);
      onDone();
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface py-2 pr-2 pl-5">
      <span className="min-w-0 truncate text-[15px] text-bone-dim">
        {wasMine ? "Your photo was removed" : `${photo.contributorName}'s photo was removed`}
      </span>
      <button
        onClick={handleUndo}
        disabled={busy}
        className="press shrink-0 rounded-full bg-bone px-4 py-2 text-[15px] font-semibold text-ink hover:bg-bone-dim disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-safelight"
      >
        {busy ? "Undoing…" : "Undo"}
      </button>
    </div>
  );
}

// One photo on the wall: the image (or a video's still) on top, the caption if
// there is one, then the contributor and the reaction counts, then the row of
// reaction buttons. A flat #111 card with no border, set apart from the black
// page by its lightness alone.
function PhotoCard({
  photo,
  guestId,
  boardId,
  hostKey,
  onRemoved,
  onOpen,
  commentCount,
}: {
  photo: RollPhoto;
  guestId: string;
  boardId: string;
  hostKey?: string | null;
  onRemoved: (photo: RollPhoto, wasMine: boolean) => void;
  onOpen: (photo: RollPhoto) => void;
  commentCount: number;
}) {
  const counts = reactionCounts(photo);
  const myReaction = photo.reactedBy[guestId];
  const [removing, setRemoving] = useState(false);

  // Your own photo goes through the client path; anything else needs the host
  // key and the API route, which is the only one of the two actually enforced.
  const isMine = photo.contributorGuestId === guestId;
  const canRemove = isMine || Boolean(hostKey);

  // No confirm dialog: removal is undoable for the next few seconds via the
  // notice the gallery shows, which is friendlier than a modal on a phone and
  // honest about what deleting actually does.
  async function handleRemove() {
    setRemoving(true);
    try {
      if (isMine) {
        await deleteOwnPhoto(boardId, photo.id, guestId);
      } else {
        await deleteJson(`/api/boards/${boardId}/photos/${photo.id}`, hostKey ?? undefined);
      }
      // The photo drops out of the live query and this component unmounts, so
      // the "removed" notice has to be owned by the gallery above.
      onRemoved(photo, isMine);
    } catch {
      setRemoving(false);
    }
  }

  return (
    // break-inside-avoid keeps a card from being split across two columns.
    <div className="mb-2 break-inside-avoid overflow-hidden rounded-[10px] bg-surface">
      <div className="relative">
        {/* The photo is the trigger. A button rather than a click handler on
            the image so it's reachable by keyboard and announced properly. */}
        <button
          onClick={() => onOpen(photo)}
          aria-label={`Open photo by ${photo.contributorName}`}
          className="block w-full outline-none focus-visible:ring-2 focus-visible:ring-safelight focus-visible:ring-inset"
        >
          {/* Even a video shows a still here: the poster frame extracted at
              upload, or the video file itself as a fallback, which browsers
              render as its first frame. A wall of autoplaying clips would be
              unreadable and would pull the whole board over the wire. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={galleryUrl(photo)}
            alt={photo.caption || (isVideo(photo) ? "Party video" : "Party photo")}
            loading="lazy"
            className="block h-auto w-full"
          />

          {isVideo(photo) && (
            <span className="tabular pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-ink/70 px-2.5 py-1 text-[13px] text-bone">
              <span aria-hidden="true">▶</span>
              {photo.durationSeconds !== null && formatDuration(photo.durationSeconds)}
            </span>
          )}
        </button>

        {/* Sits on the photo rather than in the reactions row. A destructive
            control among four emoji is easy to hit with a thumb aiming for a
            reaction, and reads oddly beside them. */}
        {canRemove && (
          <button
            onClick={handleRemove}
            disabled={removing}
            aria-label={isMine ? "Remove your photo" : "Remove this photo"}
            className="press absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-ink/60 text-[13px] text-bone hover:bg-ink/80 disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-safelight"
          >
            {removing ? "…" : "✕"}
          </button>
        )}
      </div>

      {/* Wraps in full: cards in a masonry wall don't have to match heights,
          so there's no reason to cut a caption to one line any more. */}
      {photo.caption && (
        <p className="px-2.5 pt-2 text-[15px] leading-snug text-bone">{photo.caption}</p>
      )}

      <div className="flex items-baseline justify-between gap-2 px-2.5 pt-2">
        <p className="min-w-0 truncate text-[15px] font-medium text-bone">{photo.contributorName}</p>
        {/* Not a button: the whole photo already opens the lightbox, so this
            only has to signal that there's a conversation to find. */}
        {commentCount > 0 && (
          <p
            aria-label={`${commentCount} comment${commentCount === 1 ? "" : "s"}`}
            className="tabular shrink-0 text-[13px] text-bone-dim"
          >
            {commentCount} {commentCount === 1 ? "comment" : "comments"}
          </p>
        )}
      </div>

      {/* The tap targets, each carrying its own count, so a reaction is read
          and given in one place (no separate summary repeating them). */}
      <div className="flex items-center gap-1 px-1.5 pt-1.5 pb-2">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => setReaction(boardId, photo.id, guestId, emoji, myReaction)}
            aria-label={`React ${emoji}${counts[emoji] ? `, ${counts[emoji]} so far` : ""}`}
            aria-pressed={myReaction === emoji}
            className={`press tabular flex h-8 min-w-0 flex-1 items-center justify-center gap-1 rounded-full text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-safelight ${
              myReaction === emoji ? "bg-surface-raised ring-2 ring-safelight ring-inset" : "hover:bg-surface-raised"
            }`}
          >
            <span aria-hidden="true">{EMOJI_GLYPH[emoji]}</span>
            {counts[emoji] > 0 && <span className="text-[13px] text-bone-dim">{counts[emoji]}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
