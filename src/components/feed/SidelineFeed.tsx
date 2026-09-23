"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { JerseyCard } from "@/components/ui/JerseyCard";
import { EmptyState } from "@/components/ui/TitleRow";
import { toast } from "@/lib/toast-store";
import { createClient } from "@/lib/supabase/client";
import { loadOlderPosts, postComment, toggleReaction } from "@/lib/actions/feed";
import { FEED_PAGE_SIZE, appendFeedPosts, feedCursor, mergeFeedPosts } from "@/lib/feed-page";
import { formatTime } from "@/lib/time";
import { useOnline } from "@/lib/hooks";
import { currentStepId } from "@/lib/tour";
import { useTourRun } from "@/lib/tour-store";
import type { FeedPost } from "@/lib/feed";

/** The signed-in member's own kit, for the tour's preview card. */
export type FeedViewer = { name: string; team: string | null; number: number };

const KIND_LABEL: Record<string, string> = {
  comment: "League comment",
  submission: "Proof submitted",
  decision: "Commissioner call",
  prop: "Prop board",
  prediction: "Predictions",
  system: "League",
};

/**
 * Jersey-card activity feed. The server renders the first page (five posts); "Earlier plays"
 * loads five more at a time through a server action. Live updates arrive through an
 * authorised Realtime subscription with a bounded polling fallback and are merged over
 * whatever is already on screen, so loaded history is never lost to a refresh.
 *
 * While the first-run tour is on its sideline step, a preview card in the viewer's own kit
 * sits at the top of the feed so the member sees their jersey before they post. It lives
 * only on this screen and is never written to the database.
 */
export function SidelineFeed({ initialPosts, initialHasMore = false, initialError = false, eventId, timezone, canComment = true, viewer }: { initialPosts: FeedPost[]; initialHasMore?: boolean; initialError?: boolean; eventId: string; timezone: string; canComment?: boolean; viewer?: FeedViewer }) {
  const router = useRouter();
  const tourRun = useTourRun();
  const preview = viewer && currentStepId(tourRun) === "sideline" ? viewer : null;
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  // Once "Earlier plays" has been used, the action result owns hasMore; until then the server's first page does.
  const [pagedOnce, setPagedOnce] = useState(false);
  const [seenInitial, setSeenInitial] = useState(initialPosts);
  if (initialPosts !== seenInitial) {
    // Server refresh delivered a fresh first page: merge it over what is shown (derived state pattern).
    setSeenInitial(initialPosts);
    setPosts((prev) => mergeFeedPosts(initialPosts, prev));
    if (!pagedOnce && !initialError) setHasMore(initialHasMore);
  }
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [comment, setComment] = useState("");
  const online = useOnline();
  const [pending, startTransition] = useTransition();
  const refreshTimer = useRef<number | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
    refreshTimer.current = window.setTimeout(() => router.refresh(), 400);
  }, [router]);

  useEffect(() => {
    window.addEventListener("online", scheduleRefresh);
    return () => window.removeEventListener("online", scheduleRefresh);
  }, [scheduleRefresh]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`feed:${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_posts", filter: `event_id=eq.${eventId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, scheduleRefresh)
      .subscribe();
    // Bounded polling fallback (every 45 s while visible) in case Realtime is unavailable.
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    }, 45_000);
    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
    };
  }, [eventId, router, scheduleRefresh]);

  function submitComment() {
    if (pending) return;
    const body = comment.trim();
    if (!body) {
      toast("Write a comment first.", "warn");
      return;
    }
    if (!online) {
      toast("You are offline. Reconnect to post to the sideline.", "warn");
      return;
    }
    startTransition(async () => {
      const res = await postComment({ body });
      toast(res.message ?? (res.ok ? "Posted." : "Failed."), res.ok ? "ok" : "error");
      if (res.ok) setComment("");
    });
  }

  function loadOlder() {
    if (loadingOlder) return;
    const cursor = feedCursor(posts);
    if (!cursor) return;
    if (!online) {
      toast("You are offline. Reconnect to load earlier plays.", "warn");
      return;
    }
    setLoadingOlder(true);
    startTransition(async () => {
      const res = await loadOlderPosts({ before: cursor });
      setLoadingOlder(false);
      if (!res.ok) {
        toast(res.message, "error");
        return;
      }
      setPosts((prev) => appendFeedPosts(prev, res.posts ?? []));
      setHasMore(Boolean(res.hasMore));
      setPagedOnce(true);
    });
  }

  function react(post: FeedPost) {
    // Optimistic toggle, reconciled by the server result.
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, reacted: !p.reacted, reaction_count: p.reaction_count + (p.reacted ? -1 : 1) } : p)));
    startTransition(async () => {
      const res = await toggleReaction({ postId: post.id });
      if (!res.ok) {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, reacted: post.reacted, reaction_count: post.reaction_count } : p)));
        toast(res.message, "error");
      }
    });
  }

  return (
    <section className="pb-sideline" aria-labelledby="sideline-heading" data-tour="sideline">
      {initialError ? <div className="pb-save-state" role="alert">The feed could not be updated. Previously loaded posts are still shown. <button className="pb-secondary" type="button" onClick={() => router.refresh()}>Retry</button></div> : null}
      <div className="pb-sideline-head">
        <div>
          <div className="pb-kicker">THE LOCKER ROOM IS TALKING</div>
          <h2 id="sideline-heading">League sideline</h2>
        </div>
        <p className="pb-small">
          Team kits. Personal takes.
          <br />
          {initialError ? "Updates delayed · retry to reconnect." : online ? "Live · updates as they land." : "Offline · showing the last loaded feed."}
        </p>
      </div>
      {preview ? (
        <div className="pb-sideline-preview" data-tour="sideline-preview">
          <div className="pb-kicker">YOUR CARD · PREVIEW ONLY · NOT POSTED</div>
          <div className="pb-jersey-feed">
            <JerseyCard
              team={preview.team}
              displayName={preview.name}
              number={preview.number}
              message="This is how your take lands on the sideline: your franchise, your name, your number. Show absolutely no sympathy."
              time="Not posted"
              kind="Preview"
              captain={false}
              reaction={
                <button className="pb-reaction" type="button" disabled aria-label="Preview reaction, disabled">
                  😂 0 · No sympathy
                </button>
              }
            />
          </div>
        </div>
      ) : null}
      {posts.length === 0 ? (
        <EmptyState title="Nobody has said anything yet.">The first proof, decision or comment will appear here as a jersey card.</EmptyState>
      ) : (
        <div className="pb-jersey-feed">
          {posts.map((post) => (
            <JerseyCard
              key={post.id}
              team={post.kit_team}
              displayName={post.author_name}
              number={post.kit_number}
              heading={post.kind === "comment" ? undefined : post.heading}
              message={post.body}
              time={formatTime(post.created_at, timezone)}
              kind={KIND_LABEL[post.kind] ?? post.kind}
              captain={post.kind === "decision"}
              reaction={
                <button className="pb-reaction" type="button" aria-pressed={post.reacted} onClick={() => react(post)} aria-label={`${post.reacted ? "Remove" : "Add"} no-sympathy reaction`}>
                  😂 {post.reaction_count} · No sympathy
                </button>
              }
              actions={canComment ? <a className="pb-post-action" href="#sideline-comment">Reply</a> : null}
            />
          ))}
          <div className="pb-feed-more">
            {hasMore ? (
              <button className="pb-secondary" type="button" onClick={loadOlder} disabled={loadingOlder} aria-label={`Load ${FEED_PAGE_SIZE} earlier plays`}>
                {loadingOlder ? "Rolling the tape…" : `Earlier plays · ${FEED_PAGE_SIZE} more`}
              </button>
            ) : posts.length > FEED_PAGE_SIZE ? (
              <span className="pb-small">That is the whole tape.</span>
            ) : null}
          </div>
        </div>
      )}
      {canComment ? (
        <div className="pb-comment-box">
          <label className="pb-field">
            Add to the commentary
            <input id="sideline-comment" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} placeholder="Show absolutely no sympathy…" onKeyDown={(e) => e.key === "Enter" && submitComment()} />
          </label>
          <div className="pb-actions">
            <button className="pb-secondary" type="button" onClick={submitComment} disabled={pending}>
              {pending ? "Posting…" : "Post comment"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
