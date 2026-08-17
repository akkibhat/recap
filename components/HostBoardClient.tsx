"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useBoardById } from "@/lib/hooks/useBoard";
import { usePhotos } from "@/lib/hooks/usePhotos";
import { getHostKey, saveHostKey } from "@/lib/hostIdentity";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserAccount } from "@/lib/hooks/useUserAccount";
import { getOrCreateGuestId, getGuestName, setGuestName } from "@/lib/guestIdentity";
import { postJson, getJson } from "@/lib/api";
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

type EndResult = { archiveError: string | null; archivedCount: number; albumUrl: string | null };

export function HostBoardClient({ boardId }: { boardId: string }) {
  const { data: board, loading } = useBoardById(boardId);
  const { data: photos } = usePhotos(boardId);
  // Both read localStorage, unavailable during SSR - resolved at render
  // time (null on the server, real value on the client's first render)
  // rather than mirrored into state via an effect.
  const { user, loading: authLoading } = useAuth();
  const { data: account } = useUserAccount(user?.uid ?? null);
  const [hostKey, setHostKey] = useState<string | null>(() =>
    typeof window !== "undefined" ? getHostKey(boardId) : null
  );
  // Only set when recovery has actually been tried and failed. "Currently
  // recovering" is derived from it rather than stored, so the effect never
  // calls setState synchronously in its own body.
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const [guestId] = useState<string | null>(() =>
    typeof window !== "undefined" ? getOrCreateGuestId() : null
  );
  const [guestName, setGuestNameState] = useState<string>(() =>
    typeof window !== "undefined" ? getGuestName() : ""
  );
  const [nameDraft, setNameDraft] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [archiveOnEnd, setArchiveOnEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endResult, setEndResult] = useState<EndResult | null>(null);
  const [connecting, setConnecting] = useState(false);
  // Only meaningful once the QR has auto-collapsed - lets the host pull it
  // back up for a latecomer without un-collapsing it for the rest of the night.
  const [qrForced, setQrForced] = useState(false);
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

  // The recovery path in practice. If this browser has no key for the board
  // but the signed-in account owns it, fetch the key back and store it - so a
  // host on a new phone, or after clearing their browser, simply lands on a
  // working board rather than being told it isn't theirs.
  useEffect(() => {
    if (hostKey || !user || !board) return;
    if (board.ownerUid !== user.uid) return;

    let cancelled = false;
    getJson<{ hostKey: string }>(`/api/boards/${boardId}/host-key`)
      .then(({ hostKey: recovered }) => {
        if (cancelled) return;
        saveHostKey(boardId, recovered);
        setHostKey(recovered);
      })
      .catch(() => {
        // Nothing worth telling the host: a failed recovery just leaves them
        // on the "not the host" screen, which is the honest outcome.
        if (!cancelled) setRecoveryFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [hostKey, user, board, boardId]);

  // Opening the dialog pre-ticks the archive box when an album is connected -
  // that's what connecting was for - but the host still has to pass through
  // the dialog, so it's never a silent default.
  function openEndDialog() {
    setArchiveOnEnd(account?.googlePhotosConnected ?? false);
    setError(null);
    setConfirmingEnd(true);
  }

  async function handleEnd() {
    if (!hostKey) return;
    setEnding(true);
    setError(null);
    try {
      const result = await postJson<EndResult>(
        `/api/boards/${boardId}/end`,
        { archiveToGooglePhotos: archiveOnEnd },
        hostKey
      );
      setEndResult(result);
      setConfirmingEnd(false);
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
        {},
        hostKey
      );
      window.location.href = authUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect Google Photos.");
      setConnecting(false);
    }
  }

  if (loading || !guestId) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-bone-dim">
        Loading the roll…
      </div>
    );
  }

  if (!board) {
    return <div className="flex flex-1 items-center justify-center text-sm text-bone-dim">Board not found.</div>;
  }

  if (!hostKey) {
    // Recovery is possible, and hasn't failed yet, so a key may still arrive.
    const recovering = Boolean(user && board.ownerUid === user.uid) && !recoveryFailed;

    // Still resolving: auth hasn't restored yet, or recovery is in flight.
    if (authLoading || recovering) {
      return (
        <div className="flex flex-1 items-center justify-center text-sm text-bone-dim">
          Finding your roll…
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-bone-faint">
          <LogoMark size={32} />
        </span>
        <p className="text-lg font-medium">You&apos;re not the host of this board</p>
        <p className="text-sm text-bone-dim">
          Join with the room code instead: <span className="text-safelight">{board.roomCode}</span>
        </p>
        {!user && (
          <p className="text-xs text-bone-faint">
            If you started this board while signed in, sign in on the home page to get it back.
          </p>
        )}
      </div>
    );
  }

  // Once archived, the Storage copies are gone and every downloadUrl on those
  // photo docs 404s - so the grid would render a wall of broken frames. The
  // album panel stands in for it.
  const photosLiveInStorage = !board.googlePhotosArchivedAt;
  // Three frames in, people have found the board and the QR has done its job.
  const rollUnderWay = photos.length >= 3;
  const showQr = !rollUnderWay || qrForced;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="border-b border-line pb-4">
        <div className="flex items-center justify-between gap-3">
          {/* Points wherever the host actually came from: their board list if
              they're signed in, the home page otherwise. */}
          <Link
            href={user ? "/boards" : "/"}
            className="text-xs text-bone-dim underline underline-offset-4 hover:text-bone"
          >
            ← {user ? "Your boards" : "Home"}
          </Link>
          <Wordmark size={18} />
        </div>
        <h1 className="mt-3 text-xl font-medium tracking-tight">{board.title}</h1>
      </div>

      {board.endedAt ? (
        <EndedPanel
          boardId={boardId}
          hostKey={hostKey}
          board={board}
          googlePhotosConnected={account?.googlePhotosConnected ?? false}
          endResult={endResult}
        />
      ) : (
        <div className="flex flex-col items-center gap-4 border border-line bg-surface p-6">
          {/* The QR earns its 240px for the first few minutes and is in the way
              for the rest of the night - on a phone you scroll past it, the
              code and the buttons before reaching a single photo. Once the roll
              is under way it folds down to a toggle, with the code itself still
              readable as text for anyone reading it out. */}
          {qrDataUrl &&
            (showQr ? (
              <div className="flex flex-col items-center gap-3">
                <div className="bg-bone p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR code to join" className="block" />
                </div>
                {rollUnderWay && (
                  <button
                    onClick={() => setQrForced(false)}
                    className="text-xs text-bone-faint underline underline-offset-4 hover:text-bone"
                  >
                    Hide QR
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={() => setQrForced(true)}
                className="text-xs text-bone-dim underline underline-offset-4 hover:text-bone"
              >
                Show QR to join
              </button>
            ))}
          {/* The room code as a length of film leader - the strip of exposed
              film at the head of a roll, which is where the stock and speed
              are printed. It's the one place in the app that gets the full
              sprocketed treatment, since it's the hero of the host screen. */}
          <div className="w-full max-w-xs bg-frame">
            <div className="sprocket-edge" />
            <div className="px-4 py-5 text-center">
              <p className="font-mono text-[11px] tracking-[0.16em] text-edge">RECAP 400</p>
              <p className="mt-2 text-4xl font-medium tracking-[0.3em] text-safelight">
                {board.roomCode}
              </p>
              <p className="mt-2 font-mono text-[11px] tracking-widest text-bone-faint">
                {photos.length === 0
                  ? "NO FRAMES YET"
                  : `${photos.length} FRAME${photos.length === 1 ? "" : "S"} SO FAR`}
              </p>
            </div>
            <div className="sprocket-edge" />
          </div>
          <p className="text-xs text-bone-faint">Scan, or go to /join/{board.roomCode}</p>

          {/* Connection is a property of the signed-in account now, not of
              this board - connect once and every board can archive. A host
              who isn't signed in has nowhere to hang the grant, so they're
              pointed at sign-in rather than shown a button that can't work. */}
          {account?.googlePhotosConnected ? (
            <p className="text-xs text-bone-dim">
              Google Photos connected — you can archive there when you develop the roll.
            </p>
          ) : user ? (
            <button
              onClick={handleConnectGooglePhotos}
              disabled={connecting}
              className="text-xs text-bone-dim underline underline-offset-4 hover:text-bone disabled:opacity-30"
            >
              {connecting ? "Connecting…" : "Connect Google Photos (optional)"}
            </button>
          ) : (
            <p className="text-xs text-bone-faint">Sign in to archive to Google Photos</p>
          )}

          <div className="flex w-full flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:justify-center">
            <a
              href={`/api/boards/${boardId}/export?hostKey=${hostKey}`}
              className={`${buttonSecondaryClass} text-center`}
            >
              Download all as zip
            </a>
          </div>
          {error && <p className="text-sm text-safelight">{error}</p>}
        </div>
      )}

      {/* Developing the roll ends the night and can permanently clear photos
          out of Storage. It used to sit beside "Download all as zip" at equal
          width and weight, which read as two interchangeable options. Its own
          row, away from the panel, makes the asymmetry visible. */}
      {!board.endedAt && (
        <div className="flex flex-col items-center gap-1">
          <button onClick={openEndDialog} disabled={ending} className={buttonDangerClass}>
            Develop the roll
          </button>
          <p className="text-[11px] text-bone-faint">Ends the night. Guests can&apos;t add more.</p>
        </div>
      )}

      {confirmingEnd && (
        <EndBoardDialog
          googlePhotosConnected={account?.googlePhotosConnected ?? false}
          archiveOnEnd={archiveOnEnd}
          onToggleArchive={setArchiveOnEnd}
          ending={ending}
          error={error}
          onCancel={() => setConfirmingEnd(false)}
          onConfirm={handleEnd}
        />
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

      {photosLiveInStorage && (
        <PhotoGallery photos={photos} guestId={guestId} guestName={guestName} boardId={boardId} hostKey={hostKey} />
      )}
    </div>
  );
}

// Replaces the old window.confirm(). A native confirm can't carry the archive
// opt-in, and archiving is the one irreversible thing this app does - it
// deserves a deliberate tick rather than being implied by having connected.
function EndBoardDialog({
  googlePhotosConnected,
  archiveOnEnd,
  onToggleArchive,
  ending,
  error,
  onCancel,
  onConfirm,
}: {
  googlePhotosConnected: boolean;
  archiveOnEnd: boolean;
  onToggleArchive: (value: boolean) => void;
  ending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  // Escape closes, matching what a native confirm would do.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !ending) onCancel();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ending, onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="end-board-title"
        className="w-full max-w-sm border border-line bg-surface p-6"
      >
        <h2 id="end-board-title" className="text-lg font-medium tracking-tight">
          Develop this roll?
        </h2>
        <p className="mt-2 text-sm text-bone-dim">Guests won&apos;t be able to add more frames.</p>

        {googlePhotosConnected && (
          <label className="mt-5 flex cursor-pointer gap-3 border border-line p-3">
            <input
              type="checkbox"
              checked={archiveOnEnd}
              onChange={(e) => onToggleArchive(e.target.checked)}
              disabled={ending}
              className="mt-0.5 h-4 w-4 shrink-0 accent-safelight"
            />
            <span className="text-sm">
              Also archive to Google Photos
              <span className="mt-1 block text-xs text-bone-faint">
                Uploads every photo to the album, then removes the copies from Recap. Leave this
                off while testing.
              </span>
            </span>
          </label>
        )}

        {error && <p className="mt-4 text-sm text-safelight">{error}</p>}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} disabled={ending} className={buttonSecondaryClass}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={ending} className={buttonDangerClass}>
            {ending ? "Developing…" : "Develop the roll"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Everything the host sees after the board is over: what the archive did, the
// album link, and the paste-back field that gives guests a link they can open.
function EndedPanel({
  boardId,
  hostKey,
  board,
  googlePhotosConnected,
  endResult,
}: {
  boardId: string;
  hostKey: string;
  board: { googlePhotosArchivedAt: number | null; googlePhotosShareUrl: string | null };
  googlePhotosConnected: boolean;
  endResult: EndResult | null;
}) {
  // The album URL lives in boardSecrets, which no client can read, so it has
  // to come back over the host-authenticated API. endResult already carries it
  // immediately after ending; this fetch covers a later page load.
  const [albumUrl, setAlbumUrl] = useState<string | null>(endResult?.albumUrl ?? null);
  const [shareDraft, setShareDraft] = useState("");
  const [savingShare, setSavingShare] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    if (albumUrl || !googlePhotosConnected) return;
    getJson<{ albumUrl: string | null }>(`/api/boards/${boardId}/google-photos`, hostKey)
      .then((data) => setAlbumUrl(data.albumUrl))
      .catch(() => setAlbumUrl(null));
  }, [albumUrl, googlePhotosConnected, boardId, hostKey]);

  async function saveShareUrl(value: string) {
    setSavingShare(true);
    setShareError(null);
    try {
      await postJson(`/api/boards/${boardId}/google-photos`, { shareUrl: value }, hostKey);
      setShareDraft("");
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Could not save that link.");
    } finally {
      setSavingShare(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 border border-line bg-surface p-6">
      <div>
        <p className={labelClass}>Roll developed</p>
        <p className="mt-1 text-sm text-bone-dim">
          {board.googlePhotosArchivedAt
            ? `${
                endResult ? `${endResult.archivedCount} frames` : "Every frame"
              } archived to Google Photos, and removed from Recap.`
            : "Every frame is still stored in Recap. Nothing was archived."}
        </p>
        {endResult?.archiveError && (
          <p className="mt-2 text-sm text-safelight">
            Archiving failed: {endResult.archiveError} — your photos are untouched.
          </p>
        )}
      </div>

      {albumUrl && (
        <div className="border-t border-line pt-5">
          <p className={labelClass}>Your album</p>
          <a
            href={albumUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block truncate text-sm text-safelight underline underline-offset-4"
          >
            {albumUrl}
          </a>
          <p className="mt-2 text-xs text-bone-faint">
            This one opens for you only — Google no longer lets apps share an album on your
            behalf.
          </p>
        </div>
      )}

      {googlePhotosConnected && (
        <div className="border-t border-line pt-5">
          <p className={labelClass}>Guest link</p>
          {board.googlePhotosShareUrl ? (
            <>
              <a
                href={board.googlePhotosShareUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block truncate text-sm text-safelight underline underline-offset-4"
              >
                {board.googlePhotosShareUrl}
              </a>
              <p className="mt-2 text-xs text-bone-faint">
                Guests see this when they open the board.
              </p>
              <button
                onClick={() => saveShareUrl("")}
                disabled={savingShare}
                className="mt-3 text-xs text-bone-dim underline underline-offset-4 hover:text-bone disabled:opacity-30"
              >
                Remove it
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-xs text-bone-faint">
                In Google Photos, open the album and tap Share → Create link, then paste it here so
                guests can see the night.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (shareDraft.trim()) saveShareUrl(shareDraft.trim());
                }}
                className="mt-3 flex flex-col gap-2 sm:flex-row"
              >
                <input
                  value={shareDraft}
                  onChange={(e) => setShareDraft(e.target.value)}
                  placeholder="https://photos.app.goo.gl/…"
                  className={inputClass}
                />
                <button
                  type="submit"
                  disabled={!shareDraft.trim() || savingShare}
                  className={buttonPrimaryClass}
                >
                  {savingShare ? "Saving…" : "Save"}
                </button>
              </form>
            </>
          )}
          {shareError && <p className="mt-2 text-sm text-safelight">{shareError}</p>}
        </div>
      )}
    </div>
  );
}
