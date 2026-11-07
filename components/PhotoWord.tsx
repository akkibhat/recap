"use client";

import { useEffect, useState } from "react";

/**
 * A photograph set inside a headline where a word would be. Cross-fades
 * through `photos` every `intervalMs`, so the "word" keeps changing the way a
 * board fills up during a night. With reduced motion it stays on the first
 * photo. Styling lives in globals.css (.photo-word).
 */
export function PhotoWord({ photos, intervalMs = 2600, label }: { photos: string[]; intervalMs?: number; label: string }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    // Respect reduced motion: no cycling at all.
    if (photos.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), intervalMs);
    return () => window.clearInterval(id);
  }, [photos.length, intervalMs]);

  return (
    <span className="photo-word" role="img" aria-label={label}>
      {photos.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- tiny decorative crops, no optimisation needed
        <img key={src} src={src} alt="" data-on={i === index ? "true" : "false"} loading={i === 0 ? "eager" : "lazy"} />
      ))}
    </span>
  );
}
