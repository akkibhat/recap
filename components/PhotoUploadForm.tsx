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

  function updateCaption(id: string, caption: string) {
    setPending((current) => current.map((p) => (p.id === id ? { ...p, caption } : p)));
  }

  function removePending(id: string) {
    setPending((current) => {
      const match = current.find((p) => p.id === id);
      if (match) URL.revokeObjectURL(match.previewUrl);
      return current.filter((p) => p.id !== id);
    });
  }

  function clearPending(items: PendingPhoto[]) {
    items.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPending([]);
  }

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border border-line bg-surface p-4">
      <label className="flex cursor-pointer items-center justify-center border border-dashed border-line-bright px-4 py-6 text-sm text-bone-dim hover:border-bone hover:text-bone">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          className="sr-only"
        />
        {pending.length > 0 ? "Add more photos" : "Choose photos"}
      </label>

      {pending.length > 0 && (
        <div className="flex flex-col gap-3">
          {pending.map((item) => (
            <div key={item.id} className="flex gap-3 border border-line p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt=""
                className="size-20 shrink-0 border border-line object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <input
                  value={item.caption}
                  onChange={(e) => updateCaption(item.id, e.target.value)}
                  placeholder="Caption (optional)"
                  maxLength={280}
                  disabled={uploading}
                  className={`${inputClass} py-2 text-xs`}
                />
                <button
                  type="button"
                  onClick={() => removePending(item.id)}
                  disabled={uploading}
                  className="self-start text-xs text-bone-faint underline underline-offset-4 hover:text-bone disabled:opacity-30"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button type="submit" disabled={pending.length === 0 || uploading} className={buttonPrimaryClass}>
        {uploading
          ? `Developing ${Math.min(uploadedCount + 1, pending.length)} of ${pending.length}…`
          : pending.length > 1
            ? `Add ${pending.length} photos`
            : "Add to the board"}
      </button>
      {error && <p className="text-sm text-safelight">{error}</p>}
    </form>
  );
}
