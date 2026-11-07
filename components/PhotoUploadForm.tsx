"use client";

import { useRef, useState } from "react";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { inputClass, buttonPrimaryClass } from "@/components/ui";

// One queued photo waiting to be sent. previewUrl is an object URL, so it
// has to be revoked when the entry goes away or the browser holds the file
// in memory for the life of the page.
type PendingPhoto = {
  id: string;
  file: File;
  caption: string;
  previewUrl: string;
};

// The guest's way onto the board: pick photos or videos, give each one an
// optional caption, then send them up one at a time with an "n of m" counter.
// Laid out flat on the black page - a #111 tile to choose files, a #111 row per
// queued photo, and the white pill to send them.
export function PhotoUploadForm({
  boardId,
  guestId,
  guestName,
}: {
  boardId: string;
  guestId: string;
  guestName: string;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adds whatever the guest just picked to the queue, each with its own preview.
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length === 0) return;

    // Appends rather than replaces, so a guest can add from the camera roll
    // and then take a new photo without losing the first selection.
    setPending((current) => [
      ...current,
      ...picked.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        caption: "",
        previewUrl: URL.createObjectURL(file),
      })),
    ]);

    // Clearing lets the same file be picked again after being removed.
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // Sets the caption on one queued photo.
  function updateCaption(id: string, caption: string) {
    setPending((current) => current.map((p) => (p.id === id ? { ...p, caption } : p)));
  }

  // Drops one photo from the queue and frees its preview.
  function removePending(id: string) {
    setPending((current) => {
      const match = current.find((p) => p.id === id);
      if (match) URL.revokeObjectURL(match.previewUrl);
      return current.filter((p) => p.id !== id);
    });
  }

  // Empties the queue after a successful send, freeing every preview.
  function clearPending(items: PendingPhoto[]) {
    items.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
  }

  // Uploads the queue in order, keeping anything that didn't make it.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending.length === 0) return;
    setUploading(true);
    setUploadedCount(0);
    setError(null);

    // Sequential rather than Promise.all: a phone on party wifi uploading
    // ten photos at once tends to stall them all, and this gives an honest
    // "3 of 10" counter.
    const sent: PendingPhoto[] = [];
    try {
      for (const item of pending) {
        await uploadPhoto({
          boardId,
          file: item.file,
          caption: item.caption,
          contributorName: guestName,
          contributorGuestId: guestId,
        });
        sent.push(item);
        setUploadedCount(sent.length);
      }
      clearPending(pending);
    } catch (err) {
      // Keep whatever didn't make it, so a retry doesn't re-upload duplicates.
      const sentIds = new Set(sent.map((p) => p.id));
      sent.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPending((current) => current.filter((p) => !sentIds.has(p.id)));
      setError(
        sent.length > 0
          ? `Added ${sent.length}, then hit an error. The rest are still here — try again.`
          : err instanceof Error
            ? err.message
            : "Upload failed, try again."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      {/* Choosing photos is the first thing a guest does, so with nothing
          queued the chooser IS the primary action (the white pill). Once
          photos are queued it steps back to a quiet "Add more", and the send
          button takes over as the primary. */}
      <label
        className={
          pending.length === 0
            ? `${buttonPrimaryClass} flex cursor-pointer items-center justify-center has-focus-visible:ring-2 has-focus-visible:ring-safelight`
            : "press flex cursor-pointer items-center justify-center rounded-full bg-surface px-4 py-3 text-[15px] text-bone-dim hover:bg-surface-raised hover:text-bone has-focus-visible:ring-2 has-focus-visible:ring-safelight"
        }
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileChange}
          className="sr-only"
        />
        {pending.length > 0 ? "Add more" : "Add photos or video"}
      </label>

      {pending.length > 0 && (
        <div className="flex flex-col gap-2">
          {pending.map((item) => (
            <div key={item.id} className="flex gap-3 rounded-2xl bg-surface p-2">
              {/* A video can't be previewed with an img tag - it would render
                  as a broken image rather than its first frame. */}
              {item.file.type.startsWith("video/") ? (
                <video
                  src={item.previewUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="size-20 shrink-0 rounded-[10px] object-cover"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={item.previewUrl}
                  alt=""
                  className="size-20 shrink-0 rounded-[10px] object-cover"
                />
              )}
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  value={item.caption}
                  onChange={(e) => updateCaption(item.id, e.target.value)}
                  placeholder="Caption (optional)"
                  maxLength={280}
                  disabled={uploading}
                  className={`${inputClass} bg-surface-raised! py-2.5! text-[15px]!`}
                />
                <button
                  type="button"
                  onClick={() => removePending(item.id)}
                  disabled={uploading}
                  className="press self-start rounded-full px-3 py-1.5 text-[15px] text-bone-dim hover:bg-surface-raised hover:text-bone disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-safelight"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Only shown once there's something to send, so a guest never meets
          a greyed-out button. */}
      {pending.length > 0 && (
        <button type="submit" disabled={uploading} className={`${buttonPrimaryClass} tabular mt-1`}>
          {uploading
            ? `Adding ${Math.min(uploadedCount + 1, pending.length)} of ${pending.length}…`
            : pending.length > 1
              ? `Add ${pending.length} photos to the board`
              : "Add to the board"}
        </button>
      )}
      {error && <p className="text-[15px] text-safelight">{error}</p>}
    </form>
  );
}
