"use client";

import { useEffect, useRef, useState } from "react";
import { EvidenceUploader, type EvidenceUploaderHandle, type ExistingSubmission } from "@/components/proof/EvidenceUploader";
import { formatDateTime } from "@/lib/time";

export type Prompt = { id: string; slot: string; sequence: number; question: string; opens_at: string; open: boolean; latest: ExistingSubmission };

/**
 * Press room: cycles supplied prompts; time-gated. Recording asks for camera/microphone
 * only after a deliberate "Record" action, with file upload as the fallback. A clip is
 * only "recorded" once a real Blob exists, and it is submitted through the evidence pipeline.
 */
export function PressRoom({ prompts, canAnswer, timezone }: { prompts: Prompt[]; canAnswer: boolean; timezone: string }) {
  const [index, setIndex] = useState(Math.max(0, prompts.findIndex((p) => p.open)));
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const uploaderRef = useRef<EvidenceUploaderHandle>(null);
  const prompt = prompts[index];

  useEffect(
    () => () => {
      try {
        recorderRef.current?.stop();
      } catch {
        // already inactive
      }
      stopStream();
    },
    [],
  );

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setError(null);
    if (!("mediaDevices" in navigator) || typeof MediaRecorder === "undefined") {
      setError("This browser cannot record in-page. Use the file upload below with your camera app.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const target = prompt; // pinned: "Next question" is disabled while recording, but never trust the closure
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        const type = rec.mimeType || "video/webm";
        const blob = new Blob(chunks, { type });
        stopStream();
        if (blob.size === 0) {
          setError("Nothing was recorded.");
          return;
        }
        const ext = type.includes("mp4") ? "mp4" : "webm";
        uploaderRef.current?.addFile(new File([blob], `press-answer-${target.slot}-${target.sequence}.${ext}`, { type }));
      };
      recorderRef.current = rec;
      rec.start(1000);
      setRecording(true);
      setSeconds(0);
      const started = Date.now();
      const tick = window.setInterval(() => {
        setSeconds(Math.floor((Date.now() - started) / 1000));
        if (Date.now() - started > 180_000) stop();
      }, 500);
      rec.addEventListener("stop", () => window.clearInterval(tick), { once: true });
    } catch (err) {
      const e = err as DOMException;
      setError(e.name === "NotAllowedError" ? "Camera/microphone permission denied. Record with your camera app and upload the file instead." : `Could not start recording (${e.name}). Use the file upload instead.`);
      stopStream();
    }
  }

  function stop() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  if (!prompt) return <blockquote>No press prompts have been scheduled.</blockquote>;

  return (
    <div>
      <blockquote>“{prompt.question}”</blockquote>
      <small>
        QUESTION {index + 1} OF {prompts.length} · {prompt.slot.toUpperCase()} · {prompt.open ? "OPEN" : `OPENS ${formatDateTime(prompt.opens_at, timezone).toUpperCase()}`}
      </small>
      <div className="pb-actions">
        <button className="pb-secondary" type="button" onClick={() => setIndex((index + 1) % prompts.length)} disabled={recording}>Next question</button>
        {canAnswer && prompt.open ? (
          recording ? (
            <button className="pb-primary orange" type="button" onClick={stop}>
              ■ Stop ({seconds}s)
            </button>
          ) : (
            <button className="pb-primary" type="button" onClick={startRecording}>
              ● Record answer
            </button>
          )
        ) : null}
      </div>
      <video ref={videoRef} muted playsInline style={{ width: "100%", maxHeight: 260, background: "#000", display: recording ? "block" : "none", marginTop: 12 }} aria-label="Camera preview" />
      {error ? <p className="pb-warn-text pb-inline-status" role="alert" style={{ color: "#f2c9a8" }}>{error}</p> : null}
      {canAnswer ? (
        prompt.open ? (
          <div style={{ marginTop: 14, color: "var(--pb-ink)" }}>
            <EvidenceUploader key={prompt.id} ref={uploaderRef} targetKind="press" targetId={prompt.id} targetTitle={`Answer · Q${prompt.sequence} (${prompt.slot})`} current={prompt.latest} accept="video/*,audio/*" captureHint="Record in the page or upload a clip from your camera app. A clip must exist before it counts as recorded." captionPlaceholder="Anything to add for the record?" />
          </div>
        ) : (
          <p className="pb-small" style={{ marginTop: 12, color: "#cbd7c1" }}>This prompt is not open yet. Recording unlocks at the scheduled time.</p>
        )
      ) : (
        <p className="pb-small" style={{ marginTop: 12, color: "#cbd7c1" }}>
          {prompt.latest ? `Answer ${prompt.latest.status}.` : "No answer yet."} Only the participant can record.
        </p>
      )}
    </div>
  );
}
