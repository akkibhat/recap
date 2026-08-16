// Shared class strings for the darkroom theme. Kept as constants rather
// than wrapper components so the markup stays plain HTML and each surface
// can still add its own layout classes.

export const inputClass =
  "w-full border border-line bg-surface px-3 py-3 text-sm text-bone placeholder:text-bone-faint " +
  "focus:border-safelight focus:outline-none";

// Primary action - solid safelight. One per screen.
export const buttonPrimaryClass =
  "border border-safelight bg-safelight px-4 py-3 text-sm font-medium text-ink " +
  "hover:bg-safelight-dim hover:border-safelight-dim disabled:opacity-30 " +
  "disabled:hover:bg-safelight disabled:hover:border-safelight";

// Secondary - outlined, no fill.
export const buttonSecondaryClass =
  "border border-line-bright px-4 py-2.5 text-sm text-bone hover:border-bone disabled:opacity-30";

// Destructive. Deliberately NOT red: red is the brand accent here, so a red
// button would read as decorative. Muted until hover, with a confirm behind it.
export const buttonDangerClass =
  "border border-line-bright px-4 py-2.5 text-sm text-bone-dim hover:border-bone hover:text-bone disabled:opacity-30";

export const panelClass = "border border-line bg-surface p-4";

export const labelClass = "text-xs uppercase tracking-widest text-bone-dim";
