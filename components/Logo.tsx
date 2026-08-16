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

export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2 text-bone">
      <LogoMark size={size} />
      <span className="font-medium tracking-tight" style={{ fontSize: size * 0.85 }}>
        recap
      </span>
    </div>
  );
}
