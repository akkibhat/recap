// Shared class strings for the true-black theme. Kept as constants rather
// than wrapper components so the markup stays plain HTML and each surface
// can still add its own layout classes.
//
// One shape for every button: the full pill. Surfaces are flat fills, told
// apart by lightness; no borders, no shadows.

// Text fields: a flat #111 well. A field may carry a line, but this one
// doesn't need it; focus shows as a pink ring.
export const inputClass =
  "w-full rounded-2xl bg-surface px-4 py-3.5 text-base text-bone placeholder:text-bone-faint " +
  "outline-none focus-visible:ring-2 focus-visible:ring-safelight";

// Primary action - inverted: a white pill with black text. One per screen.
export const buttonPrimaryClass =
  "press rounded-full bg-bone px-6 py-3.5 text-base font-semibold text-ink " +
  "hover:bg-bone-dim disabled:opacity-30 disabled:hover:bg-bone " +
  "outline-none focus-visible:ring-2 focus-visible:ring-safelight focus-visible:ring-offset-2 focus-visible:ring-offset-ink";

// The home page's action, in the brand pink (the page, not the app).
export const buttonBrandClass =
  "press rounded-full bg-safelight px-7 py-3.5 text-base font-semibold text-plum " +
  "hover:bg-safelight-dim disabled:opacity-40 disabled:hover:bg-safelight " +
  "outline-none focus-visible:ring-2 focus-visible:ring-bone focus-visible:ring-offset-2 focus-visible:ring-offset-plum";

// Secondary - a #111 pill, no outline.
export const buttonSecondaryClass =
  "press rounded-full bg-surface px-5 py-3 text-base text-bone hover:bg-surface-raised disabled:opacity-30 " +
  "outline-none focus-visible:ring-2 focus-visible:ring-safelight";

// Destructive. Deliberately not pink: pink is the brand, so it would read as
// decoration. Neutral until hover, with a confirm behind it.
export const buttonDangerClass =
  "press rounded-full bg-surface px-5 py-3 text-base text-bone-dim hover:bg-surface-raised hover:text-bone disabled:opacity-30 " +
  "outline-none focus-visible:ring-2 focus-visible:ring-safelight";

// A panel is one lightness step up from the page.
export const panelClass = "rounded-2xl bg-surface p-5";

// Section labels: sentence case at a readable size, never tiny capitals.
export const labelClass = "text-sm font-medium text-bone-dim";
