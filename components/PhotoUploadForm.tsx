"use client";

import { useRef, useState } from "react";
import { uploadPhoto } from "@/lib/uploadPhoto";
import { inputClass, buttonPrimaryClass } from "@/components/ui";

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
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setFile(picked);
    setPreviewUrl(picked ? URL.createObjectURL(picked) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadPhoto({ boardId, file, caption, contributorName: guestName, contributorGuestId: guestId });
      setFile(null);
      setPreviewUrl(null);
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed, try again.");
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
          capture="environment"
          onChange={handleFileChange}
          className="sr-only"
        />
        {file ? file.name : "Choose a photo"}
      </label>

      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="Preview" className="max-h-52 w-full border border-line object-cover" />
      )}

      <input
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Add a caption (optional)"
        maxLength={280}
        className={inputClass}
      />

      <button type="submit" disabled={!file || uploading} className={buttonPrimaryClass}>
        {uploading ? "Developing…" : "Add to the board"}
      </button>
      {error && <p className="text-sm text-safelight">{error}</p>}
    </form>
  );
}
