"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import type { User } from "@/features/auth/types";
import { feedKeys, feedRepository } from "../repository";
import type { Comment, FeedUser, Liker, Page, Post, Visibility } from "../types";
import { uploadPostImage } from "../upload";

type IconName =
  | "bell"
  | "bookmark"
  | "calendar"
  | "chevron"
  | "comment"
  | "compass"
  | "dots"
  | "event"
  | "friends"
  | "heart"
  | "home"
  | "image"
  | "menu"
  | "message"
  | "moon"
  | "play"
  | "search"
  | "send"
  | "share"
  | "sun"
  | "users";

const fullName = (user: Pick<User, "firstName" | "lastName">) => `${user.firstName} ${user.lastName}`;

const relativeTime = (date: string) => {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(date)) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};

export function prependPostToFeed(
  data: InfiniteData<Page<Post>> | undefined,
  post: Post,
): InfiniteData<Page<Post>> {
  if (data === undefined || data.pages.length === 0) {
    return { pages: [{ items: [post], nextCursor: null }], pageParams: [undefined] };
  }

  const pages = data.pages.map((page, index) => ({
    ...page,
    items: index === 0
      ? [post, ...page.items.filter((item) => item.id !== post.id)]
      : page.items.filter((item) => item.id !== post.id),
  }));
  return { ...data, pages };
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  switch (name) {
    case "home": return <svg {...common}><path d="m3 10 9-8 9 8v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M9 22V12h6v10" /></svg>;
    case "friends": return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    case "bell": return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>;
    case "message": return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></svg>;
    case "search": return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>;
    case "chevron": return <svg {...common}><path d="m7 10 5 5 5-5" /></svg>;
    case "sun": return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.41M17.66 6.34l1.41-1.41" /></svg>;
    case "moon": return <svg {...common}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" /></svg>;
    case "users": return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4.58V20" /></svg>;
    case "calendar": return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></svg>;
    case "bookmark": return <svg {...common}><path d="M6 3h12v18l-6-4-6 4Z" /></svg>;
    case "compass": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z" /></svg>;
    case "event": return <svg {...common}><path d="M4 5h16v16H4zM8 3v4M16 3v4M4 10h16" /></svg>;
    case "image": return <svg {...common}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>;
    case "play": return <svg {...common}><path d="m8 5 11 7-11 7Z" /></svg>;
    case "send": return <svg {...common}><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>;
    case "heart": return <svg {...common}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l7.78-7.78a5.5 5.5 0 0 0 0-7.78Z" /></svg>;
    case "comment": return <svg {...common}><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /></svg>;
    case "share": return <svg {...common}><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></svg>;
    case "dots": return <svg {...common}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></svg>;
    case "menu": return <svg {...common}><path d="M4 6h16M4 12h16M4 18h16" /></svg>;
  }
}

function Avatar({ user, size = 42, className = "" }: { user: FeedUser; size?: number; className?: string }) {
  return user.avatarUrl
    ? <Image className={`feed-avatar ${className}`} src={user.avatarUrl} alt={`${fullName(user)}'s avatar`} width={size} height={size} />
    : <span className={`feed-avatar feed-avatar-fallback ${className}`} style={{ width: size, height: size }} aria-label={`${fullName(user)}'s avatar`}>{user.firstName[0]}{user.lastName[0]}</span>;
}

function DisabledButton({ children, className = "", label }: { children: React.ReactNode; className?: string; label: string }) {
  return <button type="button" className={className} aria-disabled="true" aria-label={label} onClick={(event) => event.preventDefault()}>{children}</button>;
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = localStorage.getItem("buddy-theme");
      const next = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(next);
      document.documentElement.dataset.theme = next ? "dark" : "light";
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    localStorage.setItem("buddy-theme", next ? "dark" : "light");
  };

  return <button type="button" className="feed-theme-toggle" role="switch" aria-checked={dark} aria-label="Use dark theme" onClick={toggle}><span><Icon name="sun" size={15} /></span><i className={dark ? "is-dark" : ""} /><span><Icon name="moon" size={14} /></span></button>;
}

function Header({ user }: { user: FeedUser }) {
  const auth = useAuth();
  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);

  const logout = async () => {
    await auth.logout();
    router.replace("/login");
  };

  return <>
    <header className="feed-header feed-desktop-header">
      <div className="feed-container feed-header-inner">
        <Image className="feed-logo" src="/assets/logo.svg" alt="BuddyScript" width={170} height={40} priority />
        <label className="feed-header-search"><Icon name="search" size={17} /><input type="search" placeholder="Input search text" aria-label="Search" /></label>
        <nav className="feed-primary-nav" aria-label="Primary navigation">
          <DisabledButton className="is-active" label="Home"><Icon name="home" /></DisabledButton>
          <DisabledButton label="Community"><Icon name="friends" /></DisabledButton>
          <DisabledButton label="Notifications"><Icon name="bell" /><b>6</b></DisabledButton>
          <DisabledButton label="Messages"><Icon name="message" /><b>2</b></DisabledButton>
        </nav>
        <div className="feed-profile-menu">
          <button type="button" onClick={() => setProfileOpen((value) => !value)} aria-expanded={profileOpen}><Avatar user={user} size={32} /><span>{user.firstName}</span><Icon name="chevron" size={15} /></button>
          {profileOpen && <div className="feed-profile-dropdown"><div><Avatar user={user} size={48} /><span><strong>{fullName(user)}</strong><small>BuddyScript member</small></span></div><button type="button" onClick={logout}>Log out</button></div>}
        </div>
      </div>
    </header>
    <header className="feed-mobile-header">
      <div className="feed-mobile-header-row">
        <Image className="feed-logo" src="/assets/logo.svg" alt="BuddyScript" width={155} height={36} priority />
        <div>
          <button type="button" aria-label="Toggle search" onClick={() => setMobileSearch((value) => !value)}><Icon name="search" /></button>
          <DisabledButton label="Open menu"><Icon name="menu" /></DisabledButton>
          <button type="button" className="feed-mobile-avatar" onClick={() => setProfileOpen((value) => !value)} aria-label="Open profile menu"><Avatar user={user} size={34} /></button>
        </div>
      </div>
      {mobileSearch && <label className="feed-mobile-search"><Icon name="search" size={16} /><input autoFocus type="search" placeholder="Input search text" aria-label="Search" /></label>}
      {profileOpen && <div className="feed-mobile-profile-dropdown"><strong>{fullName(user)}</strong><button type="button" onClick={logout}>Log out</button></div>}
    </header>
  </>;
}

const exploreItems: Array<{ icon: IconName; label: string; count?: number }> = [
  { icon: "compass", label: "Feed" },
  { icon: "users", label: "My community", count: 12 },
  { icon: "message", label: "Messages", count: 2 },
  { icon: "bell", label: "Notifications", count: 6 },
  { icon: "calendar", label: "Explore" },
  { icon: "bookmark", label: "Saved posts" },
];

const suggestedPeople = [
  { name: "Ryan Roslansky", role: "CEO of LinkedIn", asset: "people2.png" },
  { name: "Dylan Field", role: "CEO of Figma", asset: "people3.png" },
  { name: "Radovan SkillArena", role: "Founder & CEO", asset: "Avatar.png" },
];

function LeftSidebar() {
  return <aside className="feed-left-sidebar" data-feed-region="left" aria-label="Explore BuddyScript">
    <section className="feed-side-card feed-explore-card">
      <h2>Explore</h2>
      <nav>{exploreItems.map(({ icon, label, count }, index) => <DisabledButton key={label} className={index === 0 ? "is-active" : ""} label={label}><span><Icon name={icon} size={19} />{label}</span>{count !== undefined && <b>{count}</b>}</DisabledButton>)}</nav>
    </section>
    <section className="feed-side-card feed-suggest-card">
      <div className="feed-section-title"><h2>Suggested People</h2><DisabledButton label="See all suggested people">See All</DisabledButton></div>
      {suggestedPeople.map((person) => <div className="feed-person" key={person.name}><Image src={`/assets/${person.asset}`} alt="" width={40} height={40} /><span><strong>{person.name}</strong><small>{person.role}</small></span><DisabledButton label={`Follow ${person.name}`}>Follow</DisabledButton></div>)}
    </section>
    <section className="feed-side-card feed-event-card">
      <div className="feed-section-title"><h2>Events</h2><DisabledButton label="See all events">See All</DisabledButton></div>
      <Image src="/assets/feed_event1.png" alt="People at a design systems meetup" width={300} height={180} />
      <div className="feed-event-copy"><time dateTime="2026-07-18"><b>18</b>Jul</time><span><strong>Design systems meetup</strong><small>Saturday at 7:00 PM</small></span></div>
    </section>
  </aside>;
}

const stories = [
  { name: "Karim", asset: "card_ppl2.png" },
  { name: "Dylan", asset: "card_ppl3.png" },
  { name: "Ryan", asset: "card_ppl4.png" },
];

function Stories({ user }: { user: FeedUser }) {
  return <>
    <section className="feed-stories" aria-label="Stories">
      <DisabledButton className="feed-story feed-story-create" label="Create story"><Image src="/assets/card_ppl1.png" alt="" fill sizes="150px" /><span>+</span><small>Your Story</small></DisabledButton>
      {stories.map((story) => <DisabledButton className="feed-story" key={story.asset} label={`${story.name}'s story`}><Image src={`/assets/${story.asset}`} alt="" fill sizes="150px" /><small>{story.name}</small></DisabledButton>)}
      <DisabledButton className="feed-story-next" label="Show more stories"><Icon name="chevron" size={18} /></DisabledButton>
    </section>
    <section className="feed-mobile-stories" aria-label="Stories">
      <DisabledButton className="feed-mobile-story is-create" label="Create story"><span><Avatar user={user} size={56} /><i>+</i></span><small>Your Story</small></DisabledButton>
      {stories.map((story) => <DisabledButton className="feed-mobile-story" key={story.asset} label={`${story.name}'s story`}><span><Image src={`/assets/${story.asset}`} alt="" width={56} height={56} /></span><small>{story.name}</small></DisabledButton>)}
    </section>
  </>;
}

function Composer({ user }: { user: FeedUser }) {
  const client = useQueryClient();
  const inputId = useId();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
    abortRef.current?.abort();
  }, [preview]);

  const mutation = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      const image = file ? await uploadPostImage(file, setProgress, controller.signal) : undefined;
      return feedRepository.create({ ...(body.trim() ? { body: body.trim() } : {}), visibility, ...(image ? { image } : {}) });
    },
    onSuccess: (created) => {
      client.setQueryData<InfiniteData<Page<Post>>>(feedKeys.all, (data) => prependPostToFeed(data, created));
      setBody("");
      setFile(undefined);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(undefined);
      setProgress(0);
      setError("");
      void client.invalidateQueries({ queryKey: feedKeys.all });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Post creation failed."),
  });

  const choose = (selected?: File) => {
    setError("");
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 5_000_000) {
      setError("Choose a JPG, PNG, or WebP image smaller than 5 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
  };

  return <section className="feed-composer" aria-label="Create a post">
    <div className="feed-composer-top"><Avatar user={user} size={44} /><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write something ..." aria-label="Post text" maxLength={5000} /></div>
    {preview && <div className="feed-image-preview"><Image src={preview} alt="Selected post preview" width={700} height={400} unoptimized /><button type="button" aria-label="Remove selected image" onClick={() => { URL.revokeObjectURL(preview); setPreview(undefined); setFile(undefined); }}>×</button></div>}
    <div className="feed-composer-bottom">
      <div className="feed-composer-tools">
        <label htmlFor={inputId}><Icon name="image" size={18} /><span>Photo</span><input id={inputId} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choose(event.target.files?.[0])} /></label>
        <DisabledButton label="Add video"><Icon name="play" size={17} /><span>Video</span></DisabledButton>
        <DisabledButton label="Add event"><Icon name="event" size={17} /><span>Event</span></DisabledButton>
      </div>
      <label className="feed-visibility"><span className="sr-only">Post visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="public">Public</option><option value="private">Private</option></select></label>
      <button className="feed-post-button" type="button" disabled={mutation.isPending || (!body.trim() && !file)} onClick={() => mutation.mutate()}><Icon name="send" size={16} /><span>{mutation.isPending ? file && progress < 100 ? `${progress}%` : "Posting" : "Post"}</span></button>
    </div>
    {mutation.isPending && <button className="feed-cancel-upload" type="button" onClick={() => abortRef.current?.abort()}>Cancel</button>}
    {error && <p className="feed-composer-error" role="alert">{error}</p>}
  </section>;
}

function CommentForm({ placeholder, submit }: { placeholder: string; submit: (body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    setError("");
    try {
      await submit(body.trim());
      setBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Comment could not be posted.");
    } finally {
      setPending(false);
    }
  };

  return <form className="feed-comment-form" onSubmit={onSubmit}><input value={body} onChange={(event) => setBody(event.target.value)} placeholder={placeholder} aria-label={placeholder} /><button disabled={pending || !body.trim()} aria-label="Post comment"><Icon name="send" size={17} /></button>{error && <small role="alert">{error}</small>}</form>;
}

function CommentItem({ comment, showLikers }: { comment: Comment; showLikers: (commentId: string) => void }) {
  const client = useQueryClient();
  const [replying, setReplying] = useState(false);
  const replies = useInfiniteQuery({
    queryKey: feedKeys.replies(comment.id),
    queryFn: ({ pageParam }) => feedRepository.replies(comment.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: comment.depth === 0 && (replying || comment.engagement.replyCount > 0),
  });
  const reaction = useMutation({
    mutationFn: () => feedRepository.setCommentLike(comment.id, !comment.engagement.likedByViewer),
    onSuccess: () => client.invalidateQueries({ queryKey: comment.parentId ? feedKeys.replies(comment.parentId) : feedKeys.comments(comment.postId) }),
  });
  const add = async (body: string) => {
    await feedRepository.addReply(comment.id, body);
    await client.invalidateQueries({ queryKey: feedKeys.replies(comment.id) });
    setReplying(false);
  };

  return <div className={`feed-comment ${comment.depth ? "is-reply" : ""}`}><Avatar user={comment.author} size={36} /><div className="feed-comment-content"><div className="feed-comment-bubble"><strong>{fullName(comment.author)}</strong><p>{comment.body}</p></div><div className="feed-comment-actions"><button type="button" className={comment.engagement.likedByViewer ? "is-liked" : ""} onClick={() => reaction.mutate()}>{comment.engagement.likedByViewer ? "Unlike" : "Like"}</button>{comment.depth === 0 && <button type="button" onClick={() => setReplying((value) => !value)}>Reply</button>}<span>{relativeTime(comment.createdAt)}</span><button type="button" onClick={() => showLikers(comment.id)}><Icon name="heart" size={12} /> {comment.engagement.likeCount}</button></div>{comment.depth === 0 && <>{replies.data?.pages.flatMap((page) => page.items).map((reply) => <CommentItem key={reply.id} comment={reply} showLikers={showLikers} />)}{replies.hasNextPage && <button className="feed-inline-button" type="button" onClick={() => replies.fetchNextPage()}>Load more replies</button>}{replying && <CommentForm placeholder={`Reply to ${comment.author.firstName}…`} submit={add} />}</>}</div></div>;
}

function Comments({ post, user, showLikers }: { post: Post; user: FeedUser; showLikers: (commentId: string) => void }) {
  const client = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const comments = useInfiniteQuery({
    queryKey: feedKeys.comments(post.id),
    queryFn: ({ pageParam }) => feedRepository.comments(post.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: expanded,
  });
  const items = expanded ? comments.data?.pages.flatMap((page) => page.items) ?? [] : post.commentPreview;
  const add = async (body: string) => {
    await feedRepository.addComment(post.id, body);
    setExpanded(true);
    await Promise.all([
      client.invalidateQueries({ queryKey: feedKeys.comments(post.id) }),
      client.invalidateQueries({ queryKey: feedKeys.all }),
    ]);
  };

  return <div className="feed-comments">
    {post.engagement.commentCount > post.commentPreview.length && !expanded && <button type="button" className="feed-previous-comments" onClick={() => setExpanded(true)}>View all {post.engagement.commentCount} comments</button>}
    {comments.isLoading && <p className="feed-comments-loading">Loading comments…</p>}
    {items.map((comment) => <CommentItem key={comment.id} comment={comment} showLikers={showLikers} />)}
    {comments.hasNextPage && <button type="button" className="feed-inline-button" onClick={() => comments.fetchNextPage()}>Load more comments</button>}
    <div className="feed-comment-entry"><Avatar user={user} size={36} /><CommentForm placeholder="Write a comment" submit={add} /></div>
  </div>;
}

function LikersDialog({ target, close }: { target: { kind: "post" | "comment"; id: string }; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const query = useInfiniteQuery({
    queryKey: feedKeys.likers(target.kind, target.id),
    queryFn: ({ pageParam }) => target.kind === "post" ? feedRepository.postLikers(target.id, pageParam) : feedRepository.commentLikers(target.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  useEffect(() => ref.current?.showModal(), []);
  const users: Liker[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  return <dialog ref={ref} className="feed-likers-dialog" onClose={close}><div className="feed-dialog-title"><h2>Liked by</h2><button type="button" onClick={() => ref.current?.close()} aria-label="Close">×</button></div>{query.isLoading ? <p>Loading…</p> : users.length ? <ul>{users.map((user) => <li key={`${user.id}-${user.likedAt}`}><Avatar user={user} /><span><strong>{fullName(user)}</strong><small>BuddyScript member</small></span></li>)}</ul> : <p>No likes yet.</p>}{query.hasNextPage && <button className="feed-inline-button" onClick={() => query.fetchNextPage()}>Load more</button>}</dialog>;
}

function PostCard({ post, user, showLikers, showCommentLikers }: { post: Post; user: FeedUser; showLikers: () => void; showCommentLikers: (commentId: string) => void }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => feedRepository.setPostLike(post.id, !post.engagement.likedByViewer),
    onMutate: async () => {
      await client.cancelQueries({ queryKey: feedKeys.all });
      const previous = client.getQueryData<InfiniteData<Page<Post>>>(feedKeys.all);
      client.setQueryData<InfiniteData<Page<Post>>>(feedKeys.all, (data) => data && ({
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => item.id === post.id ? {
            ...item,
            engagement: {
              ...item.engagement,
              likedByViewer: !item.engagement.likedByViewer,
              likeCount: Math.max(0, item.engagement.likeCount + (item.engagement.likedByViewer ? -1 : 1)),
            },
          } : item),
        })),
      }));
      return previous;
    },
    onError: (_error, _variables, previous) => client.setQueryData(feedKeys.all, previous),
    onSettled: () => client.invalidateQueries({ queryKey: feedKeys.all }),
  });

  return <article className="feed-post-card">
    <header className="feed-post-head"><Avatar user={post.author} size={44} /><div><h2>{fullName(post.author)}</h2><p>{relativeTime(post.createdAt)} · {post.visibility === "public" ? "Public" : "Private"}</p></div><DisabledButton label="Post menu"><Icon name="dots" /></DisabledButton></header>
    {post.body && <p className="feed-post-body">{post.body}</p>}
    {post.image && <div className="feed-post-image"><Image src={post.image.secureUrl} alt="Image shared with this post" width={post.image.width} height={post.image.height} sizes="(max-width: 991px) 100vw, 636px" /></div>}
    <div className="feed-post-stats"><button type="button" onClick={showLikers}><span><Icon name="heart" size={12} /></span>{post.engagement.likeCount} {post.engagement.likeCount === 1 ? "person" : "people"}</button><span>{post.engagement.commentCount} Comments</span></div>
    <div className="feed-post-actions"><button type="button" disabled={mutation.isPending} className={post.engagement.likedByViewer ? "is-liked" : ""} onClick={() => mutation.mutate()}><Icon name="heart" size={18} />{post.engagement.likedByViewer ? "Unlike" : "Like"}</button><button type="button" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><Icon name="comment" size={18} />Comment</button><DisabledButton label="Share post"><Icon name="share" size={18} />Share</DisabledButton></div>
    <div id={`comment-${post.id}`} tabIndex={-1}><Comments post={post} user={user} showLikers={showCommentLikers} /></div>
  </article>;
}

function RightSidebar() {
  return <aside className="feed-right-sidebar" data-feed-region="right" aria-label="Community sidebar">
    <section className="feed-side-card feed-might-like">
      <div className="feed-section-title"><h2>You Might Like</h2><DisabledButton label="See all recommendations">See All</DisabledButton></div>
      <div className="feed-recommendation"><Image src="/assets/Avatar.png" alt="" width={52} height={52} /><span><strong>Radovan SkillArena</strong><small>Founder & CEO at Trophy</small></span></div>
      <div className="feed-recommendation-actions"><DisabledButton label="Ignore recommendation">Ignore</DisabledButton><DisabledButton className="is-primary" label="Follow Radovan SkillArena">Follow</DisabledButton></div>
    </section>
    <section className="feed-side-card feed-friends-card">
      <div className="feed-section-title"><h2>Your Friends</h2><DisabledButton label="See all friends">See All</DisabledButton></div>
      <label className="feed-friend-search"><Icon name="search" size={16} /><input type="search" placeholder="input search text" aria-label="Search friends" /></label>
      <div className="feed-friend-list">{[
        { name: "Steve Jobs", role: "CEO of Apple", asset: "people1.png", offline: true },
        { name: "Ryan Roslansky", role: "CEO of Linkedin", asset: "people2.png" },
        { name: "Dylan Field", role: "CEO of Figma", asset: "people3.png" },
        { name: "Karim Ahmed", role: "Product Designer", asset: "Avatar.png" },
      ].map((friend) => <div className="feed-friend-row" key={friend.name}><Image src={`/assets/${friend.asset}`} alt="" width={42} height={42} /><span><strong>{friend.name}</strong><small>{friend.role}</small></span>{friend.offline ? <time>5m</time> : <i aria-label="Online" />}</div>)}</div>
    </section>
  </aside>;
}

function MobileNavigation() {
  return <nav className="feed-mobile-navigation" aria-label="Mobile navigation"><DisabledButton className="is-active" label="Home"><Icon name="home" /></DisabledButton><DisabledButton label="Community"><Icon name="friends" /></DisabledButton><DisabledButton label="Notifications"><Icon name="bell" /><b>6</b></DisabledButton><DisabledButton label="Messages"><Icon name="message" /><b>2</b></DisabledButton></nav>;
}

export function FeedApp() {
  const auth = useAuth();
  const [likers, setLikers] = useState<{ kind: "post" | "comment"; id: string }>();
  const query = useInfiniteQuery({
    queryKey: feedKeys.all,
    queryFn: ({ pageParam }) => feedRepository.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: auth.status === "authenticated",
  });
  const posts = Array.from(new Map((query.data?.pages.flatMap((page) => page.items) ?? []).map((post) => [post.id, post])).values());
  const refresh = () => { void query.refetch(); };

  if (auth.status !== "authenticated") return null;

  return <div className="feed-app">
    <ThemeToggle />
    <Header user={auth.user} />
    <div className="feed-container feed-shell">
      <LeftSidebar />
      <main className="feed-main" data-feed-region="main">
        <Stories user={auth.user} />
        <Composer user={auth.user} />
        {query.isError && posts.length > 0 && <div className="feed-refresh-warning" role="status"><span>Some posts may be out of date.</span><button type="button" onClick={refresh}>Refresh</button></div>}
        {query.isPending && posts.length === 0 ? <div className="feed-loading" aria-label="Loading your feed"><span /><span /><span /><p>Loading your feed…</p></div>
          : query.isError && posts.length === 0 ? <div className="feed-error" role="alert"><p>We could not load your feed.</p><button type="button" onClick={refresh}>Try again</button></div>
            : posts.length ? <>{posts.map((post) => <PostCard key={post.id} post={post} user={auth.user} showLikers={() => setLikers({ kind: "post", id: post.id })} showCommentLikers={(id) => setLikers({ kind: "comment", id })} />)}{query.hasNextPage && <button className="feed-load-more" type="button" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? "Loading…" : "Load more posts"}</button>}</>
              : <div className="feed-empty"><h2>Your feed is quiet</h2><p>Create the first post.</p></div>}
      </main>
      <RightSidebar />
    </div>
    <MobileNavigation />
    {likers && <LikersDialog target={likers} close={() => setLikers(undefined)} />}
  </div>;
}
