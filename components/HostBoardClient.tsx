"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useBoardById } from "@/lib/hooks/useBoard";
import { usePhotos } from "@/lib/hooks/usePhotos";
import { getHostKey } from "@/lib/hostIdentity";
import { getOrCreateGuestId, getGuestName, setGuestName } from "@/lib/guestIdentity";
import { postJson } from "@/lib/api";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";

export function HostBoardClient({ boardId }: { boardId: string }) {
  const { data: board, loading } = useBoardById(boardId);
  const { data: photos } = usePhotos(boardId);
  // Both read localStorage, unavailable during SSR - resolved at render
  // time (null on the server, real value on the client's first render)
  // rather than mirrored into state via an effect.
  const [hostKey] = useState<string | null>(() =>
    typeof window !== "undefined" ? getHostKey(boardId) : null
  );
  const [guestId] = useState<string | null>(() =>
    typeof window !== "undefined" ? getOrCreateGuestId() : null
  );
  const [guestName, setGuestNameState] = useState<string>(() =>
    typeof window !== "undefined" ? getGuestName() : ""
  );
  const [nameDraft, setNameDraft] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!board) return;
    const joinUrl = `${window.location.origin}/join/${board.roomCode}`;
    QRCode.toDataURL(joinUrl, { width: 240, margin: 1 }).then(setQrDataUrl);
  }, [board]);

  async function handleEnd() {
    if (!hostKey || !confirm("End this board? Guests won't be able to add more photos.")) return;
    setEnding(true);
    setError(null);
    try {
      await postJson(`/api/boards/${boardId}/end`, {}, hostKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not end the board.");
    } finally {
      setEnding(false);
    }
  }

  async function handleConnectGooglePhotos() {
    if (!hostKey) return;
    setConnecting(true);
    setError(null);
    try {
      const { authUrl } = await postJson<{ authUrl: string }>(
        "/api/google-photos/connect",
        { boardId },
        hostKey
      );
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Google Photos.");
      setConnecting(false);
    }
  }

  if (loading || !guestId) {
    return <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Loading…</div>;
  }

  if (!board) {
    return <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">Board not found.</div>;
  }

  if (!hostKey) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <p className="text-lg font-medium">You&apos;re not the host of this board</p>
        <p className="text-sm text-zinc-500">
          Join with the room code instead: <span className="font-mono">{board.roomCode}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <h1 className="text-2xl font-semibold">{board.title}</h1>
        {board.endedAt ? (
          <p className="text-sm text-zinc-500">This board has ended.</p>
        ) : (
          <>
            {qrDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="QR code to join" className="rounded-lg" />
            )}
            <p className="text-3xl font-mono font-semibold tracking-widest">{board.roomCode}</p>
            <p className="text-sm text-zinc-500">Guests scan the code or go to /join/{board.roomCode}</p>

            {board.googlePhotosConnected ? (
              <p className="text-sm text-green-600">
                Google Photos connected — photos archive there when you end the board.
              </p>
            ) : (
              <button
                onClick={handleConnectGooglePhotos}
                disabled={connecting}
                className="text-sm font-medium underline disabled:opacity-40"
              >
                {connecting ? "Connecting…" : "Connect Google Photos (optional)"}
              </button>
            )}

            <div className="mt-2 flex gap-3">
              <a
                href={`/api/boards/${boardId}/export?hostKey=${hostKey}`}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium dark:border-zinc-700"
              >
                Download all as zip
              </a>
              <button
                onClick={handleEnd}
                disabled={ending}
                className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 disabled:opacity-40 dark:border-red-900"
              >
                {ending ? "Ending…" : "End board"}
              </button>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        )}
      </div>

      {!board.endedAt &&
        (guestName ? (
          <PhotoUploadForm boardId={boardId} guestId={guestId} guestName={guestName} />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameDraft.trim()) return;
              setGuestName(nameDraft.trim());
              setGuestNameState(nameDraft.trim());
            }}
            className="flex gap-2"
          >
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name, to add your own photos"
              maxLength={40}
              className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <button
              type="submit"
              disabled={!nameDraft.trim()}
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-zinc-900"
            >
              Set
            </button>
          </form>
        ))}

      <PhotoGallery photos={photos} guestId={guestId} />
    </div>
  );
}
