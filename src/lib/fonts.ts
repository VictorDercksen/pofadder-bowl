import localFont from "next/font/local";

/** Supplied Barlow faces: 400 and 600 only (see docs/handoff/ASSET_SOURCES.md). */
export const barlow = localFont({
  src: [
    { path: "../fonts/barlow-face-01.ttf", weight: "400", style: "normal" },
    { path: "../fonts/barlow-face-02.ttf", weight: "600", style: "normal" },
  ],
  variable: "--font-barlow",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

/** Supplied Barlow Condensed faces: 500, 700 and 900. */
export const barlowCondensed = localFont({
  src: [
    { path: "../fonts/barlow-face-03.ttf", weight: "500", style: "normal" },
    { path: "../fonts/barlow-face-04.ttf", weight: "700", style: "normal" },
    { path: "../fonts/barlow-face-05.ttf", weight: "900", style: "normal" },
  ],
  variable: "--font-barlow-condensed",
  display: "swap",
  fallback: ["Impact", "Arial Narrow", "sans-serif"],
});
