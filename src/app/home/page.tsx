import { redirect } from "next/navigation";
import { getLeagueContext, homeFor } from "@/lib/league";

export const dynamic = "force-dynamic";

/** Role-aware landing: participant → My trip, member → Game centre, commissioner → Review. */
export default async function HomePage() {
  const ctx = await getLeagueContext();
  redirect(homeFor(ctx));
}
