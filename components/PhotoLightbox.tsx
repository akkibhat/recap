"use client";

import { useCallback, useEffect, useState } from "react";
import { REACTION_EMOJIS, reactionCounts, isVideo, ReactionEmoji } from "@/lib/types/photo";
import type { RollPhoto } from "@/lib/hooks/usePhotos";
import { setReaction } from "@/lib/setReaction";
import { Comment, MAX_COMMENT_LENGTH } from "@/lib/types/comment";
import { addComment, deleteOwnComment } from "@/lib/comments";
import { updateCaption, MAX_CAPTION_LENGTH } from "@/lib/updateCaption";
import { deleteJson } from "@/lib/api";
import { inputClass, buttonPrimaryClass } from "@/components/ui";

const EMOJI_GLYPH: Record<ReactionEmoji, string> = {
  heart: "❤️",
  laugh: "😂",
  fire: "🔥",
  wow: "😮",
};

// The hour and minute a photo went up, 24-hour, for the line above the photo.
function shotAt(uploadedAt: number): string {
  return new Date(uploadedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Full view of a single photo, on an opaque black ground.
//
// The gallery shows each photo at card width; this is where it gets the whole
// screen - object-contain so nothing is cropped - along with the reactions,
// the caption editor and the comment thread. The backdrop is solid black, not
// translucent, so the wall of photos behind doesn't show through.
export function PhotoLightbox({
  frames,
  index,
  guestId,
  guestName,
  boardId,
  hostKey,
  comments,
  onNavigate,
  onClose,
  onRemove,
  canRemove,
}: {
  frames: RollPhoto[];
  index: number;
  guestId: string;
  guestName: string;
  boardId: string;
  hostKey?: string | null;
  comments: Comment[];
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
      aria-label={`Photo by ${photo.contributorName}`}
      className="fixed inset-0 z-50 flex flex-col bg-ink"
      // Clicking the backdrop closes. The inner panels stop propagation so a
      // tap on the photo or the caption doesn't dismiss what you opened.
      onClick={onClose}
    >
      <div
        className="flex items-center justify-between gap-3 py-2 pr-2 pl-4"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="min-w-0 truncate text-[15px] text-bone-dim">
          <span className="font-medium text-bone">{photo.contributorName}</span>
          <span className="tabular"> · {shotAt(photo.uploadedAt)}</span>
        </p>
        <button
          onClick={onClose}
          aria-label="Close"
          className="press flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-[15px] text-bone hover:bg-surface-raised outline-none focus-visible:ring-2 focus-visible:ring-safelight"
        >
          ✕
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {index > 0 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            aria-label="Newer photo"
            className="press absolute left-2 z-10 flex size-11 items-center justify-center rounded-full bg-ink/60 text-2xl text-bone hover:bg-surface outline-none focus-visible:ring-2 focus-visible:ring-safelight"
          >
            ‹
          </button>
        )}

        {isVideo(photo) ? (
          // key forces a fresh element when stepping between frames - reusing
          // one leaves the previous clip's playback state and, in some
          // browsers, its audio running over the next video.
          <video
            key={photo.id}
            src={photo.downloadUrl}
            poster={photo.thumbUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-[10px] object-contain"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo.downloadUrl}
            alt={photo.caption || `Photo by ${photo.contributorName}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-[10px] object-contain"
          />
        )}

        {index < frames.length - 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            aria-label="Older photo"
            className="press absolute right-2 z-10 flex size-11 items-center justify-center rounded-full bg-ink/60 text-2xl text-bone hover:bg-surface outline-none focus-visible:ring-2 focus-visible:ring-safelight"
          >
            ›
          </button>
        )}
      </div>

      <div
        className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 pt-4 pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wrapping, not truncated - this is where the whole caption is
            easiest to read, and the only place it can be edited. */}
        {/* Both panels are keyed on the photo so stepping to another photo
            resets them; the prefixes keep the two sibling keys distinct. */}
        <CaptionPanel
          key={`caption-${photo.id}`}
          boardId={boardId}
          photoId={photo.id}
          caption={photo.caption}
          canEdit={photo.contributorGuestId === guestId}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setReaction(boardId, photo.id, guestId, emoji, myReaction)}
                aria-label={`React ${emoji}`}
                className={`press flex h-10 min-w-12 items-center justify-center gap-1.5 rounded-full bg-surface px-3 text-[15px] outline-none hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-safelight ${
                  myReaction === emoji ? "text-safelight ring-2 ring-safelight ring-inset" : "text-bone-dim"
                }`}
              >
                <span>{EMOJI_GLYPH[emoji]}</span>
                {counts[emoji] > 0 && <span className="tabular">{counts[emoji]}</span>}
              </button>
            ))}
          </div>

          {canRemove(photo) && (
            <button
              onClick={() => onRemove(photo)}
              className="press shrink-0 rounded-full bg-surface px-4 py-2 text-[15px] text-bone-dim hover:bg-surface-raised hover:text-bone outline-none focus-visible:ring-2 focus-visible:ring-safelight"
            >
              Remove
            </button>
          )}
        </div>

        <CommentThread
          key={`comments-${photo.id}`}
          boardId={boardId}
          photoId={photo.id}
          comments={comments}
          guestId={guestId}
          guestName={guestName}
          hostKey={hostKey}
        />

        <p className="tabular text-center text-[13px] text-bone-faint">
          {index + 1} of {frames.length}
        </p>
      </div>
    </div>
  );
}

// The thread for one photo. Keyed on photo id by the caller so moving to the
// next photo resets the draft rather than carrying a half-typed comment over.
function CommentThread({
  boardId,
  photoId,
  comments,
  guestId,
  guestName,
  hostKey,
}: {
  boardId: string;
  photoId: string;
  comments: Comment[];
  guestId: string;
  guestName: string;
  hostKey?: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Posts the draft as a comment under the guest's name.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;

    setSending(true);
    setError(null);
    try {
      await addComment({ boardId, photoId, body, authorName: guestName, authorGuestId: guestId });
      // Cleared only on success, so a failed send doesn't lose what was typed.
      setDraft("");
    } catch {
      setError("Couldn't post that. Try again.");
    } finally {
      setSending(false);
    }
  }

  // Removes a comment: your own through the client, anyone's through the
  // host route.
  async function handleRemove(comment: Comment) {
    const mine = comment.authorGuestId === guestId;
    try {
      if (mine) await deleteOwnComment(boardId, comment.id, guestId);
      else await deleteJson(`/api/boards/${boardId}/comments/${comment.id}`, hostKey ?? undefined);
    } catch {
      // The comment simply stays; the live query never changed.
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {comments.length > 0 && (
        // Capped height so a long thread can't push the photo off screen on a
        // phone - the picture is still the point of this view.
        <ul className="flex max-h-40 flex-col gap-2.5 overflow-y-auto">
          {comments.map((comment) => {
            const mine = comment.authorGuestId === guestId;
            return (
              <li key={comment.id} className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-[15px] leading-relaxed text-bone-dim">
                  <span className="font-medium text-bone">{comment.authorName}</span>{" "}
                  {comment.body}
                </p>
                {(mine || hostKey) && (
                  <button
                    onClick={() => handleRemove(comment)}
                    aria-label={mine ? "Remove your comment" : "Remove this comment"}
                    className="press flex size-8 shrink-0 items-center justify-center rounded-full text-[13px] text-bone-faint hover:bg-surface hover:text-bone outline-none focus-visible:ring-2 focus-visible:ring-safelight"
                  >
                    ✕
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {guestName ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Say something"
            maxLength={MAX_COMMENT_LENGTH}
            disabled={sending}
            className={`${inputClass} rounded-full! py-2.5! text-[15px]!`}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className={`${buttonPrimaryClass} shrink-0 px-5! py-2.5! text-[15px]!`}
          >
            {sending ? "Posting…" : "Post"}
          </button>
        </form>
      ) : (
        <p className="text-[15px] text-bone-faint">Set your name to comment.</p>
      )}

      {error && <p className="text-[15px] text-safelight">{error}</p>}
    </div>
  );
}

// The caption, and its editor when the photo is yours. Keyed on photo id by the
// caller so stepping to the next photo drops a half-finished edit rather than
// carrying it across to someone else's photo.
function CaptionPanel({
  boardId,
  photoId,
  caption,
  canEdit,
}: {
  boardId: string;
  photoId: string;
  caption: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(caption);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Saves the edited caption and drops back to the read-only view.
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateCaption(boardId, photoId, draft);
      setEditing(false);
    } catch {
      // Left in edit mode with the draft intact, so nothing typed is lost.
      setError("Couldn't save that. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-2">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Caption"
          maxLength={MAX_CAPTION_LENGTH}
          disabled={saving}
          className={`${inputClass} text-[17px]!`}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className={`${buttonPrimaryClass} px-5! py-2! text-[15px]!`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(caption);
              setEditing(false);
              setError(null);
            }}
            disabled={saving}
            className="press rounded-full bg-surface px-4 py-2 text-[15px] text-bone-dim hover:bg-surface-raised hover:text-bone disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-safelight"
          >
            Cancel
          </button>
          {error && <span className="text-[15px] text-safelight">{error}</span>}
        </div>
      </form>
    );
  }

  if (!caption) {
    return canEdit ? (
      <button
        onClick={() => setEditing(true)}
        className="press self-start rounded-full bg-surface px-4 py-2 text-[15px] text-bone-dim hover:bg-surface-raised hover:text-bone disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-safelight"
      >
        Add a caption
      </button>
    ) : null;
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <p className="min-w-0 text-[17px] leading-relaxed text-bone">{caption}</p>
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="press shrink-0 rounded-full bg-surface px-4 py-2 text-[15px] text-bone-dim hover:bg-surface-raised hover:text-bone disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-safelight"
        >
          Edit
        </button>
      )}
    </div>
  );
}
