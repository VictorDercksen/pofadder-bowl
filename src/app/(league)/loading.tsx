import { LoadingPlay } from "@/components/ui/Football";

/**
 * Instant loading state for every private screen. Next.js prefetches this boundary, so a
 * navigation swaps the content area immediately while the page's data streams in.
 */
export default function LeagueLoading() {
  return <LoadingPlay />;
}
