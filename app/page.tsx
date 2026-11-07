"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { postJson } from "@/lib/api";
import { saveHostKey } from "@/lib/hostIdentity";
import { Wordmark } from "@/components/Logo";
import { HostSignIn } from "@/components/HostSignIn";
import { PhotoWord } from "@/components/PhotoWord";
import { buttonBrandClass } from "@/components/ui";
import credits from "@/public/home/credits.json";

type CreateBoardResponse = { boardId: string; roomCode: string; hostKey: string };

// Sample photos for the headline's photo-word and the strip along the foot.
// Free archival party photographs, credited in the footer; stand-ins for what
// a real board fills up with.
const WORD_PHOTOS = ["/home/silent-disco.jpg", "/home/dance-party.jpg", "/home/soiree.jpg", "/home/christmas-party-1960s.jpg"];
const STRIP_PHOTOS = [
  "/home/christmas-party-1960s.jpg",
  "/home/dance-party.jpg",
  "/home/soiree.jpg",
  "/home/dj-table.jpg",
  "/home/dance-floor.jpg",
  "/home/stage.jpg",
  "/home/silent-disco.jpg",
];

/** The front door: what Recap is, start a board, or join one with a code. */
export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Create a board, keep its host key in this browser, go to the host screen. */
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    // The button is never greyed out (a dim main action on a first screen
    // reads as broken); with no name yet, send the visitor to the field.
    if (!title.trim()) {
      document.getElementById("title")?.focus();
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await postJson<CreateBoardResponse>("/api/boards", { title });
      saveHostKey(res.boardId, res.hostKey);
      router.push(`/host/${res.boardId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setCreating(false);
    }
  }

  /** Join a board by its five-letter room code. */
  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    if (code) router.push(`/join/${code}`);
  }

  return (
    <div className="flex min-h-svh flex-1 flex-col bg-plum">
      <header className="flex h-[76px] items-center justify-between px-4 sm:px-8">
        <Wordmark size={22} />
        <HostSignIn variant="header" />
      </header>

      <main className="flex flex-1 flex-col px-4 sm:px-8">
        {/* Two lines at every width: 11vw keeps "a [photo] to the roll." on one
            line on a 390px phone, and the cap stops it outgrowing a wide screen. */}
        <h1 className="rise mt-[5vh] text-[clamp(38px,11vw,180px)] leading-[0.95] font-bold tracking-[-0.045em] sm:text-[clamp(52px,11.6vw,180px)]">
          Everyone adds
          <br />
          a <PhotoWord photos={WORD_PHOTOS} label="a photo" /> to the roll.
        </h1>

        <p style={{ animationDelay: "120ms" }} className="rise mt-8 max-w-[30ch] text-xl leading-snug sm:text-[22px]">
          One shared photo board for the night. Guests scan a code and add their photos from their phone. No app, no
          login.
        </p>

        <div style={{ animationDelay: "220ms" }} className="rise mt-10 flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center sm:gap-10">
          <form onSubmit={handleCreate} className="flex w-full max-w-[520px] flex-col gap-3 sm:flex-row sm:gap-0">
            <label htmlFor="title" className="sr-only">
              Name the night
            </label>
            <input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name the night, e.g. Mia's 30th"
              maxLength={60}
              className="h-[60px] w-full rounded-full bg-plum-raised px-6 text-lg text-bone placeholder:text-bone-faint outline-none focus-visible:ring-2 focus-visible:ring-safelight sm:rounded-r-none"
            />
            <button
              type="submit"
              disabled={creating}
              className={`${buttonBrandClass} h-[60px] shrink-0 text-lg sm:rounded-l-none`}
            >
              {creating ? "Starting…" : "Start a board"}
            </button>
          </form>

          {showJoin ? (
            <form onSubmit={handleJoin} className="flex items-center gap-3">
              <label htmlFor="roomCode" className="text-lg text-bone-dim">
                Code
              </label>
              <input
                id="roomCode"
                autoFocus
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value)}
                placeholder="ABCDE"
                maxLength={5}
                autoCapitalize="characters"
                className="tabular h-[52px] w-[150px] rounded-full bg-plum-raised px-5 text-lg tracking-[0.2em] text-bone uppercase placeholder:text-bone-faint outline-none focus-visible:ring-2 focus-visible:ring-safelight"
              />
              <button
                type="submit"
                disabled={!roomCodeInput.trim()}
                className="press h-[52px] rounded-full bg-bone px-5 text-lg font-semibold text-plum disabled:opacity-30"
              >
                Join
              </button>
            </form>
          ) : (
            <p className="text-lg text-bone-dim">
              Got a code from the host?{" "}
              <button
                type="button"
                onClick={() => setShowJoin(true)}
                className="press font-medium text-bone underline decoration-safelight decoration-2 underline-offset-[6px] hover:decoration-bone"
              >
                Join a board
              </button>
            </p>
          )}
        </div>
        {error && <p className="mt-4 text-base text-safelight">{error}</p>}

        {/* The night as it fills up: a strip of sample frames running off both edges. */}
        {/* The list runs twice so the strip always overflows the right edge
            at every width, and each frame rises in after the one before. */}
        <div className="mt-auto flex gap-2.5 overflow-hidden rounded-[10px] pt-14" aria-hidden="true">
          {[...STRIP_PHOTOS, ...STRIP_PHOTOS].map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- static sample strip
            <img
              key={`${src}-${i}`}
              src={src}
              alt=""
              className="rise h-[120px] w-[180px] flex-none object-cover sm:h-[150px] sm:w-[220px]"
              style={{ animationDelay: `${360 + Math.min(i, 9) * 70}ms` }}
            />
          ))}
        </div>
      </main>

      {/* Credits for the sample photos: required, but small print rather than
          part of the page's argument, so they're only rendered once asked for. */}
      <footer className="px-4 py-5 sm:px-8">
        <button
          type="button"
          onClick={() => setShowCredits((v) => !v)}
          aria-expanded={showCredits}
          className="press text-sm text-bone-faint hover:text-bone-dim"
        >
          {showCredits ? "Hide photo credits" : "Sample photo credits"}
        </button>
        {showCredits && (
          <p className="mt-2 max-w-[80ch] text-sm leading-relaxed text-bone-dim">
            {credits.map((c, i) => (
              <span key={c.src}>
                <a href={c.page} className="underline-offset-2 hover:text-bone hover:underline">
                  {c.credit.replace(/, via Wikimedia Commons$/, "")}
                </a>
                {i < credits.length - 1 ? "; " : ". Via Wikimedia Commons."}
              </span>
            ))}
          </p>
        )}
      </footer>
    </div>
  );
}
