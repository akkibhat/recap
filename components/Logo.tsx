import Link from "next/link";

// A 35mm cassette with the film pulled out to the left: sprocket holes down
// the strip, one frame window, spindle above, caps top and bottom.
//
// Two things about how this is drawn are load-bearing:
//
// - The sprocket holes, the frame window and the label slot are real holes,
//   punched with fill-rule="evenodd" rather than filled with the background
//   colour. That's what lets the mark sit on ink, on bone, or on a browser's
//   tab strip without needing a separate file per background.
// - Everything is currentColor. In the app the mark is monochrome on purpose:
//   safelight red already means "interactive or important" here (room codes,
//   active reactions, errors), and a red logo in the header would make the
//   room code stop being the only red thing on screen. The accented variant
//   lives in app/icon.svg, where there's no competing red and being findable
//   in a strip of tabs is worth more.
const CASSETTE_PATHS = {
  strip:
    "M40 64h82v164H40V64Zm12 12v24h24V76H52Zm0 40v24h24v-24H52Zm0 40v24h24v-24H52Zm0 40v24h24v-24H52Zm34-98v96h30V98H86Z",
  spindle: "M150 38h40v18h-40z",
  caps: "M108 52h132v26H108zM108 214h132v26H108z",
  body: "M116 78h116v136H116V78Zm24 118v11h68v-11h-68Z",
};

export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
      <path fillRule="evenodd" d={CASSETTE_PATHS.strip} />
      <path d={CASSETTE_PATHS.spindle} />
      <path d={CASSETTE_PATHS.caps} />
      <path fillRule="evenodd" d={CASSETTE_PATHS.body} />
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
