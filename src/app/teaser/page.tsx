import Image from "next/image";
import Link from "next/link";
import { EVENT_META } from "@/lib/programme";
import { KickoffTimer } from "@/components/teaser/KickoffTimer";

export const metadata = {
  title: "Teaser",
  description: "Show Us Your TD’s · Pofadder Bowl 2026 · 23–25 September. No timeouts. No appeals.",
  robots: { index: true, follow: false },
  openGraph: { images: ["/brand/pofadder-bowl-2026-teaser.png"] },
};

/** Public teaser/landing route. Only artwork and non-personal event copy are public. */
export default function TeaserPage() {
  return (
    <div className="pb" style={{ background: "#10291f", color: "#f4f0e6" }}>
      <main className="pb-teaser">
        <div className="pb-kicker" style={{ color: "var(--pb-gold)" }}>SHOW US YOUR TD’S · PUNISHMENT SERIES</div>
        <h1 style={{ color: "#fff8e9" }}>Pofadder Bowl 2026</h1>
        <p style={{ fontSize: 13, color: "#c9d5c5", margin: "8px 0 18px" }}>
          {EVENT_META.home} → {EVENT_META.away} → {EVENT_META.home}. 23–25 September. A {EVENT_META.requiredRunKm} km run and ten proof challenges worth {EVENT_META.maxProofPoints} points. League members: sign in for the game centre.
        </p>
        <Image
          src="/brand/pofadder-bowl-2026-teaser.png"
          alt="Show Us Your TD’s. Pofadder Bowl 2026. A vintage green, cream and orange football poster with a coach on a desert road. 23–25 September. No timeouts. No appeals."
          width={1254}
          height={1254}
          priority
          sizes="(max-width: 920px) 100vw, 920px"
        />
        <KickoffTimer departureIso={EVENT_META.departure} homeArrivalIso={EVENT_META.homeArrival} />
        <div className="pb-actions">
          <Link className="pb-primary" href="/login" style={{ background: "var(--pb-gold)", color: "var(--pb-green)", borderColor: "var(--pb-gold)", boxShadow: "0 2px 0 #9a7a34" }}>League sign-in</Link>
          <Link className="pb-secondary" href="/demo" style={{ background: "transparent", color: "#f4f0e6", borderColor: "#f4f0e6", boxShadow: "none" }}>Interactive demo</Link>
        </div>
        <p className="pb-small" style={{ color: "#9fb09b", marginTop: 20 }}>
          Unofficial fantasy league. Not affiliated with or sponsored by the NFL. Team marks belong to their owners.
        </p>
      </main>
    </div>
  );
}
