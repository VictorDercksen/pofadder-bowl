"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Status } from "@/components/ui/TitleRow";
import { setCertificateConsent } from "@/lib/actions/account";
import { teamLogoSrc } from "@/lib/nfl";

export type CertificateSummary = {
  participant: string;
  approved: number;
  max: number;
  approvedChallenges: number;
  total: number;
  runKm: number | null;
  runTime: string | null;
  checkins: number;
  bingoWinners: string[];
  predictionWinners: string[];
  issuedAt: string | null;
  eventName: string;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Renders a share image / certificate PNG on a canvas from the real summary. */
async function renderCertificate(summary: CertificateSummary, issued: boolean, kitTeam: string): Promise<Blob | null> {
  const W = 1200;
  const H = 1200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) return null;
  const green = "#183b2f";
  const cream = "#f4f0e6";
  const gold = "#e8bd67";
  const orange = "#cc542b";
  c.fillStyle = cream;
  c.fillRect(0, 0, W, H);
  // Field lines
  c.strokeStyle = "#d9dacd";
  c.lineWidth = 2;
  for (let x = 100; x < W; x += 100) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, H);
    c.stroke();
  }
  c.fillStyle = orange;
  c.fillRect(0, 0, W, 14);
  c.strokeStyle = green;
  c.lineWidth = 6;
  c.strokeRect(40, 40, W - 80, H - 80);
  c.lineWidth = 2;
  c.strokeRect(54, 54, W - 108, H - 108);
  const [logo, shield] = await Promise.all([loadImage(teamLogoSrc(kitTeam)), loadImage("/nfl/nfl.png")]);
  if (logo) c.drawImage(logo, W / 2 - 150, 100, 110, 110);
  if (shield) c.drawImage(shield, W / 2 - 22, 106, 70, 88);
  // PB patch
  c.fillStyle = green;
  c.beginPath();
  c.moveTo(W / 2 + 70, 100);
  c.lineTo(W / 2 + 190, 100);
  c.lineTo(W / 2 + 190, 190);
  c.lineTo(W / 2 + 130, 215);
  c.lineTo(W / 2 + 70, 190);
  c.closePath();
  c.fill();
  c.fillStyle = gold;
  c.font = "900 44px 'Barlow Condensed', Impact, sans-serif";
  c.textAlign = "center";
  c.fillText("PB", W / 2 + 130, 160);
  c.font = "600 18px Barlow, Arial, sans-serif";
  c.fillText("2026", W / 2 + 130, 186);

  c.fillStyle = orange;
  c.font = "600 22px Barlow, Arial, sans-serif";
  c.fillText(`SHOW US YOUR TD’S · ${issued ? "COMMISSIONER CERTIFIED" : "CERTIFICATE PENDING"}`, W / 2, 270);
  c.fillStyle = green;
  c.font = "900 96px 'Barlow Condensed', Impact, sans-serif";
  c.fillText(issued ? `${summary.participant.split(" ")[0].toUpperCase()} SURVIVED POFADDER.` : "NOT CERTIFIED YET.", W / 2, 380);
  c.fillStyle = "#192e25";
  c.font = "400 30px Barlow, Arial, sans-serif";
  c.fillText(issued ? "Two overnight buses. Fourteen kilometres. Ten plays." : "Pending the commissioner’s decision.", W / 2, 440);
  c.fillText(issued ? "One outstanding contribution to league entertainment." : "Built only from approved evidence.", W / 2, 484);

  const stats: [string, string][] = [
    [`${summary.approved} / ${summary.max}`, "APPROVED PROOF"],
    [summary.runKm != null ? `${summary.runKm.toFixed(2)} km` : "—", summary.runTime ? `RUN · ${summary.runTime}` : "RUN (OFFICIAL)"],
    [`${summary.approvedChallenges} / ${summary.total}`, "CHALLENGES SERVED"],
  ];
  stats.forEach(([big, small], i) => {
    const x = 220 + i * 380;
    c.fillStyle = green;
    c.font = "700 74px 'Barlow Condensed', Impact, sans-serif";
    c.fillText(big, x, 620);
    c.fillStyle = "#687366";
    c.font = "600 20px Barlow, Arial, sans-serif";
    c.fillText(small, x, 660);
    c.fillStyle = "#d9dacd";
    c.fillRect(x - 150, 680, 300, 3);
  });

  c.fillStyle = "#192e25";
  c.font = "400 26px Barlow, Arial, sans-serif";
  c.fillText(`Bingo: ${summary.bingoWinners.length ? summary.bingoWinners.join(", ") : "no confirmed line"}`, W / 2, 760);
  c.fillText(`Predictions: ${summary.predictionWinners.length ? summary.predictionWinners.join(", ") : "not resolved"}`, W / 2, 800);
  c.fillText(`${summary.checkins} timestamped check-in${summary.checkins === 1 ? "" : "s"}`, W / 2, 840);

  c.fillStyle = green;
  c.font = "500 54px 'Barlow Condensed', Impact, sans-serif";
  c.fillText(issued ? "The Commissioner" : "Awaiting the Commissioner", W / 2, 950);
  c.fillStyle = "#687366";
  c.font = "400 22px Barlow, Arial, sans-serif";
  c.fillText(summary.issuedAt ? `Issued ${summary.issuedAt}` : summary.eventName, W / 2, 990);

  // Ticket stub
  c.setLineDash([8, 8]);
  c.strokeStyle = "#9baf8c";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(120, 1050);
  c.lineTo(W - 120, 1050);
  c.stroke();
  c.setLineDash([]);
  c.fillStyle = "#192e25";
  c.font = "600 20px Barlow, Arial, sans-serif";
  c.textAlign = "left";
  c.fillText(`PB26 · ${issued ? "SENTENCE CLOSED" : "SENTENCE OPEN"} · UNOFFICIAL FANTASY LEAGUE`, 120, 1095);
  for (let i = 0; i < 40; i++) {
    c.fillStyle = "#173c2b";
    c.fillRect(W - 120 - i * 8 - (i % 3 === 0 ? 4 : 2), 1072, i % 3 === 0 ? 4 : 2, 30);
  }
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

export function CertificateExport({ summary, issued, kitTeam }: { summary: CertificateSummary; issued: boolean; kitTeam: string }) {
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [busy, setBusy] = useState(false);

  async function exportPng(share: boolean) {
    setBusy(true);
    try {
      await document.fonts?.ready;
      const blob = await renderCertificate(summary, issued, kitTeam);
      if (!blob) throw new Error("render failed");
      const file = new File([blob], `pofadder-bowl-2026-${issued ? "certificate" : "progress"}.png`, { type: "image/png" });
      if (share && navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Pofadder Bowl 2026", text: `${summary.participant}: ${summary.approved}/${summary.max} approved. League media stays private.` });
        setNote({ text: "Shared.", tone: "ok" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setNote({ text: `${issued ? "Certificate" : "Progress card"} PNG downloaded.`, tone: "ok" });
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") setNote({ text: "Could not render the image in this browser.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div className="pb-actions">
        <button className="pb-primary" type="button" disabled={busy} onClick={() => exportPng(false)}>
          {issued ? "Download certificate PNG" : "Download progress card PNG"}
        </button>
        <button className="pb-secondary" type="button" disabled={busy} onClick={() => exportPng(true)}>
          Share image
        </button>
      </div>
      <p className="pb-small" style={{ marginTop: 8 }}>{issued ? "Rendered from the certified summary." : "Clearly marked as pending until the commissioner issues the certificate."}</p>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}

export function ConsentToggle({ consent, isPublic, publicUrl }: { consent: boolean; isPublic: boolean; publicUrl: string }) {
  const router = useRouter();
  const [value, setValue] = useState(consent);
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div style={{ marginTop: 14 }}>
      <label className="pb-check-row">
        <input
          type="checkbox"
          checked={value}
          disabled={pending}
          onChange={(e) => {
            setValue(e.target.checked);
            startTransition(async () => {
              const res = await setCertificateConsent({ consent: e.target.checked });
              setNote({ text: res.message ?? "", tone: res.ok ? "ok" : "error" });
              router.refresh();
            });
          }}
        />
        I allow a public recap page (summary only, no league media)
      </label>
      <p className="pb-small">
        {value && isPublic ? (
          <>
            Public page: <a href={publicUrl}>{publicUrl}</a> (live once the certificate is issued).
          </>
        ) : (
          "The commissioner must also allow publication. Until both agree, the recap stays private."
        )}
      </p>
      <Status tone={note?.tone}>{note?.text}</Status>
    </div>
  );
}
