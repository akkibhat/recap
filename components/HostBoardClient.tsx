"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { useBoardById } from "@/lib/hooks/useBoard";
import { usePhotos } from "@/lib/hooks/usePhotos";
import { getHostKey, saveHostKey } from "@/lib/hostIdentity";
import { useAuth } from "@/lib/hooks/useAuth";
import { useUserAccount } from "@/lib/hooks/useUserAccount";
import { useDeletedPhotos } from "@/lib/hooks/useDeletedPhotos";
import { galleryUrl, Photo } from "@/lib/types/photo";
import { getOrCreateGuestId, getGuestName, setGuestName } from "@/lib/guestIdentity";
import { postJson, getJson } from "@/lib/api";
import { PhotoGallery } from "@/components/PhotoGallery";
import { PhotoUploadForm } from "@/components/PhotoUploadForm";
import { LogoMark } from "@/components/Logo";
import { BoardHeader, BoardSubline } from "@/components/JoinBoardClient";
import {
  inputClass,
  buttonPrimaryClass,
  buttonDangerClass,
  labelClass,
} from "@/components/ui";

// Type-only import: erased at build, so no server code reaches the browser.
import type { DeletedDecision, ReviewOutcome } from "@/lib/deletedAlbum";

// A pill that sits inside a #111 panel, so it takes the next lightness step
// (#2a2a2a) rather than the page-level secondary pill, which would vanish.
const nestedPillClass =
  "press rounded-full bg-surface-raised px-4 py-2 text-[15px] text-bone hover:bg-line-bright disabled:opacity-30 outline-none focus-visible:ring-2 focus-visible:ring-safelight";

type EndResult = {
  archiveError: string | null;
  archivedCount: number;
  skippedCount: number;
  albumUrl: string | null;
  reviewError: string | null;
  review: ReviewOutcome;
};

// The host's screen for one board: the room code and QR for guests to join,
// export and Google Photos, the end-of-night flow, their own upload form and
// the photo wall with moderation turned on.
export function HostBoardClient({ boardId }: { boardId: string }) {
  const { data: board, loading } = useBoardById(boardId);
  const { data: photos } = usePhotos(boardId);
  const { user, loading: authLoading } = useAuth();
  const { data: account } = useUserAccount(user?.uid ?? null);
  const { data: deletedPhotos } = useDeletedPhotos(boardId);
  const [decisions, setDecisions] = useState<Record<string, DeletedDecision>>({});
  // hostKey, guestId and guestName read localStorage, which doesn't exist
  // during SSR - so they're resolved at render time (null on the server, the
  // real value on the client's first render) rather than set by an effect.
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

  // Draws the join QR whenever the board (and so its room code) is known.
  useEffect(() => {
    if (!board) return;
    const joinUrl = `${window.location.origin}/join/${board.roomCode}`;
    // Deliberately standard polarity (dark modules on a light background).
    // Inverted QR codes read fine on most modern phones but fail on some
    // scanners, and a guest who can't scan can't join - not worth the risk
    // for a nicer-looking code. It sits on a white tile below, which gives it
    // the quiet zone scanners need on a black page.
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

  // Ends the board, with the archive choice and the removed-photo decisions.
  async function handleEnd() {
    if (!hostKey) return;
    setEnding(true);
    setError(null);
    try {
      const result = await postJson<EndResult>(
        `/api/boards/${boardId}/end`,
        { archiveToGooglePhotos: archiveOnEnd, deletedDecisions: decisions },
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

  // Sends the host off to Google to grant Photos access to their account.
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
      <div className="flex flex-1 items-center justify-center text-[15px] text-bone-dim">
        Loading the roll…
      </div>
    );
  }

  if (!board) {
    return <div className="flex flex-1 items-center justify-center text-[15px] text-bone-dim">Board not found.</div>;
  }

  if (!hostKey) {
    // Recovery is possible, and hasn't failed yet, so a key may still arrive.
    const recovering = Boolean(user && board.ownerUid === user.uid) && !recoveryFailed;

    // Still resolving: auth hasn't restored yet, or recovery is in flight.
    if (authLoading || recovering) {
      return (
        <div className="flex flex-1 items-center justify-center text-[15px] text-bone-dim">
          Finding your roll…
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
        <span className="text-bone-faint">
          <LogoMark size={32} />
        </span>
        <p className="text-[22px] font-bold tracking-tight">You&apos;re not the host of this board</p>
        <p className="text-[15px] text-bone-dim">
          Join with the room code instead: <span className="tabular font-medium text-safelight">{board.roomCode}</span>
        </p>
        {!user && (
          <p className="max-w-xs text-sm text-bone-faint">
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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pt-3 pb-10">
      <div>
        <BoardHeader roomCode={board.roomCode} />
        {/* Points wherever the host actually came from: their board list if
            they're signed in, the home page otherwise. */}
        <Link
          href={user ? "/boards" : "/"}
          className="mt-2 inline-block text-[15px] text-bone-dim hover:text-bone"
        >
          ← {user ? "Your boards" : "Home"}
        </Link>
        <h1 className="mt-2 text-[28px] leading-tight font-bold tracking-tight">{board.title}</h1>
        <BoardSubline photos={photos} live={!board.endedAt} />
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
        <div className="flex flex-col items-center gap-4 rounded-2xl bg-surface p-6 text-center">
          {/* The QR earns its 240px for the first few minutes and is in the way
              for the rest of the night - on a phone you scroll past it, the
              code and the buttons before reaching a single photo. Once the roll
              is under way it folds down to a toggle, with the code itself still
              readable as text for anyone reading it out. */}
          {qrDataUrl &&
            (showQr ? (
              <div className="flex flex-col items-center gap-3">
                <div className="rounded-2xl bg-bone p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt="QR code to join" className="block" />
                </div>
                {rollUnderWay && (
                  <button onClick={() => setQrForced(false)} className={nestedPillClass}>
                    Hide QR
                  </button>
                )}
              </div>
            ) : (
              <button onClick={() => setQrForced(true)} className={nestedPillClass}>
                Show QR to join
              </button>
            ))}
          {/* The room code is the hero of the host screen: large, white and
              evenly spaced, so it can be read across a room. */}
          <div className="flex flex-col items-center gap-2">
            <p className="tabular text-[56px] leading-none font-bold tracking-[0.04em] text-bone">
              {board.roomCode}
            </p>
            <p className="text-[15px] text-bone-dim">Scan, or go to /join/{board.roomCode}</p>
            <p className="tabular text-[15px] text-bone-dim">
              {photos.length === 0
                ? "No photos yet"
                : `${photos.length} photo${photos.length === 1 ? "" : "s"} so far`}
            </p>
          </div>

          {/* Connection belongs to the signed-in account, not this board. A
              host who isn't signed in on this device has nowhere to hang the
              grant, so they're pointed at sign-in instead. */}
          {account?.googlePhotosConnected ? (
            <p className="text-sm text-bone-dim">
              Google Photos connected — you can archive there when you develop the roll.
            </p>
          ) : user ? (
            <button
              onClick={handleConnectGooglePhotos}
              disabled={connecting}
              className={nestedPillClass}
            >
              {connecting ? "Connecting…" : "Connect Google Photos (optional)"}
            </button>
          ) : (
            <p className="text-sm text-bone-faint">Sign in to archive to Google Photos</p>
          )}

          <div className="flex w-full flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
            <a
              href={`/api/boards/${boardId}/export?hostKey=${hostKey}`}
              className={`${nestedPillClass} px-5! py-3! text-center`}
            >
              Download all as zip
            </a>
          </div>
          {error && <p className="text-[15px] text-safelight">{error}</p>}
        </div>
      )}

      {/* Developing the roll ends the night and can permanently clear photos
          out of Storage, so it sits on its own row away from "Download all as
          zip" rather than reading as an equal option beside it. */}
      {!board.endedAt && (
        <div className="flex flex-col items-center gap-1">
          <button onClick={openEndDialog} disabled={ending} className={buttonDangerClass}>
            Develop the roll
          </button>
          <p className="text-[13px] text-bone-faint">Ends the night. Guests can&apos;t add more.</p>
        </div>
      )}

      {confirmingEnd && (
        <EndBoardDialog
          deletedPhotos={deletedPhotos}
          decisions={decisions}
          onDecide={(photoId, decision) =>
            setDecisions((current) => ({ ...current, [photoId]: decision }))
          }
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
          <div className="w-full max-w-xl">
            <PhotoUploadForm boardId={boardId} guestId={guestId} guestName={guestName} />
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!nameDraft.trim()) return;
              setGuestName(nameDraft.trim());
              setGuestNameState(nameDraft.trim());
            }}
            className="flex w-full max-w-xl gap-2"
          >
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Your name, to add your own photos"
              maxLength={40}
              className={inputClass}
            />
            <button type="submit" disabled={!nameDraft.trim()} className={`${buttonPrimaryClass} shrink-0`}>
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

// The "develop this roll?" confirm. A custom dialog rather than
// window.confirm() because it carries the archive opt-in and the review of
// removed photos; archiving is irreversible, so it needs a deliberate tick.
function EndBoardDialog({
  deletedPhotos,
  decisions,
  onDecide,
  googlePhotosConnected,
  archiveOnEnd,
  onToggleArchive,
  ending,
  error,
  onCancel,
  onConfirm,
}: {
  deletedPhotos: Photo[];
  decisions: Record<string, DeletedDecision>;
  onDecide: (photoId: string, decision: DeletedDecision) => void;
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
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-surface p-6"
      >
        <h2 id="end-board-title" className="text-[22px] font-bold tracking-tight">
          Develop this roll?
        </h2>
        <p className="mt-2 text-[15px] text-bone-dim">Guests won&apos;t be able to add more photos.</p>

        {googlePhotosConnected && (
          <label className="mt-5 flex cursor-pointer gap-3 rounded-2xl bg-surface-raised p-4">
            <input
              type="checkbox"
              checked={archiveOnEnd}
              onChange={(e) => onToggleArchive(e.target.checked)}
              disabled={ending}
              className="mt-0.5 h-4 w-4 shrink-0 accent-safelight"
            />
            <span className="text-[15px]">
              Also archive to Google Photos
              <span className="mt-1 block text-sm text-bone-dim">
                Uploads every photo to the album, then removes the copies from Recap. Leave this
                off while testing.
              </span>
            </span>
          </label>
        )}

        {deletedPhotos.length > 0 && (
          <DeletedReview
            photos={deletedPhotos}
            decisions={decisions}
            onDecide={onDecide}
            googlePhotosConnected={googlePhotosConnected}
          />
        )}

        {error && <p className="mt-4 text-[15px] text-safelight">{error}</p>}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button onClick={onCancel} disabled={ending} className={nestedPillClass}>
            Cancel
          </button>
          <button onClick={onConfirm} disabled={ending} className={buttonPrimaryClass}>
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

  // Fetches the album link on a later visit, when endResult isn't there.
  useEffect(() => {
    if (albumUrl || !googlePhotosConnected) return;
    getJson<{ albumUrl: string | null }>(`/api/boards/${boardId}/google-photos`, hostKey)
      .then((data) => setAlbumUrl(data.albumUrl))
      .catch(() => setAlbumUrl(null));
  }, [albumUrl, googlePhotosConnected, boardId, hostKey]);

  // Saves (or, with an empty string, clears) the guest-facing album link.
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
    <div className="flex flex-col gap-7 rounded-2xl bg-surface p-6">
      <div>
        <p className={labelClass}>Roll developed</p>
        <p className="mt-1 text-[15px] text-bone">
          {board.googlePhotosArchivedAt
            ? `${
                endResult ? `${endResult.archivedCount} photos` : "Every photo"
              } archived to Google Photos, and removed from Recap.`
            : "Every photo is still stored in Recap. Nothing was archived."}
        </p>
        {endResult?.archiveError && (
          <p className="mt-2 text-[15px] text-safelight">
            Archiving failed: {endResult.archiveError} — your photos are untouched.
          </p>
        )}
      </div>

      {albumUrl && (
        <div>
          <p className={labelClass}>Your album</p>
          <a
            href={albumUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 block truncate text-[15px] text-bone underline underline-offset-4 hover:text-bone-dim"
          >
            {albumUrl}
          </a>
          <p className="mt-2 text-sm text-bone-faint">
            This one opens for you only — Google no longer lets apps share an album on your
            behalf.
          </p>
        </div>
      )}

      {googlePhotosConnected && (
        <div>
          <p className={labelClass}>Guest link</p>
          {board.googlePhotosShareUrl ? (
            <>
              <a
                href={board.googlePhotosShareUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 block truncate text-[15px] text-bone underline underline-offset-4 hover:text-bone-dim"
              >
                {board.googlePhotosShareUrl}
              </a>
              <p className="mt-2 text-sm text-bone-faint">
                Guests see this when they open the board.
              </p>
              <button
                onClick={() => saveShareUrl("")}
                disabled={savingShare}
                className={`${nestedPillClass} mt-3`}
              >
                Remove it
              </button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-bone-faint">
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
                  className={`${inputClass} bg-surface-raised!`}
                />
                <button
                  type="submit"
                  disabled={!shareDraft.trim() || savingShare}
                  className={`${buttonPrimaryClass} shrink-0`}
                >
                  {savingShare ? "Saving…" : "Save"}
                </button>
              </form>
            </>
          )}
          {shareError && <p className="mt-2 text-[15px] text-safelight">{shareError}</p>}
        </div>
      )}
    </div>
  );
}

// What happens to photos removed during the night. Keep is the default for
// anything untouched and purging always needs a deliberate tap (see
// DEFAULT_DECISION in lib/deletedAlbum.ts for why).
function DeletedReview({
  photos,
  decisions,
  onDecide,
  googlePhotosConnected,
}: {
  photos: Photo[];
  decisions: Record<string, DeletedDecision>;
  onDecide: (photoId: string, decision: DeletedDecision) => void;
  googlePhotosConnected: boolean;
}) {
  const options: { value: DeletedDecision; label: string }[] = [
    { value: "keep", label: "Keep" },
    { value: "restore", label: "Put back" },
    { value: "purge", label: "Delete" },
  ];

  return (
    <div className="mt-6">
      <p className={labelClass}>
        {photos.length} photo{photos.length === 1 ? "" : "s"} removed during the night
      </p>
      <p className="mt-1 text-sm text-bone-faint">
        {googlePhotosConnected
          ? "Kept photos go to your Recap - Deleted Photos album. Nothing is deleted unless you say so."
          : "Kept photos stay in Recap. Nothing is deleted unless you say so."}
      </p>

      <ul className="mt-3 flex flex-col gap-3">
        {photos.map((photo) => {
          const chosen = decisions[photo.id] ?? "keep";
          return (
            <li key={photo.id} className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={galleryUrl(photo)}
                alt={photo.caption || "Removed photo"}
                className="size-14 shrink-0 rounded-[10px] object-cover"
              />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="truncate text-[13px] text-bone-dim">
                  {photo.contributorName}
                  {photo.deletedBy === "host" ? " · you removed it" : " · they removed it"}
                </span>
                <div className="flex gap-1">
                  {options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => onDecide(photo.id, option.value)}
                      className={`press rounded-full px-3 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-safelight ${
                        chosen === option.value
                          ? "bg-bone font-medium text-ink"
                          : "bg-surface-raised text-bone-dim hover:text-bone"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
