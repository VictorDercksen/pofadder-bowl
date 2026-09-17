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

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  resumableUploadUrl: process.env.NEXT_PUBLIC_SUPABASE_RESUMABLE_URL ?? "",
  appOrigin: process.env.NEXT_PUBLIC_APP_ORIGIN ?? "http://localhost:3000",
  leagueSlug: process.env.NEXT_PUBLIC_LEAGUE_SLUG ?? "show-us-your-tds",
  eventSlug: process.env.NEXT_PUBLIC_EVENT_SLUG ?? "pofadder-bowl-2026",
  mapTileUrl: resolveTileUrl(process.env.NEXT_PUBLIC_MAP_TILE_URL),
  mapTileAttribution: process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || DEFAULT_MAP_TILE_ATTRIBUTION,
  demoOnly: process.env.NEXT_PUBLIC_DEMO_ONLY === "true",
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
  return process.env.SLEEPER_LEAGUE_ID ?? "";
}
