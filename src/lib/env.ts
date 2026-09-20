/**
 * Environment access. Browser-safe values use the NEXT_PUBLIC_ prefix; everything
 * else must only be read from server code.
 */

/**
 * Public OpenStreetMap tiles: fine for a private league of a dozen people (see
 * https://operations.osmfoundation.org/policies/tiles/). Override with a keyed provider
 * for anything busier, or set NEXT_PUBLIC_MAP_TILE_URL=static to show the labelled
 * regional preview without a live map.
 */
export const DEFAULT_MAP_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const DEFAULT_MAP_TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Empty string means "no live tiles" (static fallback). */
export function resolveTileUrl(configured: string | undefined): string {
  const value = (configured ?? "").trim();
  if (value.toLowerCase() === "static" || value.toLowerCase() === "none") return "";
  return value || DEFAULT_MAP_TILE_URL;
}

/** Trimmed so a stray `\r` or space in an env file cannot corrupt a slug or URL (it has happened). */
function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

// process.env.NEXT_PUBLIC_* must stay as literal property reads so Next.js can inline them for the browser.
export const publicEnv = {
  supabaseUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  resumableUploadUrl: clean(process.env.NEXT_PUBLIC_SUPABASE_RESUMABLE_URL),
  appOrigin: clean(process.env.NEXT_PUBLIC_APP_ORIGIN) || "http://localhost:3000",
  leagueSlug: clean(process.env.NEXT_PUBLIC_LEAGUE_SLUG) || "show-us-your-tds",
  eventSlug: clean(process.env.NEXT_PUBLIC_EVENT_SLUG) || "pofadder-bowl-2026",
  mapTileUrl: resolveTileUrl(process.env.NEXT_PUBLIC_MAP_TILE_URL),
  mapTileAttribution: clean(process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION) || DEFAULT_MAP_TILE_ATTRIBUTION,
  demoOnly: clean(process.env.NEXT_PUBLIC_DEMO_ONLY) === "true",
};

/** True when the browser-side Supabase configuration is present. */
export function isBackendConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabasePublishableKey);
}

/** Resumable upload endpoint (TUS). Derived from the project URL unless overridden. */
export function resumableEndpoint(): string {
  if (publicEnv.resumableUploadUrl) return publicEnv.resumableUploadUrl;
  return `${publicEnv.supabaseUrl.replace(/\/$/, "")}/storage/v1/upload/resumable`;
}

/** Server-only secret. Throws if read in the browser or when missing. */
export function serverSecretKey(): string {
  if (typeof window !== "undefined") throw new Error("serverSecretKey() called in the browser");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("SUPABASE_SECRET_KEY is not configured");
  return key;
}

export function sleeperLeagueId(): string {
  return clean(process.env.SLEEPER_LEAGUE_ID);
}

/**
 * Public OSRM demo router: no key, car profile, fine for a private league's handful of
 * legs (each leg is cached server-side once routed). Override with a self-hosted OSRM
 * or set MAP_ROUTING_URL=none to draw straight lines between check-ins.
 */
export const DEFAULT_MAP_ROUTING_URL = "https://router.project-osrm.org";

/** Empty string means "no road routing" (straight lines). Server only. */
export function resolveRoutingUrl(configured: string | undefined): string {
  const value = clean(configured);
  if (value.toLowerCase() === "none" || value.toLowerCase() === "static" || value.toLowerCase() === "off") return "";
  return value || DEFAULT_MAP_ROUTING_URL;
}

export function mapRoutingUrl(): string {
  if (typeof window !== "undefined") throw new Error("mapRoutingUrl() called in the browser");
  return resolveRoutingUrl(process.env.MAP_ROUTING_URL);
}
