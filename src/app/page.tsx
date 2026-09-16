import { redirect } from "next/navigation";
import { isBackendConfigured, publicEnv } from "@/lib/env";
import { getVerifiedUser } from "@/lib/league";

export const dynamic = "force-dynamic";

/** Root: signed-in members go to their role home; everyone else sees the teaser. */
export default async function RootPage() {
  if (!isBackendConfigured()) redirect(publicEnv.demoOnly ? "/demo" : "/teaser");
  const { user } = await getVerifiedUser();
  if (user) redirect("/home");
  redirect("/teaser");
}
