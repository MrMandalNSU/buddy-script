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
import { FeedReferenceIcon, type FeedReferenceIconName } from "./FeedReferenceIcon";

type OpenOverlay = { kind: "notifications" | "profile" } | { kind: "post"; id: string };

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

  return <button type="button" className="feed-theme-toggle" role="switch" aria-checked={dark} aria-label="Use dark theme" onClick={toggle}><span><FeedReferenceIcon name="sun" /></span><i className={dark ? "is-dark" : ""} /><span><FeedReferenceIcon name="moon" /></span></button>;
}

const notifications = [
  { image: "friend-req.png", body: <><strong>Steve Jobs</strong> posted a link in your timeline.</> },
  { image: "profile-1.png", body: <>An admin changed the name of the group <strong>Freelacer usa</strong> to <strong>Freelacer usa</strong></> },
  { image: "friend-req.png", body: <><strong>Steve Jobs</strong> posted a link in your timeline.</> },
  { image: "profile-1.png", body: <>An admin changed the name of the group <strong>Freelacer usa</strong> to <strong>Freelacer usa</strong></> },
  { image: "friend-req.png", body: <><strong>Steve Jobs</strong> posted a link in your timeline.</> },
  { image: "profile-1.png", body: <>An admin changed the name of the group <strong>Freelacer usa</strong> to <strong>Freelacer usa</strong></> },
];

function ProfileDropdown({ user, logout }: { user: FeedUser; logout: () => Promise<void> }) {
  const rows: Array<{ label: string; icon: FeedReferenceIconName; action?: () => Promise<void> }> = [
    { label: "Settings", icon: "profileSettings" },
    { label: "Help & Support", icon: "help" },
    { label: "Log Out", icon: "logout", action: logout },
  ];
  return <div className="feed-profile-dropdown" role="menu" aria-label="Profile menu">
    <div className="feed-profile-dropdown-info"><Avatar user={user} size={54} /><span><strong>{fullName(user)}</strong><DisabledButton label="View Profile">View Profile</DisabledButton></span></div>
    <hr />
    <div className="feed-profile-dropdown-list">{rows.map((row) => row.action
      ? <button type="button" role="menuitem" key={row.label} onClick={() => void row.action?.()}><span><i><FeedReferenceIcon name={row.icon} /></i>{row.label}</span><FeedReferenceIcon name="chevronRight" /></button>
      : <DisabledButton className="feed-profile-dropdown-row" label={row.label} key={row.label}><span><i><FeedReferenceIcon name={row.icon} /></i>{row.label}</span><FeedReferenceIcon name="chevronRight" /></DisabledButton>)}</div>
  </div>;
}

function NotificationDropdown() {
  const [optionsOpen, setOptionsOpen] = useState(false);
  return <section className="feed-notification-dropdown" aria-label="Notifications panel">
    <header><h2>Notifications</h2><div className="feed-notification-options"><button type="button" aria-label="Notification options" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}><FeedReferenceIcon name="moreVertical" /></button>{optionsOpen && <div role="menu">{["Mark as all read", "Notifivations seetings", "Open Notifications"].map((label) => <DisabledButton label={label} key={label}>{label}</DisabledButton>)}</div>}</div></header>
    <div className="feed-notification-filters"><DisabledButton className="is-active" label="Show all notifications">All</DisabledButton><DisabledButton label="Show unread notifications">Unread</DisabledButton></div>
    <div className="feed-notification-list">{notifications.map((notification, index) => <article key={`${notification.image}-${index}`}><Image src={`/assets/${notification.image}`} alt="" width={56} height={56} /><div><p>{notification.body}</p><time>42 miniutes ago</time></div></article>)}</div>
  </section>;
}

function Header({ user, overlay, setOverlay }: { user: FeedUser; overlay?: OpenOverlay; setOverlay: (overlay?: OpenOverlay) => void }) {
  const auth = useAuth();
  const router = useRouter();
  const [mobileSearch, setMobileSearch] = useState(false);
  const profileOpen = overlay?.kind === "profile";
  const notificationsOpen = overlay?.kind === "notifications";

  const logout = async () => {
    await auth.logout();
    router.replace("/login");
  };

  return <>
    <header className="feed-header feed-desktop-header">
      <div className="feed-container feed-header-inner">
        <Image className="feed-logo" src="/assets/logo.svg" alt="BuddyScript" width={170} height={40} priority />
        <label className="feed-header-search"><FeedReferenceIcon name="search" /><input type="search" placeholder="input search text" aria-label="Search" /></label>
        <nav className="feed-primary-nav" aria-label="Primary navigation">
          <DisabledButton className="is-active" label="Home"><FeedReferenceIcon name="home" /></DisabledButton>
          <DisabledButton label="Friends"><FeedReferenceIcon name="friends" /></DisabledButton>
          <div className="feed-header-overlay-root" data-feed-overlay-root>
            <button type="button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setOverlay(notificationsOpen ? undefined : { kind: "notifications" })}><FeedReferenceIcon name="bell" /><b>6</b></button>
            {notificationsOpen && <NotificationDropdown />}
          </div>
          <DisabledButton label="Messages"><FeedReferenceIcon name="message" /><b>2</b></DisabledButton>
        </nav>
        <div className="feed-profile-menu" data-feed-overlay-root>
          <button type="button" onClick={() => setOverlay(profileOpen ? undefined : { kind: "profile" })} aria-label="Open profile menu" aria-expanded={profileOpen}><Avatar user={user} size={24} /><span>{fullName(user)}</span><FeedReferenceIcon name="chevron" /></button>
          {profileOpen && <ProfileDropdown user={user} logout={logout} />}
        </div>
      </div>
    </header>
    <header className="feed-mobile-header">
      <div className="feed-mobile-header-row">
        <Image className="feed-logo" src="/assets/logo.svg" alt="BuddyScript" width={155} height={36} priority />
        <div>
          <button type="button" aria-label="Toggle search" onClick={() => setMobileSearch((value) => !value)}><FeedReferenceIcon name="search" /></button>
          <DisabledButton label="Open menu"><FeedReferenceIcon name="menu" /></DisabledButton>
          <button type="button" className="feed-mobile-avatar" data-feed-overlay-root onClick={() => setOverlay(profileOpen ? undefined : { kind: "profile" })} aria-label="Open profile menu"><Avatar user={user} size={34} /></button>
        </div>
      </div>
      {mobileSearch && <label className="feed-mobile-search"><FeedReferenceIcon name="search" /><input autoFocus type="search" placeholder="input search text" aria-label="Search" /></label>}
      {profileOpen && <div className="feed-mobile-profile-dropdown" data-feed-overlay-root><ProfileDropdown user={user} logout={logout} /></div>}
    </header>
  </>;
}

const exploreItems: Array<{ icon: FeedReferenceIconName; label: string; isNew?: boolean }> = [
  { icon: "learning", label: "Learning", isNew: true },
  { icon: "insights", label: "Insights" },
  { icon: "findFriends", label: "Find friends" },
  { icon: "bookmark", label: "Bookmarks" },
  { icon: "group", label: "Group" },
  { icon: "gaming", label: "Gaming", isNew: true },
  { icon: "settings", label: "Settings" },
  { icon: "save", label: "Save post" },
];

const suggestedPeople = [
  { name: "Steve Jobs", role: "CEO of Apple", asset: "people1.png" },
  { name: "Ryan Roslansky", role: "CEO of LinkedIn", asset: "people2.png" },
  { name: "Dylan Field", role: "CEO of Figma", asset: "people3.png" },
];

function LeftSidebar() {
  return <aside className="feed-left-sidebar" data-feed-region="left" aria-label="Explore BuddyScript">
    <section className="feed-side-card feed-explore-card">
      <h2>Explore</h2>
      <nav>{exploreItems.map(({ icon, label, isNew }) => <DisabledButton key={label} label={label}><span><FeedReferenceIcon name={icon} />{label}</span>{isNew && <b>New</b>}</DisabledButton>)}</nav>
    </section>
    <section className="feed-side-card feed-suggest-card">
      <div className="feed-section-title"><h2>Suggested People</h2><DisabledButton label="See all suggested people">See All</DisabledButton></div>
      {suggestedPeople.map((person) => <div className="feed-person" key={person.name}><Image src={`/assets/${person.asset}`} alt="" width={40} height={40} /><span><strong>{person.name}</strong><small>{person.role}</small></span><DisabledButton label={`Connect with ${person.name}`}>Connect</DisabledButton></div>)}
    </section>
    <section className="feed-side-card feed-event-card">
      <div className="feed-section-title"><h2>Events</h2><DisabledButton label="See all events">See All</DisabledButton></div>
      {[0, 1].map((event) => <div className="feed-event-item" key={event}><Image src="/assets/feed_event1.png" alt="People at an event" width={300} height={180} /><div className="feed-event-copy"><time dateTime="2026-07-10"><b>10</b>Jul</time><strong>No more terrorism no more cry</strong></div><hr /><div className="feed-event-footer"><span>17 People Going</span><DisabledButton label="Mark event as going">Going</DisabledButton></div></div>)}
    </section>
  </aside>;
}

const stories = [
  { name: "Ryan Roslansky", asset: "card_ppl2.png" },
  { name: "Ryan Roslansky", asset: "card_ppl3.png" },
  { name: "Ryan Roslansky", asset: "card_ppl4.png" },
];

function Stories({ user }: { user: FeedUser }) {
  return <>
    <section className="feed-stories" aria-label="Stories">
      <DisabledButton className="feed-story feed-story-create" label="Create story"><Image src="/assets/card_ppl1.png" alt="" fill sizes="150px" priority /><span>+</span><small>Your Story</small></DisabledButton>
      {stories.map((story) => <DisabledButton className="feed-story" key={story.asset} label={`${story.name}'s story`}><Image src={`/assets/${story.asset}`} alt="" fill sizes="150px" /><Image className="feed-story-owner" src="/assets/mini_pic.png" alt="" width={30} height={30} /><small>{story.name}</small></DisabledButton>)}
      <DisabledButton className="feed-story-next" label="Show more stories"><span>→</span></DisabledButton>
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
    <div className="feed-composer-top"><Avatar user={user} size={44} /><textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write something ..." aria-label="Post text" maxLength={5000} /><FeedReferenceIcon name="pencil" /></div>
    {preview && <div className="feed-image-preview"><Image src={preview} alt="Selected post preview" width={700} height={400} unoptimized /><button type="button" aria-label="Remove selected image" onClick={() => { URL.revokeObjectURL(preview); setPreview(undefined); setFile(undefined); }}>×</button></div>}
    <div className="feed-composer-bottom">
      <div className="feed-composer-tools">
        <label htmlFor={inputId} role="button" tabIndex={0} aria-label="Add photo" onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") document.getElementById(inputId)?.click(); }}><FeedReferenceIcon name="image" /><span>Photo</span><input id={inputId} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choose(event.target.files?.[0])} /></label>
        <DisabledButton label="Add video"><FeedReferenceIcon name="video" /><span>Video</span></DisabledButton>
        <DisabledButton label="Add event"><FeedReferenceIcon name="event" /><span>Event</span></DisabledButton>
        <DisabledButton label="Add article"><FeedReferenceIcon name="article" /><span>Article</span></DisabledButton>
      </div>
      <label className="feed-visibility"><span className="sr-only">Post visibility</span><select value={visibility} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="public">Public</option><option value="private">Private</option></select></label>
      <button className="feed-post-button" type="button" aria-label="Post" disabled={mutation.isPending || (!body.trim() && !file)} onClick={() => mutation.mutate()}><FeedReferenceIcon name="post" /><span>{mutation.isPending ? file && progress < 100 ? `${progress}%` : "Posting" : "Post"}</span></button>
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

  return <form className="feed-comment-form" onSubmit={onSubmit}><input value={body} onChange={(event) => setBody(event.target.value)} placeholder={placeholder} aria-label={placeholder} /><div className="feed-comment-extras" aria-hidden="true"><FeedReferenceIcon name="microphone" /><FeedReferenceIcon name="image" /></div><button disabled={pending || !body.trim()} aria-label="Post comment"><FeedReferenceIcon name="post" /></button>{error && <small role="alert">{error}</small>}</form>;
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

  return <div className={`feed-comment ${comment.depth ? "is-reply" : ""}`}><Avatar user={comment.author} size={36} /><div className="feed-comment-content"><div className="feed-comment-bubble"><strong>{fullName(comment.author)}</strong><p>{comment.body}</p></div><div className="feed-comment-actions"><button type="button" className={comment.engagement.likedByViewer ? "is-liked" : ""} onClick={() => reaction.mutate()}>{comment.engagement.likedByViewer ? "Unlike" : "Like"}</button>{comment.depth === 0 && <button type="button" onClick={() => setReplying((value) => !value)}>Reply</button>}<span>{relativeTime(comment.createdAt)}</span><button type="button" onClick={() => showLikers(comment.id)}><span aria-hidden="true">♥</span> {comment.engagement.likeCount}</button></div>{comment.depth === 0 && <>{replies.data?.pages.flatMap((page) => page.items).map((reply) => <CommentItem key={reply.id} comment={reply} showLikers={showLikers} />)}{replies.hasNextPage && <button className="feed-inline-button" type="button" onClick={() => replies.fetchNextPage()}>Load more replies</button>}{replying && <CommentForm placeholder={`Reply to ${comment.author.firstName}…`} submit={add} />}</>}</div></div>;
}

const postMenuItems: Array<{ label: string; icon: FeedReferenceIconName }> = [
  { label: "Save Post", icon: "postSave" },
  { label: "Turn On Notification", icon: "bell" },
  { label: "Hide", icon: "hide" },
  { label: "Edit Post", icon: "edit" },
  { label: "Delete Post", icon: "delete" },
];

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

function PostCard({ post, user, showLikers, showCommentLikers, menuOpen, setOverlay }: { post: Post; user: FeedUser; showLikers: () => void; showCommentLikers: (commentId: string) => void; menuOpen: boolean; setOverlay: (overlay?: OpenOverlay) => void }) {
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
    <header className="feed-post-head"><Avatar user={post.author} size={44} /><div><h2>{fullName(post.author)}</h2><p>{relativeTime(post.createdAt)} · {post.visibility === "public" ? "Public" : "Private"}</p></div><div className="feed-post-menu-root" data-feed-overlay-root><button type="button" aria-label="Post menu" aria-expanded={menuOpen} onClick={() => setOverlay(menuOpen ? undefined : { kind: "post", id: post.id })}><FeedReferenceIcon name="moreVertical" /></button>{menuOpen && <div className="feed-post-menu" role="menu">{postMenuItems.map((item) => <DisabledButton className="feed-post-menu-item" label={item.label} key={item.label}><FeedReferenceIcon name={item.icon} />{item.label}</DisabledButton>)}</div>}</div></header>
    {post.body && <p className="feed-post-body">{post.body}</p>}
    {post.image && <div className="feed-post-image"><Image src={post.image.secureUrl} alt="Image shared with this post" width={post.image.width} height={post.image.height} sizes="(max-width: 991px) 100vw, 636px" /></div>}
    <div className="feed-post-stats"><button type="button" onClick={showLikers}><span className="feed-reaction-stack">{[1, 2, 3, 4, 5].map((asset) => <Image key={asset} src={`/assets/react_img${asset}.png`} alt="" width={24} height={24} />)}</span><strong>{post.engagement.likeCount}</strong></button><div><span>{post.engagement.commentCount} Comment</span><span>0 Share</span></div></div>
    <div className="feed-post-actions"><button type="button" disabled={mutation.isPending} className={post.engagement.likedByViewer ? "is-liked" : ""} onClick={() => mutation.mutate()}><FeedReferenceIcon name="reaction" />{post.engagement.likedByViewer ? "Unlike" : "Like"}</button><button type="button" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}><FeedReferenceIcon name="comment" />Comment</button><DisabledButton label="Share post"><FeedReferenceIcon name="share" />Share</DisabledButton></div>
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
      <label className="feed-friend-search"><FeedReferenceIcon name="search" /><input type="search" placeholder="input search text" aria-label="Search friends" /></label>
      <div className="feed-friend-list">{[
        { name: "Steve Jobs", role: "CEO of Apple", asset: "people1.png", offline: true },
        { name: "Ryan Roslansky", role: "CEO of Linkedin", asset: "people2.png" },
        { name: "Dylan Field", role: "CEO of Figma", asset: "people3.png" },
        { name: "Steve Jobs", role: "CEO of Apple", asset: "people1.png", offline: true },
        { name: "Ryan Roslansky", role: "CEO of Linkedin", asset: "people2.png" },
        { name: "Dylan Field", role: "CEO of Figma", asset: "people3.png" },
      ].map((friend, index) => <div className="feed-friend-row" key={`${friend.name}-${index}`}><Image src={`/assets/${friend.asset}`} alt="" width={42} height={42} /><span><strong>{friend.name}</strong><small>{friend.role}</small></span>{friend.offline ? <time>5 minute ago</time> : <i aria-label="Online" />}</div>)}</div>
    </section>
  </aside>;
}

function MobileNavigation() {
  return <nav className="feed-mobile-navigation" aria-label="Mobile navigation"><DisabledButton className="is-active" label="Home"><FeedReferenceIcon name="home" /></DisabledButton><DisabledButton label="Friends"><FeedReferenceIcon name="friends" /></DisabledButton><DisabledButton label="Notifications"><FeedReferenceIcon name="bell" /><b>6</b></DisabledButton><DisabledButton label="Messages"><FeedReferenceIcon name="message" /><b>2</b></DisabledButton></nav>;
}

export function FeedApp() {
  const auth = useAuth();
  const [likers, setLikers] = useState<{ kind: "post" | "comment"; id: string }>();
  const [overlay, setOverlay] = useState<OpenOverlay>();
  const query = useInfiniteQuery({
    queryKey: feedKeys.all,
    queryFn: ({ pageParam }) => feedRepository.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: auth.status === "authenticated",
  });
  const posts = Array.from(new Map((query.data?.pages.flatMap((page) => page.items) ?? []).map((post) => [post.id, post])).values());
  const refresh = () => { void query.refetch(); };

  useEffect(() => {
    const closeOnPointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("[data-feed-overlay-root]")) setOverlay(undefined);
    };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOverlay(undefined); };
    document.addEventListener("pointerdown", closeOnPointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  if (auth.status !== "authenticated") return null;

  return <div className="feed-app">
    <ThemeToggle />
    <Header user={auth.user} overlay={overlay} setOverlay={setOverlay} />
    <div className="feed-container feed-shell">
      <LeftSidebar />
      <main className="feed-main" data-feed-region="main">
        <Stories user={auth.user} />
        <Composer user={auth.user} />
        {query.isError && posts.length > 0 && <div className="feed-refresh-warning" role="status"><span>Some posts may be out of date.</span><button type="button" onClick={refresh}>Refresh</button></div>}
        {query.isPending && posts.length === 0 ? <div className="feed-loading" aria-label="Loading your feed"><span /><span /><span /><p>Loading your feed…</p></div>
          : query.isError && posts.length === 0 ? <div className="feed-error" role="alert"><p>We could not load your feed.</p><button type="button" onClick={refresh}>Try again</button></div>
            : posts.length ? <>{posts.map((post) => <PostCard key={post.id} post={post} user={auth.user} menuOpen={overlay?.kind === "post" && overlay.id === post.id} setOverlay={setOverlay} showLikers={() => setLikers({ kind: "post", id: post.id })} showCommentLikers={(id) => setLikers({ kind: "comment", id })} />)}{query.hasNextPage && <button className="feed-load-more" type="button" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? "Loading…" : "Load more posts"}</button>}</>
              : <div className="feed-empty"><h2>Your feed is quiet</h2><p>Create the first post.</p></div>}
      </main>
      <RightSidebar />
    </div>
    <MobileNavigation />
    {likers && <LikersDialog target={likers} close={() => setLikers(undefined)} />}
  </div>;
}
