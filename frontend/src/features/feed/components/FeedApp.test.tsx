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
  setPostReaction: vi.fn(),
  comments: vi.fn(),
  addComment: vi.fn(),
  replies: vi.fn(),
  addReply: vi.fn(),
  setCommentLike: vi.fn(),
  setCommentReaction: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
  postLikers: vi.fn(),
  commentLikers: vi.fn(),
  postReactors: vi.fn(),
  commentReactors: vi.fn(),
}));
const authMocks = vi.hoisted(() => ({ logout: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ replace: vi.fn() }));

vi.mock("../repository", () => ({
  feedRepository: repository,
  feedKeys: {
    all: ["feed"],
    comments: (postId: string) => ["comments", postId],
    replies: (commentId: string) => ["replies", commentId],
    likers: (kind: string, id: string) => ["likers", kind, id],
    reactors: (kind: string, id: string) => ["reactors", kind, id],
  },
}));
vi.mock("@/features/auth/AuthProvider", () => ({
  useAuth: () => ({
    status: "authenticated",
    user: { id: "viewer-1", firstName: "Alex", lastName: "Morgan", email: "alex@example.com", avatarUrl: null },
    logout: authMocks.logout,
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: routerMocks.replace }) }));
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
const emptyBreakdown = { like: 0, love: 0, care: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
const makePost = (id: string, body: string): Post => ({
  id,
  body,
  visibility: "public",
  image: null,
  author,
  engagement: { likeCount: 0, commentCount: 0, likedByViewer: false, reactionCount: 0, viewerReaction: null, reactionBreakdown: { ...emptyBreakdown } },
  reactionPreview: [],
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
  engagement: { likeCount: 0, replyCount: 0, likedByViewer: false, reactionCount: 0, viewerReaction: null, reactionBreakdown: { ...emptyBreakdown } },
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

  it("renders the exact reference Explore order and icon identifiers", async () => {
    repository.list.mockResolvedValue({ items: [], nextCursor: null });
    const { container } = renderFeed();
    await screen.findByText("Your feed is quiet");
    const buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(".feed-explore-card nav > button"));
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Learning", "Insights", "Find friends", "Bookmarks", "Group", "Gaming", "Settings", "Save post",
    ]);
    expect(buttons.map((button) => button.querySelector("svg")?.getAttribute("data-reference-icon"))).toEqual([
      "learning", "insights", "findFriends", "bookmark", "group", "gaming", "settings", "save",
    ]);
    expect(buttons.filter((button) => button.textContent?.includes("New")).map((button) => button.getAttribute("aria-label"))).toEqual(["Learning", "Gaming"]);
  });

  it("renders the exact header icon set, badges, and authenticated full name", async () => {
    repository.list.mockResolvedValue({ items: [], nextCursor: null });
    const { container } = renderFeed();
    await screen.findByText("Your feed is quiet");
    const header = container.querySelector<HTMLElement>(".feed-desktop-header")!;
    expect(Array.from(header.querySelectorAll(".feed-primary-nav > button svg, .feed-header-overlay-root > button svg")).map((icon) => icon.getAttribute("data-reference-icon"))).toEqual(["home", "friends", "bell", "message"]);
    expect(header.querySelector(".feed-primary-nav > button")?.classList.contains("is-active")).toBe(true);
    expect(within(header).getByText("Alex Morgan")).toBeInTheDocument();
    expect(within(header).getByText("6")).toBeInTheDocument();
    expect(within(header).getByText("2")).toBeInTheDocument();
  });

  it("recreates the profile menu and keeps logout functional", async () => {
    repository.list.mockResolvedValue({ items: [], nextCursor: null });
    const { container } = renderFeed();
    await screen.findByText("Your feed is quiet");
    const header = container.querySelector<HTMLElement>(".feed-desktop-header")!;
    fireEvent.click(within(header).getByRole("button", { name: "Open profile menu" }));
    const menu = within(header).getByRole("menu", { name: "Profile menu" });
    expect(within(menu).getByRole("button", { name: "View Profile" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Help & Support" })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Log Out" }));
    await waitFor(() => expect(authMocks.logout).toHaveBeenCalledOnce());
    expect(routerMocks.replace).toHaveBeenCalledWith("/login");
  });

  it("keeps notification, profile, and post menus mutually exclusive and dismissible", async () => {
    repository.list.mockResolvedValue({ items: [makePost("menu-post", "Menu post")], nextCursor: null });
    const { container } = renderFeed();
    await screen.findByText("Menu post");
    const header = container.querySelector<HTMLElement>(".feed-desktop-header")!;
    fireEvent.click(within(header).getByRole("button", { name: "Notifications" }));
    expect(within(header).getByRole("region", { name: "Notifications panel" })).toBeInTheDocument();
    fireEvent.click(within(header).getByRole("button", { name: "Notification options" }));
    expect(within(header).getByRole("button", { name: "Mark as all read" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(within(header).getByRole("button", { name: "Open profile menu" }));
    expect(within(header).queryByRole("region", { name: "Notifications panel" })).not.toBeInTheDocument();
    expect(within(header).getByRole("menu", { name: "Profile menu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Post menu" }));
    expect(within(header).queryByRole("menu", { name: "Profile menu" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save Post" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Turn On Notification" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Save Post" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Post menu" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("button", { name: "Save Post" })).not.toBeInTheDocument();
  });

  it("includes every reference composer action alongside visibility and Post", async () => {
    repository.list.mockResolvedValue({ items: [], nextCursor: null });
    const { container } = renderFeed();
    await screen.findByText("Your feed is quiet");
    const composer = container.querySelector<HTMLElement>(".feed-composer")!;
    expect(Array.from(composer.querySelectorAll(".feed-composer-tools svg")).map((icon) => icon.getAttribute("data-reference-icon"))).toEqual(["image", "video", "event", "article"]);
    expect(within(composer).getByRole("button", { name: "Add photo" })).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Add article" })).toBeInTheDocument();
    expect(within(composer).getByRole("combobox", { name: "Post visibility" })).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Post" })).toBeInTheDocument();
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

  it("opens all seven reactions and saves a typed post reaction", async () => {
    const post = makePost("liked-post", "Like this post");
    const lovedPost = { ...post, engagement: { ...post.engagement, likeCount: 1, likedByViewer: true, reactionCount: 1, viewerReaction: "love" as const, reactionBreakdown: { ...emptyBreakdown, love: 1 } } };
    repository.list.mockResolvedValueOnce({ items: [post], nextCursor: null }).mockResolvedValue({ items: [lovedPost], nextCursor: null });
    repository.setPostReaction.mockResolvedValue({ reactionCount: 1, viewerReaction: "love", reactionBreakdown: { ...emptyBreakdown, love: 1 }, reactionPreview: [] });
    renderFeed();
    await screen.findByText("Like this post");
    fireEvent.focus(screen.getByRole("button", { name: "Like" }));
    const picker = screen.getByRole("menu", { name: "Choose a reaction" });
    expect(within(picker).getAllByRole("menuitem").map((button) => button.getAttribute("aria-label"))).toEqual(["Like", "Love", "Care", "Haha", "Wow", "Sad", "Angry"]);
    fireEvent.click(within(picker).getByRole("menuitem", { name: "Love" }));
    await waitFor(() => expect(repository.setPostReaction).toHaveBeenCalledWith("liked-post", "love"));
    expect(await screen.findByRole("button", { name: "Love" })).toBeInTheDocument();
  });

  it("shows each active reaction type in a comment reaction preview", async () => {
    const comment = {
      ...makeComment("mixed-comment", "mixed-post", "A mixed reaction comment"),
      engagement: {
        ...makeComment("mixed-comment", "mixed-post", "").engagement,
        likeCount: 2,
        likedByViewer: true,
        reactionCount: 2,
        viewerReaction: "haha" as const,
        reactionBreakdown: { ...emptyBreakdown, like: 1, haha: 1 },
      },
    };
    const post = {
      ...makePost("mixed-post", "Mixed reactions"),
      commentPreview: [comment],
      engagement: { ...makePost("mixed-post", "").engagement, commentCount: 1 },
    };
    repository.list.mockResolvedValue({ items: [post], nextCursor: null });
    renderFeed();

    await screen.findByText("A mixed reaction comment");
    const summary = screen.getByRole("button", { name: "2 reactions: Like, Haha" });
    expect(Array.from(summary.querySelectorAll("[data-reaction-icon]")).map((icon) => icon.getAttribute("data-reaction-icon"))).toEqual(["like", "haha"]);
  });

  it("posts comments and replies through the rewritten thread controls", async () => {
    const root = makeComment("comment-1", "thread-post", "A root comment");
    const reply = makeComment("reply-1", "thread-post", "A nested reply", 1, root.id);
    const post = { ...makePost("thread-post", "Discuss this post"), engagement: { ...makePost("thread-post", "").engagement, commentCount: 1 }, commentPreview: [root] };
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

  it("lets a commenter edit and delete their own comment", async () => {
    const root = { ...makeComment("owned-comment", "owned-post", "Original comment"), author: { id: "viewer-1", firstName: "Alex", lastName: "Morgan", avatarUrl: null } };
    const post = { ...makePost("owned-post", "Owned thread"), commentPreview: [root], engagement: { ...makePost("owned-post", "").engagement, commentCount: 1 } };
    const updated = { ...root, body: "Updated comment", updatedAt: "2026-07-14T00:02:00.000Z" };
    repository.list.mockResolvedValueOnce({ items: [post], nextCursor: null }).mockResolvedValue({ items: [{ ...post, commentPreview: [updated] }], nextCursor: null });
    repository.updateComment.mockResolvedValue(updated);
    repository.deleteComment.mockResolvedValue(undefined);
    renderFeed();
    await screen.findByText("Original comment");
    fireEvent.click(screen.getByRole("button", { name: "Comment options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Edit comment" }), { target: { value: "Updated comment" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(repository.updateComment).toHaveBeenCalledWith("owned-comment", "Updated comment"));
    await screen.findByText("Updated comment");
    fireEvent.click(screen.getByRole("button", { name: "Comment options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Delete/ }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(repository.deleteComment).toHaveBeenCalledWith("owned-comment"));
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
