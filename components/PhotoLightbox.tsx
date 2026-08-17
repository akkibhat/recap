"use client";

import { useCallback, useEffect, useState } from "react";
import { REACTION_EMOJIS, reactionCounts, isVideo, ReactionEmoji } from "@/lib/types/photo";
import type { RollPhoto } from "@/lib/hooks/usePhotos";
import { setReaction } from "@/lib/setReaction";
import { Comment, MAX_COMMENT_LENGTH } from "@/lib/types/comment";
import { addComment, deleteOwnComment } from "@/lib/comments";
import { updateCaption, MAX_CAPTION_LENGTH } from "@/lib/updateCaption";
import { deleteJson } from "@/lib/api";
import { inputClass } from "@/components/ui";

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
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={photo.downloadUrl}
            alt={photo.caption || `Frame ${photo.frameNumber}`}
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full object-contain"
          />
        )}

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
            is readable, since the strip has exactly one line for it, and the
            only place it can be edited. */}
        <CaptionPanel
          key={photo.id}
          boardId={boardId}
          photoId={photo.id}
          caption={photo.caption}
          canEdit={photo.contributorGuestId === guestId}
        />

        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setReaction(boardId, photo.id, guestId, emoji, myReaction)}
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

        <CommentThread
          key={photo.id}
          boardId={boardId}
          photoId={photo.id}
          comments={comments}
          guestId={guestId}
          guestName={guestName}
          hostKey={hostKey}
        />

        <p className="text-center font-mono text-[11px] text-bone-faint">
          {index + 1} of {frames.length}
        </p>
      </div>
    </div>
  );
}

// The thread for one frame. Keyed on photo id by the caller so moving to the
// next frame resets the draft rather than carrying a half-typed comment over.
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
    <div className="flex flex-col gap-2 border-t border-line pt-3">
      {comments.length > 0 && (
        // Capped height so a long thread can't push the photo off screen on a
        // phone - the picture is still the point of this view.
        <ul className="flex max-h-40 flex-col gap-2 overflow-y-auto">
          {comments.map((comment) => {
            const mine = comment.authorGuestId === guestId;
            return (
              <li key={comment.id} className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-xs leading-relaxed text-bone">
                  <span className="font-mono text-[11px] tracking-widest text-edge uppercase">
                    {comment.authorName}
                  </span>{" "}
                  {comment.body}
                </p>
                {(mine || hostKey) && (
                  <button
                    onClick={() => handleRemove(comment)}
                    aria-label={mine ? "Remove your comment" : "Remove this comment"}
                    className="shrink-0 text-[11px] text-bone-faint hover:text-safelight"
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
            className={`${inputClass} py-2 text-xs`}
          />
          <button
            type="submit"
            disabled={!draft.trim() || sending}
            className="shrink-0 text-xs text-safelight underline underline-offset-4 hover:text-bone disabled:opacity-30"
          >
            {sending ? "Posting…" : "Post"}
          </button>
        </form>
      ) : (
        <p className="text-[11px] text-bone-faint">Set your name to comment.</p>
      )}

      {error && <p className="text-xs text-safelight">{error}</p>}
    </div>
  );
}

// The caption, and its editor when the photo is yours. Keyed on photo id by the
// caller so stepping to the next frame drops a half-finished edit rather than
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
          className={`${inputClass} py-2 text-sm`}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="text-xs text-safelight underline underline-offset-4 hover:text-bone disabled:opacity-30"
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
            className="text-xs text-bone-faint underline underline-offset-4 hover:text-bone disabled:opacity-30"
          >
            Cancel
          </button>
          {error && <span className="text-xs text-safelight">{error}</span>}
        </div>
      </form>
    );
  }

  if (!caption) {
    return canEdit ? (
      <button
        onClick={() => setEditing(true)}
        className="self-start text-xs text-bone-faint underline underline-offset-4 hover:text-bone"
      >
        Add a caption
      </button>
    ) : null;
  }

  return (
    <div className="flex items-start justify-between gap-3">
      <p className="min-w-0 text-sm leading-relaxed text-bone">{caption}</p>
      {canEdit && (
        <button
          onClick={() => setEditing(true)}
          className="shrink-0 text-xs text-bone-faint underline underline-offset-4 hover:text-bone"
        >
          Edit
        </button>
      )}
    </div>
  );
}
