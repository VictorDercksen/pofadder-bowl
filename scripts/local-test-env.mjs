import { readFileSync } from "node:fs";

// Prints only to the CI environment file, never a log. The status is from the disposable local stack.
const status = JSON.parse(readFileSync(process.argv[2], "utf8"));
if (!['127.0.0.1', 'localhost'].includes(new URL(status.API_URL).hostname)) throw new Error("A local Supabase URL is required");
for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
  SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SUPABASE_RESUMABLE_URL: `${status.API_URL}/storage/v1/upload/resumable`,
  NEXT_PUBLIC_APP_ORIGIN: "http://localhost:3001",
  NEXT_PUBLIC_MAP_TILE_URL: "static",
  MAP_ROUTING_URL: "none",
})) {
  if (!value || /[\r\n]/.test(value)) throw new Error(`Invalid local setting: ${name}`);
  process.stdout.write(`${name}=${value}\n`);
}
