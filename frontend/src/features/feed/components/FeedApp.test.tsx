import { QueryClient, QueryClientProvider, type InfiniteData } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { createElement, type ImgHTMLAttributes, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Comment, Page, Post } from "../types";
import { FeedApp, prependPostToFeed } from "./FeedApp";

const repository = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  setPostLike: vi.fn(),
  comments: vi.fn(),
  addComment: vi.fn(),
  replies: vi.fn(),
  addReply: vi.fn(),
  setCommentLike: vi.fn(),
  postLikers: vi.fn(),
  commentLikers: vi.fn(),
}));

vi.mock("../repository", () => ({
  feedRepository: repository,
  feedKeys: {
    all: ["feed"],
    comments: (postId: string) => ["comments", postId],
    replies: (commentId: string) => ["replies", commentId],
    likers: (kind: string, id: string) => ["likers", kind, id],
  },
}));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "viewer-1", firstName: "Alex", lastName: "Morgan", email: "alex@example.com", avatarUrl: null },
    logout: vi.fn(),
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("next/image", () => ({
  default: (props: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean; fill?: boolean; sizes?: string; unoptimized?: boolean }) => {
    const imageProps = { ...props };
    delete imageProps.priority;
    delete imageProps.fill;
    delete imageProps.sizes;
    delete imageProps.unoptimized;
    return createElement("img", imageProps);
  },
}));

const author = { id: "author-1", firstName: "Dylan", lastName: "Field", avatarUrl: null };
const makePost = (id: string, body: string): Post => ({
  id,
  body,
  visibility: "public",
  image: null,
  author,
  engagement: { likeCount: 0, commentCount: 0, likedByViewer: false },
  commentPreview: [],
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
});
const makeComment = (id: string, postId: string, body: string, depth: 0 | 1 = 0, parentId: string | null = null): Comment => ({
  id,
  postId,
  parentId,
  depth,
  body,
  author: { id: "comment-author", firstName: "Ava", lastName: "Thompson", avatarUrl: null },
  engagement: { likeCount: 0, replyCount: 0, likedByViewer: false },
  createdAt: "2026-07-14T00:00:00.000Z",
  updatedAt: "2026-07-14T00:00:00.000Z",
});

function renderFeed(children?: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{children ?? <FeedApp />}</QueryClientProvider>);
}

describe("feed cache and shell", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });
  afterEach(cleanup);

  it("prepends a created post and removes duplicates across every page", () => {
    const created = makePost("new", "New post");
    const data: InfiniteData<Page<Post>> = {
      pages: [
        { items: [makePost("old", "Old post")], nextCursor: "cursor" },
        { items: [created, makePost("older", "Older post")], nextCursor: null },
      ],
      pageParams: [undefined, "cursor"],
    };
    const result = prependPostToFeed(data, created);
    expect(result.pages[0]?.items.map(({ id }) => id)).toEqual(["new", "old"]);
    expect(result.pages.flatMap(({ items }) => items).filter(({ id }) => id === "new")).toHaveLength(1);
  });

  it("renders the desktop landmarks in left, main, right order", async () => {
    repository.list.mockResolvedValue({ items: [], nextCursor: null });
    const { container } = renderFeed();
    await screen.findByText("Your feed is quiet");
    const shell = container.querySelector(".feed-shell");
    expect(Array.from(shell?.children ?? []).map((element) => element.getAttribute("data-feed-region"))).toEqual(["left", "main", "right"]);
  });

  it("keeps the created post visible when the reconciliation refresh fails", async () => {
    const oldPost = makePost("old", "Existing post");
    const newPost = makePost("new", "A newly published post");
    repository.list.mockResolvedValueOnce({ items: [oldPost], nextCursor: null }).mockRejectedValueOnce(new Error("Refresh failed"));
    repository.create.mockResolvedValue(newPost);
    renderFeed();
    await screen.findByText("Existing post");
    fireEvent.change(screen.getByLabelText("Post text"), { target: { value: "A newly published post" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await screen.findByText("A newly published post");
    await screen.findByText("Some posts may be out of date.");
    expect(screen.getByText("Existing post")).toBeInTheDocument();
    expect(repository.create).toHaveBeenCalledWith({ body: "A newly published post", visibility: "public" });
  });

  it("keeps post likes wired through the rewritten card", async () => {
    const post = makePost("liked-post", "Like this post");
    const likedPost = { ...post, engagement: { ...post.engagement, likeCount: 1, likedByViewer: true } };
    repository.list.mockResolvedValueOnce({ items: [post], nextCursor: null }).mockResolvedValue({ items: [likedPost], nextCursor: null });
    repository.setPostLike.mockResolvedValue({ liked: true, likeCount: 1 });
    renderFeed();
    await screen.findByText("Like this post");
    fireEvent.click(screen.getByRole("button", { name: "Like" }));
    await waitFor(() => expect(repository.setPostLike).toHaveBeenCalledWith("liked-post", true));
    await screen.findByRole("button", { name: "Unlike" });
  });

  it("posts comments and replies through the rewritten thread controls", async () => {
    const root = { ...makeComment("comment-1", "thread-post", "A root comment"), engagement: { likeCount: 0, replyCount: 0, likedByViewer: false } };
    const reply = makeComment("reply-1", "thread-post", "A nested reply", 1, root.id);
    const post = { ...makePost("thread-post", "Discuss this post"), engagement: { likeCount: 0, commentCount: 1, likedByViewer: false }, commentPreview: [root] };
    repository.list.mockResolvedValue({ items: [post], nextCursor: null });
    repository.comments.mockResolvedValue({ items: [root], nextCursor: null });
    repository.addComment.mockResolvedValue(root);
    repository.replies.mockResolvedValueOnce({ items: [], nextCursor: null }).mockResolvedValue({ items: [reply], nextCursor: null });
    repository.addReply.mockResolvedValue(reply);
    renderFeed();
    await screen.findByText("A root comment");

    const commentInput = screen.getByRole("textbox", { name: "Write a comment" });
    fireEvent.change(commentInput, { target: { value: "A new top-level comment" } });
    fireEvent.click(within(commentInput.closest("form")!).getByRole("button", { name: "Post comment" }));
    await waitFor(() => expect(repository.addComment).toHaveBeenCalledWith("thread-post", "A new top-level comment"));

    fireEvent.click(await screen.findByRole("button", { name: "Reply" }));
    const replyInput = await screen.findByRole("textbox", { name: /Reply to Ava/ });
    fireEvent.change(replyInput, { target: { value: "A nested reply" } });
    fireEvent.click(within(replyInput.closest("form")!).getByRole("button", { name: "Post comment" }));
    await waitFor(() => expect(repository.addReply).toHaveBeenCalledWith("comment-1", "A nested reply"));
    await screen.findByText("A nested reply");
  });

  it("loads the next page of posts without replacing the timeline", async () => {
    repository.list
      .mockResolvedValueOnce({ items: [makePost("page-1", "First page post")], nextCursor: "cursor-2" })
      .mockResolvedValueOnce({ items: [makePost("page-2", "Second page post")], nextCursor: null });
    renderFeed();
    await screen.findByText("First page post");
    fireEvent.click(screen.getByRole("button", { name: "Load more posts" }));
    await screen.findByText("Second page post");
    expect(screen.getByText("First page post")).toBeInTheDocument();
    expect(repository.list).toHaveBeenLastCalledWith("cursor-2");
  });

  it("keeps an initial error inside the main timeline region", async () => {
    repository.list.mockRejectedValue(new Error("Feed unavailable"));
    const { container } = renderFeed();
    await screen.findByText("We could not load your feed.");
    const error = container.querySelector(".feed-error");
    expect(error?.closest("[data-feed-region]")?.getAttribute("data-feed-region")).toBe("main");
    expect(screen.getAllByLabelText("Stories")).toHaveLength(2);
  });
});
