"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getLeagueContext } from "@/lib/league";
import { RESUMABLE_THRESHOLD, safeExtension, validateFile } from "@/lib/evidence-rules";
import type { ActionResult } from "@/lib/actions/feed";

const BUCKET = "evidence";
const SIGNED_READ_SECONDS = 300;

function revalidateEvidence() {
  revalidatePath("/proof");
  revalidatePath("/proof/[challengeId]", "page");
  revalidatePath("/review");
  revalidatePath("/review/[submissionId]", "page");
  revalidatePath("/press");
  revalidatePath("/my-trip");
  revalidatePath("/game-centre");
  revalidatePath("/recap");
}

export async function createDraft(input: { challengeId?: string; pressPromptId?: string; caption?: string }): Promise<ActionResult & { submissionId?: string; version?: number }> {
  const parsed = z.object({ challengeId: z.string().uuid().optional(), pressPromptId: z.string().uuid().optional(), caption: z.string().max(2000).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid request." };
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Only the participant can create evidence." };
  const { data, error } = await ctx.supabase.rpc("create_submission", {
    p_event: ctx.event.id,
    p_challenge: parsed.data.challengeId,
    p_press_prompt: parsed.data.pressPromptId,
    p_caption: parsed.data.caption ?? "",
  });
  if (error || !data) return { ok: false, message: error?.message ?? "Could not create a draft." };
  revalidateEvidence();
  return { ok: true, submissionId: data.id, version: data.version };
}

export async function updateCaption(input: { submissionId: string; caption: string }): Promise<ActionResult> {
  const parsed = z.object({ submissionId: z.string().uuid(), caption: z.string().max(2000) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Caption too long." };
  const ctx = await getLeagueContext();
  const { error, count } = await ctx.supabase.from("evidence_submissions").update({ caption: parsed.data.caption }, { count: "exact" }).eq("id", parsed.data.submissionId).eq("submitter_id", ctx.user.id);
  if (error) return { ok: false, message: "Could not save the caption." };
  if (!count) return { ok: false, message: "This submission can no longer be edited. Create a new version instead." };
  revalidateEvidence();
  return { ok: true, message: "Caption saved." };
}

/**
 * The out-of-ten score on a rated play (the chicken and rib combo). Only the owner's draft or
 * flagged version takes it; submit_submission refuses a rated play without one.
 */
export async function updateRating(input: { submissionId: string; rating: number }): Promise<ActionResult> {
  const parsed = z.object({ submissionId: z.uuid(), rating: z.number().int().min(1).max(10) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Rate it 1 to 10." };
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Only the participant can rate the play." };
  const { error, count } = await ctx.supabase.from("evidence_submissions").update({ rating: parsed.data.rating }, { count: "exact" }).eq("id", parsed.data.submissionId).eq("submitter_id", ctx.user.id);
  if (error) return { ok: false, message: "Could not save the rating." };
  if (!count) return { ok: false, message: "This submission can no longer be edited. Create a new version instead." };
  revalidateEvidence();
  return { ok: true, message: "Rating saved." };
}

export type PreparedUpload =
  | { ok: true; mode: "signed"; path: string; token: string; fileId: string; kind: string; mime: string }
  | { ok: true; mode: "resumable"; path: string; fileId: string; kind: string; mime: string }
  | { ok: false; message: string };

/**
 * Trusted-side validation of type/size and ownership, then either a signed upload URL
 * (small files) or a storage path for a resumable TUS upload (large files). The storage
 * RLS policies enforce the same ownership on the actual upload.
 */
export async function prepareUpload(input: { submissionId: string; fileName: string; mimeType: string; byteSize: number }): Promise<PreparedUpload> {
  const parsed = z.object({ submissionId: z.string().uuid(), fileName: z.string().min(1).max(200), mimeType: z.string().max(120), byteSize: z.number().int().positive() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid upload request." };
  const v = validateFile(parsed.data.mimeType, parsed.data.fileName, parsed.data.byteSize);
  if (!v.ok) return { ok: false, message: v.reason };

  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Only the participant can upload evidence." };
  const { data: sub } = await ctx.supabase.from("evidence_submissions").select("id, status, submitter_id, event_id").eq("id", parsed.data.submissionId).maybeSingle();
  if (!sub || sub.submitter_id !== ctx.user.id) return { ok: false, message: "Submission not found." };
  if (sub.status !== "draft" && sub.status !== "flagged") return { ok: false, message: `This submission is ${sub.status}. Start a new version to replace evidence.` };

  const fileId = crypto.randomUUID();
  const path = `${sub.event_id}/${ctx.user.id}/${sub.id}/${fileId}.${safeExtension(parsed.data.fileName)}`;
  if (parsed.data.byteSize > RESUMABLE_THRESHOLD) {
    return { ok: true, mode: "resumable", path, fileId, kind: v.kind, mime: v.mime };
  }
  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: `Could not prepare the upload: ${error?.message ?? "unknown error"}` };
  return { ok: true, mode: "signed", path: data.path, token: data.token, fileId, kind: v.kind, mime: v.mime };
}

/** Records an uploaded object after confirming it exists in the private bucket. */
export async function attachFile(input: { submissionId: string; path: string; mimeType: string; byteSize: number; originalName: string }): Promise<ActionResult & { fileId?: string }> {
  const parsed = z.object({ submissionId: z.string().uuid(), path: z.string().min(10).max(300), mimeType: z.string().max(120), byteSize: z.number().int().positive(), originalName: z.string().max(200) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid attach request." };
  const v = validateFile(parsed.data.mimeType, parsed.data.originalName, parsed.data.byteSize);
  if (!v.ok) return { ok: false, message: v.reason };
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Only the participant can attach evidence." };
  const { data: sub } = await ctx.supabase.from("evidence_submissions").select("id, status, submitter_id, event_id").eq("id", parsed.data.submissionId).maybeSingle();
  if (!sub || sub.submitter_id !== ctx.user.id) return { ok: false, message: "Submission not found." };
  if (sub.status !== "draft" && sub.status !== "flagged") return { ok: false, message: `This submission is ${sub.status}. Start a new version to replace evidence.` };
  // The object must live in this submission's own folder, never another submission's.
  if (!parsed.data.path.startsWith(`${sub.event_id}/${ctx.user.id}/${sub.id}/`)) return { ok: false, message: "The file does not belong to this submission." };

  const folder = parsed.data.path.slice(0, parsed.data.path.lastIndexOf("/"));
  const fileName = parsed.data.path.slice(parsed.data.path.lastIndexOf("/") + 1);
  const { data: listed, error: listError } = await ctx.supabase.storage.from(BUCKET).list(folder, { search: fileName, limit: 5 });
  const obj = listed?.find((o) => o.name === fileName);
  if (listError || !obj) return { ok: false, message: "The uploaded file could not be found in storage. Retry the upload." };
  const storedSize = Number(obj.metadata?.size ?? parsed.data.byteSize);
  // Re-check the limit against what storage actually holds, not the size the client declared.
  const stored = validateFile(parsed.data.mimeType, parsed.data.originalName, storedSize);
  if (!stored.ok) {
    await ctx.supabase.storage.from(BUCKET).remove([parsed.data.path]);
    return { ok: false, message: stored.reason };
  }

  const { data, error } = await ctx.supabase
    .from("evidence_files")
    .insert({ submission_id: parsed.data.submissionId, storage_path: parsed.data.path, mime_type: v.mime, byte_size: storedSize, kind: v.kind, original_name: parsed.data.originalName.slice(0, 200) })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: true, message: "Already attached." };
    return { ok: false, message: "Upload succeeded but the file could not be attached to the submission." };
  }
  revalidateEvidence();
  return { ok: true, fileId: data.id, message: "File attached." };
}

export async function deleteDraftFile(input: { fileId: string }): Promise<ActionResult> {
  const parsed = z.object({ fileId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid file." };
  const ctx = await getLeagueContext();
  if (!ctx.isParticipant) return { ok: false, message: "Only the participant can remove evidence." };
  const { data: file } = await ctx.supabase.from("evidence_files").select("id, storage_path").eq("id", parsed.data.fileId).maybeSingle();
  if (!file) return { ok: false, message: "File not found." };
  // RLS filters out anything that is not the participant's own draft; a filtered delete returns no error, so count the rows.
  const { error, count } = await ctx.supabase.from("evidence_files").delete({ count: "exact" }).eq("id", file.id);
  if (error) return { ok: false, message: "Could not remove the file." };
  if (!count) return { ok: false, message: "Only files on a draft or flagged submission can be removed. Start a new version to replace reviewed proof." };
  const { error: storageError } = await ctx.supabase.storage.from(BUCKET).remove([file.storage_path]);
  revalidateEvidence();
  return { ok: true, message: storageError ? "File removed from the draft (the stored object will be cleaned up later)." : "File removed from the draft." };
}

export async function submitDraft(input: { submissionId: string }): Promise<ActionResult> {
  const parsed = z.object({ submissionId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid submission." };
  const ctx = await getLeagueContext();
  const { error } = await ctx.supabase.rpc("submit_submission", { p_submission: parsed.data.submissionId });
  if (error) {
    if (error.message.includes("attach at least")) return { ok: false, message: "Attach at least one uploaded file before submitting." };
    if (error.message.includes("rate it")) return { ok: false, message: "Rate it out of ten before submitting." };
    return { ok: false, message: error.message };
  }
  revalidateEvidence();
  return { ok: true, message: "Proof submitted for commissioner review." };
}

/**
 * Fresh short-lived signed read URL for a private evidence file. RLS limits reads to active
 * members; on top of that, unsubmitted drafts are only served to their owner and commissioners.
 */
export async function signedMediaUrl(input: { fileId: string }): Promise<{ ok: true; url: string; mime: string; kind: string; name: string } | { ok: false; message: string }> {
  const parsed = z.object({ fileId: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Invalid file." };
  const ctx = await getLeagueContext();
  const { data: file } = await ctx.supabase
    .from("evidence_files")
    .select("storage_path, mime_type, kind, original_name, submission:evidence_submissions!inner(status, submitter_id)")
    .eq("id", parsed.data.fileId)
    .maybeSingle();
  if (!file) return { ok: false, message: "File not found." };
  const sub = file.submission;
  if (sub.status === "draft" && sub.submitter_id !== ctx.user.id && !ctx.isCommissioner) return { ok: false, message: "File not found." };
  const { data, error } = await ctx.supabase.storage.from(BUCKET).createSignedUrl(file.storage_path, SIGNED_READ_SECONDS, { download: file.kind === "document" || file.kind === "gps" ? file.original_name ?? true : undefined });
  if (error || !data) return { ok: false, message: "Could not sign the media URL." };
  return { ok: true, url: data.signedUrl, mime: file.mime_type, kind: file.kind, name: file.original_name ?? "evidence" };
}
