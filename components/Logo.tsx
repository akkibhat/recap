import Link from "next/link";

// The mark is the wordmark itself: "recap" in General Sans bold, with a pink
// dot after it. The dot is the one bit of brand colour in the header, and it
// reads as the "record" light on a camera.

// The dot alone, for screens that want a small brand mark without the word.
export function LogoMark({ size = 24 }: { size?: number }) {
  const d = Math.round(size * 0.42);
  return (
    <span
      aria-hidden="true"
      className="inline-block rounded-full bg-safelight"
      style={{ width: d, height: d }}
    />
  );
}

// The full wordmark. A link home, because it sits in the header of every page
// except the home page - without it /host, /join and /admin were dead ends.
export function Wordmark({ size = 24, href = "/" }: { size?: number; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="Recap home"
      className="inline-flex items-baseline font-bold tracking-tight text-bone transition-opacity hover:opacity-70"
      style={{ fontSize: size, letterSpacing: "-0.02em" }}
    >
      recap
      <span
        aria-hidden="true"
        className="ml-[0.08em] inline-block rounded-full bg-safelight"
        style={{ width: size * 0.42, height: size * 0.42 }}
      />
    </Link>
  );
}
