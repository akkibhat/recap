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
import { LogoMark, Wordmark } from "@/components/Logo";
import {
  inputClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  buttonDangerClass,
  labelClass,
} from "@/components/ui";

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
    // Deliberately standard polarity (dark modules on a light background).
    // Inverted QR codes read fine on most modern phones but fail on some
    // scanners, and a guest who can't scan can't join - not worth the risk
    // for a nicer-looking code. It's framed as a bone "print" below, which
    // suits the darkroom theme anyway.
    QRCode.toDataURL(joinUrl, {
      width: 240,
      margin: 1,
      color: { dark: "#0a0a0a", light: "#ededed" },
    }).then(setQrDataUrl);
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
    return <div className="flex flex-1 items-center justify-center text-sm text-bone-dim">Loading…</div>;
  }

  if (!board) {
    return <div className="flex flex-1 items-center justify-center text-sm text-bone-dim">Board not found.</div>;
  }

  if (!hostKey) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-bone-faint">
          <LogoMark size={32} />
        </span>
        <p className="text-lg font-medium">You&apos;re not the host of this board</p>
        <p className="text-sm text-bone-dim">
          Join with the room code instead: <span className="text-safelight">{board.roomCode}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h1 className="text-xl font-medium tracking-tight">{board.title}</h1>
        <Wordmark size={18} />
      </div>

      {board.endedAt ? (
        <p className="py-8 text-center text-sm text-bone-dim">This board has ended.</p>
      ) : (
        <div className="flex flex-col items-center gap-4 border border-line bg-surface p-6">
          {qrDataUrl && (
            <div className="bg-bone p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="QR code to join" className="block" />
            </div>
          )}
          <div className="text-center">
            <p className={labelClass}>Room code</p>
            <p className="mt-1 text-4xl font-medium tracking-[0.3em] text-safelight">{board.roomCode}</p>
          </div>
          <p className="text-xs text-bone-faint">Scan, or go to /join/{board.roomCode}</p>

          {board.googlePhotosConnected ? (
            <p className="text-xs text-bone-dim">
              Google Photos connected — photos archive there when you end the board.
            </p>
          ) : (
            <button
              onClick={handleConnectGooglePhotos}
              disabled={connecting}
              className="text-xs text-bone-dim underline underline-offset-4 hover:text-bone disabled:opacity-30"
            >
              {connecting ? "Connecting…" : "Connect Google Photos (optional)"}
            </button>
          )}

          <div className="flex w-full flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:justify-center">
            <a
              href={`/api/boards/${boardId}/export?hostKey=${hostKey}`}
              className={`${buttonSecondaryClass} text-center`}
            >
              Download all as zip
            </a>
            <button onClick={handleEnd} disabled={ending} className={buttonDangerClass}>
              {ending ? "Ending…" : "End board"}
            </button>
          </div>
          {error && <p className="text-sm text-safelight">{error}</p>}
        </div>
      )}

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
              className={inputClass}
            />
            <button type="submit" disabled={!nameDraft.trim()} className={buttonPrimaryClass}>
              Set
            </button>
          </form>
        ))}

      <PhotoGallery photos={photos} guestId={guestId} />
    </div>
  );
}
