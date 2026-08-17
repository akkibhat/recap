import Link from "next/link";

// Aperture mark - an outer lens ring in bone with the inner iris in
// safelight red. Drawn inline rather than as a file so it inherits sizing
// from wherever it's used.
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="var(--color-safelight)" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.5" fill="var(--color-safelight)" />
    </svg>
  );
}

// The wordmark sits in the header of every page except the home page, so it's
// a link home by convention - without it /host, /join and /admin were all dead
// ends with no way out except the browser's back button.
export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <Link
      href="/"
      aria-label="Recap home"
      className="flex items-center gap-2 text-bone transition-opacity hover:opacity-70"
    >
      <LogoMark size={size} />
      <span className="font-medium tracking-tight" style={{ fontSize: size * 0.85 }}>
        recap
      </span>
    </Link>
  );
}
