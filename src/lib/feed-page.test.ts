import { describe, expect, it } from "vitest";
import { FEED_PAGE_SIZE, appendFeedPosts, compareFeedPosts, feedCursor, mergeFeedPosts } from "./feed-page";

const post = (id: string, created_at: string, n = 0) => ({ id, created_at, reaction_count: n });

describe("feed paging", () => {
  it("shows five at a time", () => {
    expect(FEED_PAGE_SIZE).toBe(5);
  });

  it("cursor points at the oldest shown post", () => {
    expect(feedCursor([])).toBeNull();
    expect(feedCursor([post("b", "2026-09-24T10:00:00Z"), post("a", "2026-09-24T09:00:00Z")])).toEqual({ createdAt: "2026-09-24T09:00:00Z", id: "a" });
  });

  it("sorts newest first with id as the tie-break", () => {
    const rows = [post("a", "2026-09-24T09:00:00Z"), post("c", "2026-09-24T10:00:00Z"), post("b", "2026-09-24T10:00:00Z")];
    expect(rows.sort(compareFeedPosts).map((p) => p.id)).toEqual(["c", "b", "a"]);
  });

  it("merge keeps the loaded tail when a new post pushes one out of the first page", () => {
    const shown = ["e", "d", "c", "b", "a"].map((id, i) => post(id, `2026-09-24T0${9 - i}:00:00Z`));
    const fresh = [post("f", "2026-09-24T12:00:00Z"), ...shown.slice(0, 4).map((p) => ({ ...p, reaction_count: 3 }))];
    const merged = mergeFeedPosts(fresh, shown);
    expect(merged.map((p) => p.id)).toEqual(["f", "e", "d", "c", "b", "a"]);
    expect(merged[1].reaction_count).toBe(3);
    expect(merged[5].reaction_count).toBe(0);
  });

  it("append drops duplicates and keeps order", () => {
    const shown = [post("c", "2026-09-24T10:00:00Z"), post("b", "2026-09-24T09:00:00Z")];
    const older = [post("b", "2026-09-24T09:00:00Z"), post("a", "2026-09-24T08:00:00Z")];
    expect(appendFeedPosts(shown, older).map((p) => p.id)).toEqual(["c", "b", "a"]);
  });
});
