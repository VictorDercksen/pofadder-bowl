# Asset sources and notes

## Bowl artwork

`assets/brand/pofadder-bowl-2026-teaser.png` is the original generated 1254 × 1254 PNG created for this project. The title, date and football/desert/bus crest are a single flattened image. It is supplied unchanged, including its texture. The corresponding HTML embeds the same image. The small PB shield in the mockup is CSS/text, not an omitted external image.

## NFL marks

All 32 original team PNGs were downloaded from ESPN's image CDN using `https://a.espncdn.com/i/teamlogos/nfl/500/{code}.png`. Each exact source is listed in `assets/nfl/teams.json`. The NFL shield source is `https://a.espncdn.com/i/teamlogos/leagues/500/nfl.png`.

NFL/team names, logos and marks belong to their respective owners. This asset bundle does not convey rights to those marks. They are design references for the user's unofficial fantasy-league experience. No NFL sponsorship is asserted.

The jersey silhouettes, sleeve stripes, captain patches, number/name placement, colours and message layout are HTML/CSS components in `design/jersey-cards.css` and `design/jersey-feed.js`. These helpers depend on the enclosing source's `kitAssets`, `kitNames`, state and escape helpers; refactor into React components rather than importing them as a complete application. The complete working reference is `design/game-centre-nfl.fragment.html`.

## Fonts

Barlow and Barlow Condensed were retrieved via Google Fonts:

https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;700;900&family=Barlow:wght@400;600&display=swap

`assets/fonts/fonts.css` maps font-family/weight to extracted local files. File extensions are based on font-byte signatures rather than assuming all Google responses use WOFF2. Keep the family/weight mapping from the CSS. Original embedded CSS is retained as an exact reference. Included OFL files, if present, are from Google Fonts' `ofl/barlow/OFL.txt` and `ofl/barlowcondensed/OFL.txt` directories:

- https://github.com/google/fonts/tree/main/ofl/barlow
- https://github.com/google/fonts/tree/main/ofl/barlowcondensed

The latest mockup also requests Barlow weights 500 and 700 through Google Fonts. The extracted font set originates from the itinerary request above and may not contain those two body weights. Use supplied 400/600 where appropriate or obtain missing supported weights through a current Next.js font workflow; do not pretend additional weights were supplied.

## Maps

`assets/maps/pofadder-region-preview.webp` is a static preview assembled from six OpenStreetMap raster tiles at zoom 6, x 34–36, y 37–38, then cropped to the western part of South Africa. Source pattern: `https://tile.openstreetmap.org/6/{x}/{y}.png`. It is for design continuity, not navigation or offline tile distribution.

Keep attribution visible: © OpenStreetMap contributors, https://www.openstreetmap.org/copyright

Production maps need a properly configured provider and its usage terms. Do not bulk-download map tiles or imply the preview is a live map. Earlier failed CARTO previews are deliberately excluded.

Town-coordinate references used for the mockup pins:

- Pofadder: https://en.wikipedia.org/wiki/Pofadder,_South_Africa
- Malmesbury coordinate lookup: https://latitudelongitude.org/

Pins are approximate town centres; they are not KLK Garage, the hotel or Victor's GPS location. Runtime coordinates must come from the consented participant device.

## Implementation documentation

Checked when preparing the handoff, 16 September 2026:

- Next.js on Vercel: https://vercel.com/docs/frameworks/full-stack/nextjs
- Supabase server-side auth for Next.js: https://supabase.com/docs/guides/auth/server-side/nextjs
- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Browser geolocation: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API

Consult current official documentation during implementation; the package does not pin an untested framework version.
