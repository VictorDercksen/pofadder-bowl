import "server-only";
import type { LeagueContext } from "@/lib/league";
import type { Tables } from "@/lib/database.types";
import { isTrackFile, parseTrack, type Track } from "@/lib/gpx";

const BUCKET = "evidence";
/** Bigger than any watch export for 14 km; keeps a stray upload from tying up a function. */
const MAX_TRACK_BYTES = 20 * 1024 * 1024;
const CACHE_LIMIT = 8;

export type TrackFile = Pick<Tables<"evidence_files">, "id" | "kind" | "mime_type" | "original_name" | "storage_path" | "byte_size">;

export type RunTrack = Track & { fileId: string; fileName: string };

/** Parsed traces by file id, kept while the function instance is warm (a file never changes once attached). */
const parsed = new Map<string, RunTrack | null>();

/** The first GPX/TCX file on a submission, or null. */
export function trackFileOf(files: readonly TrackFile[]): TrackFile | null {
  return files.find((f) => f.kind === "gps" && isTrackFile(f.original_name, f.mime_type)) ?? null;
}

/**
 * Downloads the watch export through the caller's own client (RLS decides who may read
 * it) and parses it into a line plus stats. Null when there is no readable trace.
 */
export async function loadRunTrack(ctx: LeagueContext, files: readonly TrackFile[]): Promise<RunTrack | null> {
  const file = trackFileOf(files);
  if (!file) return null;
  if (file.byte_size > MAX_TRACK_BYTES) return null;
  const key = `${file.id}:${file.byte_size}`;
  if (parsed.has(key)) return parsed.get(key) ?? null;
  const { data, error } = await ctx.supabase.storage.from(BUCKET).download(file.storage_path);
  if (error || !data) return null;
  const track = parseTrack(await data.text());
  const result = track ? { ...track, fileId: file.id, fileName: file.original_name ?? "watch export" } : null;
  if (parsed.size >= CACHE_LIMIT) parsed.delete(parsed.keys().next().value as string);
  parsed.set(key, result);
  return result;
}

export type RunSubmission = Tables<"evidence_submissions"> & { files: Tables<"evidence_files">[] };

/**
 * The run challenge's submission the league should see: the approved version when one
 * exists, otherwise the newest one that is not a private draft. Null before any upload.
 */
export async function loadRunSubmission(ctx: LeagueContext): Promise<{ challenge: Tables<"challenges">; submission: RunSubmission | null } | null> {
  const { data: challenges } = await ctx.supabase.from("challenges").select("*").eq("event_id", ctx.event.id).ilike("proof_type", "%export%").order("sequence").limit(1);
  const challenge = challenges?.[0];
  if (!challenge) return null;
  const { data } = await ctx.supabase.from("evidence_submissions").select("*, files:evidence_files(*)").eq("challenge_id", challenge.id).neq("status", "draft").order("version", { ascending: false });
  const subs = (data ?? []) as RunSubmission[];
  const rank = (s: RunSubmission) => (s.status === "approved" ? 0 : s.status === "submitted" ? 1 : s.status === "flagged" ? 2 : 3);
  const submission = [...subs].sort((a, b) => rank(a) - rank(b) || b.version - a.version)[0] ?? null;
  return { challenge, submission };
}
