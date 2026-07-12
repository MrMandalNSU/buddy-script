import { describe, expect, it } from "vitest";
import { newestFirst, toggleReaction, visibleTo } from "./model";
import type { Post } from "./types";
const me = { id: "me", firstName: "Me", lastName: "User", email: "me@x.com", avatarUrl: "", headline: "" };
const other = { ...me, id: "other" };
const post = (id: string, author = other, visibility: "public" | "private" = "public", createdAt = "2025-01-01") => ({ id, author, visibility, createdAt, body: id, reactions: { likedByViewer: false, users: [] }, comments: [] }) as Post;
describe("feed model", () => {
  it("orders newest first", () => expect(newestFirst([post("old"), post("new", other, "public", "2026-01-01")])[0].id).toBe("new"));
  it("hides another user's private post", () => expect(visibleTo([post("hidden", other, "private"), post("mine", me, "private")], "me").map((p) => p.id)).toEqual(["mine"]));
  it("toggles the viewer without duplicates", () => expect(toggleReaction(toggleReaction({ likedByViewer: false, users: [] }, me), me)).toEqual({ likedByViewer: false, users: [] }));
});
