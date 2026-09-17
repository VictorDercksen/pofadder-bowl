"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { JerseyCard } from "@/components/ui/JerseyCard";
import { EmptyState, Status } from "@/components/ui/TitleRow";
import { createClient } from "@/lib/supabase/client";
import { loadOlderPosts, postComment, toggleReaction } from "@/lib/actions/feed";
import { FEED_PAGE_SIZE, appendFeedPosts, feedCursor, mergeFeedPosts } from "@/lib/feed-page";
import { formatTime } from "@/lib/time";
import { useOnline } from "@/lib/hooks";
import type { FeedPost } from "@/lib/feed";

const KIND_LABEL: Record<string, string> = {
  checkin: "Check-in",
  comment: "League comment",
  submission: "Proof submitted",
  decision: "Commissioner call",
  bingo: "Bingo",
  prediction: "Predictions",
  system: "League",
};

/**
 * Jersey-card activity feed. The server renders the first page (five posts); "Earlier plays"
 * loads five more at a time through a server action. Live updates arrive through an
 * authorised Realtime subscription with a bounded polling fallback and are merged over
 * whatever is already on screen, so loaded history is never lost to a refresh.
 */
export function SidelineFeed({ initialPosts, initialHasMore = false, eventId, timezone, canComment = true }: { initialPosts: FeedPost[]; initialHasMore?: boolean; eventId: string; timezone: string; canComment?: boolean }) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  const [hasMore, setHasMore] = useState(initialHasMore);
  // Once "Earlier plays" has been used, the action result owns hasMore; until then the server's first page does.
  const [pagedOnce, setPagedOnce] = useState(false);
  const [seenInitial, setSeenInitial] = useState(initialPosts);
  if (initialPosts !== seenInitial) {
    // Server refresh delivered a fresh first page: merge it over what is shown (derived state pattern).
    setSeenInitial(initialPosts);
    setPosts((prev) => mergeFeedPosts(initialPosts, prev));
    if (!pagedOnce) setHasMore(initialHasMore);
  }
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState<{ text: string; tone: "ok" | "warn" | "error" } | null>(null);
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
      setNote({ text: "Write a comment first.", tone: "warn" });
      return;
    }
    if (!online) {
      setNote({ text: "You are offline. Reconnect to post to the sideline.", tone: "warn" });
      return;
    }
    startTransition(async () => {
      const res = await postComment({ body });
      setNote({ text: res.message ?? (res.ok ? "Posted." : "Failed."), tone: res.ok ? "ok" : "error" });
      if (res.ok) setComment("");
    });
  }

  function loadOlder() {
    if (loadingOlder) return;
    const cursor = feedCursor(posts);
    if (!cursor) return;
    if (!online) {
      setNote({ text: "You are offline. Reconnect to load earlier plays.", tone: "warn" });
      return;
    }
    setLoadingOlder(true);
    startTransition(async () => {
      const res = await loadOlderPosts({ before: cursor });
      setLoadingOlder(false);
      if (!res.ok) {
        setNote({ text: res.message, tone: "error" });
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
        setNote({ text: res.message, tone: "error" });
      }
    });
  }

  return (
    <section className="pb-sideline" aria-labelledby="sideline-heading">
      <div className="pb-sideline-head">
        <div>
          <div className="pb-kicker">THE LOCKER ROOM IS TALKING</div>
          <h2 id="sideline-heading">League sideline</h2>
        </div>
        <p className="pb-small">
          Team kits. Personal takes.
          <br />
          {online ? "Live · updates as they land." : "Offline · showing the last loaded feed."}
        </p>
      </div>
      {posts.length === 0 ? (
        <EmptyState title="Nobody has said anything yet.">The first check-in, proof or comment will appear here as a jersey card.</EmptyState>
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
              captain={post.kind === "decision" || post.kind === "checkin"}
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
      <Status tone={note?.tone}>{note?.text}</Status>
    </section>
  );
}
