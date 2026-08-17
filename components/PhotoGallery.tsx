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
import type { Comment } from "@/lib/types/comment";
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
  const columnCount = useColumnCount();
  const { byPhoto: commentsByPhoto } = useCommentsByPhoto(boardId);
  // The removed photo itself, not just its id: once it leaves the live query
  // there is nothing left to look its details up from.
  const [removed, setRemoved] = useState<{ photo: RollPhoto; wasMine: boolean } | null>(null);
  // Index into the displayed frame order, not a photo id: the lightbox needs
  // to step to the neighbouring frame, which an id alone can't express.
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (photos.length === 0 && !removed) {
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
    <div className="flex flex-col gap-3">
      {removed && (
        <UndoNotice
          removed={removed}
          boardId={boardId}
          hostKey={hostKey}
          onDone={() => setRemoved(null)}
        />
      )}

      <div className="flex gap-3">
        {dealIntoColumns(frames, columnCount).map((column, index) => (
          <FilmStrip
            key={index}
            frames={column}
            guestId={guestId}
            boardId={boardId}
            hostKey={hostKey}
            onRemoved={(photo, wasMine) => setRemoved({ photo, wasMine })}
            commentsByPhoto={commentsByPhoto}
            onOpen={(photo) => setOpenIndex(frames.findIndex((f) => f.id === photo.id))}
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
            // Closing first: the frame is about to leave the live query, and a
            // lightbox pointing at a photo that no longer exists would land on
            // whatever slid into that index.
            setOpenIndex(null);
            const wasMine = photo.contributorGuestId === guestId;
            try {
              if (wasMine) await deleteOwnPhoto(boardId, photo.id, guestId);
              else await deleteJson(`/api/boards/${boardId}/photos/${photo.id}`, hostKey ?? undefined);
              setRemoved({ photo, wasMine });
            } catch {
              // Nothing to roll back - the photo is still there and the strip
              // still shows it.
            }
          }}
        />
      )}
    </div>
  );
}

// Undo is cheap only because deletion is soft: the document never left, so
// putting a frame back is clearing two fields. Shown inline above the strips
// rather than as a floating toast, which would need fixed positioning and
// would cover a frame on a phone.
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
  // all night. Keyed on the photo id so removing a second frame restarts it.
  useEffect(() => {
    const timer = setTimeout(onDone, 12000);
    return () => clearTimeout(timer);
  }, [photo.id, onDone]);

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
    <div className="flex items-center justify-between gap-3 border border-line bg-surface px-3 py-2">
      <span className="min-w-0 truncate text-xs text-bone-dim">
        Frame {photo.frameNumber} taken off the roll
      </span>
      <button
        onClick={handleUndo}
        disabled={busy}
        className="shrink-0 text-xs text-safelight underline underline-offset-4 hover:text-bone disabled:opacity-30"
      >
        {busy ? "Undoing…" : "Undo"}
      </button>
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
  onRemoved,
  onOpen,
  commentsByPhoto,
}: {
  frames: RollPhoto[];
  guestId: string;
  boardId: string;
  hostKey?: string | null;
  onRemoved: (photo: RollPhoto, wasMine: boolean) => void;
  onOpen: (photo: RollPhoto) => void;
  commentsByPhoto: Map<string, Comment[]>;
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
            onRemoved={onRemoved}
            onOpen={onOpen}
            commentCount={(commentsByPhoto.get(photo.id) ?? []).length}
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
    <div className="py-1.5">
      <div className="relative">
        {/* 2:3 rather than 35mm's native 3:2, because these are phone photos.
            A portrait shot survives this crop untouched where a landscape one
            keeps 44% - and at a party, phones are held upright. No single
            ratio is kind to both orientations, so this picks the common case. */}
        {/* The frame is the trigger. A button rather than a click handler on
            the image so it's reachable by keyboard and announced properly. */}
        <button
          onClick={() => onOpen(photo)}
          aria-label={`Open frame ${photo.frameNumber} by ${photo.contributorName}`}
          className="block w-full"
        >
          {/* Even a video shows a still here: the poster frame extracted at
              upload, or the video file itself as a fallback, which browsers
              render as its first frame. A strip of autoplaying clips would be
              unreadable and would pull the whole board over the wire. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={galleryUrl(photo)}
            alt={photo.caption || (isVideo(photo) ? "Party video" : "Party photo")}
            loading="lazy"
            className="aspect-2/3 w-full object-cover"
          />

          {isVideo(photo) && (
            <span className="pointer-events-none absolute bottom-1 left-1 flex items-center gap-1 bg-ink/70 px-1.5 py-0.5 font-mono text-[11px] text-bone">
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
            className="absolute top-1 right-1 flex size-7 items-center justify-center bg-ink/60 text-xs text-bone/70 hover:bg-ink/80 hover:text-safelight disabled:opacity-30"
          >
            {removing ? "…" : "✕"}
          </button>
        )}
      </div>

      {/* Caption and edge printing share one line: the caption takes whatever
          is left and truncates, the frame number and contributor hold their
          place at the end.

          Exactly one line either way, captioned or not. Frames on a roll are
          identical by definition, and structurally dealIntoColumns keeps the
          strips level only because it can assume equal heights - it has no way
          to know that some frames are a line shorter. */}
      <div className="flex items-baseline gap-2 pt-1.5">
        <p className="min-w-0 flex-1 truncate text-xs leading-snug text-bone">{photo.caption}</p>
        <p className="shrink-0 font-mono text-[11px] tracking-widest text-edge uppercase">
          {photo.frameNumber} {photo.contributorName}
        </p>
      </div>

      {/* On its own row rather than sharing the edge-printing line: a strip is
          roughly half the width of the old grid card, and four reaction
          targets alongside a name does not fit on a phone. */}
      <div className="flex gap-0.5">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => setReaction(boardId, photo.id, guestId, emoji, myReaction)}
            aria-label={`React ${emoji}`}
            className={`flex min-w-7 flex-1 items-center justify-center gap-0.5 rounded-sm px-0.5 py-1.5 text-xs transition-transform active:scale-90 ${
              myReaction === emoji ? "bg-safelight/15 text-safelight" : "text-bone-dim"
            }`}
          >
            <span>{EMOJI_GLYPH[emoji]}</span>
            {counts[emoji] > 0 && <span className="tabular-nums">{counts[emoji]}</span>}
          </button>
        ))}

        {/* Not a button: the whole frame already opens the lightbox, so this
            only has to signal that there's a conversation to find. */}
        {commentCount > 0 && (
          <span
            aria-label={`${commentCount} comment${commentCount === 1 ? "" : "s"}`}
            className="flex shrink-0 items-center gap-0.5 px-1 py-1.5 font-mono text-[11px] text-bone-faint"
          >
            {commentCount} ”
          </span>
        )}
      </div>
    </div>
  );
}
