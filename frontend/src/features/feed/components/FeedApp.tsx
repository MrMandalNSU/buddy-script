"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useAuth } from "@/features/auth/AuthProvider";
import type { User } from "@/features/auth/types";
import { feedKeys, feedRepository } from "../repository";
import type { Comment, Engagement, FeedUser, Page, Post, ReactionType, Reactor, UpdatePostInput, Visibility } from "../types";
import { uploadPostImage } from "../upload";
import { FeedReferenceIcon, type FeedReferenceIconName } from "./FeedReferenceIcon";
import { FeedReactionIcon, reactionColor, reactionLabel, reactionOptions } from "./FeedReactionIcon";

type OpenOverlay =
  | { kind: "notifications" | "profile" }
  | { kind: "post" | "comment"; id: string }
  | { kind: "post-edit" | "post-audience" | "post-delete"; id: string }
  | { kind: "reaction"; target: "post" | "comment"; id: string };

type PostImageData = NonNullable<Post["image"]>;

const fullName = (user: Pick<User, "firstName" | "lastName">) => `${user.firstName} ${user.lastName}`;

export const relativeTime = (date: string, now = Date.now()) => {
  const timestamp = Date.parse(date);
  if (Number.isNaN(timestamp)) return "Just now";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1_000));
  if (seconds < 60) return "Just now";

  const format = (value: number, unit: string) => `${value} ${unit}${value === 1 ? "" : "s"} ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return format(minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format(hours, "hour");
  const days = Math.floor(hours / 24);
  if (days < 7) return format(days, "day");
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return format(weeks, "week");
  const months = Math.floor(days / 30);
  if (months < 12) return format(months, "month");
  return format(Math.floor(days / 365), "year");
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

function replacePostInFeed(data: InfiniteData<Page<Post>> | undefined, updated: Post) {
  if (data === undefined) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.map((post) => post.id === updated.id ? updated : post) })),
  };
}

function removePostFromFeed(data: InfiniteData<Page<Post>> | undefined, postId: string) {
  if (data === undefined) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.filter((post) => post.id !== postId) })),
  };
}

const reactionPreviewTypes = (engagement: Pick<Engagement, "reactionBreakdown">): ReactionType[] => {
  return reactionOptions
    .map((option, index) => ({ ...option, index, count: engagement.reactionBreakdown[option.type] }))
    .filter(({ count }) => count > 0)
    .sort((left, right) => right.count - left.count || left.index - right.index)
    .slice(0, 3)
    .map(({ type }) => type);
};

function withReaction<T extends { engagement: Engagement }>(item: T, next: ReactionType | null): T {
  const previous = item.engagement.viewerReaction;
  const breakdown = { ...item.engagement.reactionBreakdown };
  if (previous !== null) breakdown[previous] = Math.max(0, breakdown[previous] - 1);
  if (next !== null) breakdown[next] += 1;
  const delta = previous === null && next !== null ? 1 : previous !== null && next === null ? -1 : 0;
  const reactionCount = Math.max(0, item.engagement.reactionCount + delta);
  return {
    ...item,
    engagement: {
      ...item.engagement,
      reactionCount,
      likeCount: reactionCount,
      viewerReaction: next,
      likedByViewer: next !== null,
      reactionBreakdown: breakdown,
    },
  } as T;
}

function updatePostReaction(post: Post, next: ReactionType | null, user: FeedUser): Post {
  const updated = withReaction(post, next);
  const others = post.reactionPreview.filter(({ user: reactor }) => reactor.id !== user.id);
  return {
    ...updated,
    reactionPreview: next === null ? others : [{ user, reaction: next, reactedAt: new Date().toISOString() }, ...others].slice(0, 5),
  };
}

type CommentCacheSnapshot = {
  feed: InfiniteData<Page<Post>> | undefined;
  entries: Array<[QueryKey, unknown]>;
};

function snapshotCommentCaches(client: QueryClient): CommentCacheSnapshot {
  return {
    feed: client.getQueryData<InfiniteData<Page<Post>>>(feedKeys.all),
    entries: [
      ...client.getQueriesData({ queryKey: ["comments"] }),
      ...client.getQueriesData({ queryKey: ["replies"] }),
    ],
  };
}

function restoreCommentCaches(client: QueryClient, snapshot?: CommentCacheSnapshot) {
  if (snapshot === undefined) return;
  client.setQueryData(feedKeys.all, snapshot.feed);
  for (const [key, data] of snapshot.entries) client.setQueryData(key, data);
}

function updateCommentCaches(client: QueryClient, commentId: string, update: (comment: Comment) => Comment | null) {
  const updatePage = (data: InfiniteData<Page<Comment>> | undefined) => data === undefined ? data : ({
    ...data,
    pages: data.pages.map((page) => ({ ...page, items: page.items.flatMap((comment) => {
      if (comment.id !== commentId) return [comment];
      const next = update(comment);
      return next === null ? [] : [next];
    }) })),
  });
  client.setQueriesData<InfiniteData<Page<Comment>>>({ queryKey: ["comments"] }, updatePage);
  client.setQueriesData<InfiniteData<Page<Comment>>>({ queryKey: ["replies"] }, updatePage);
  client.setQueryData<InfiniteData<Page<Post>>>(feedKeys.all, (data) => data === undefined ? data : ({
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((post) => ({
        ...post,
        commentPreview: post.commentPreview.flatMap((comment) => {
          if (comment.id !== commentId) return [comment];
          const next = update(comment);
          return next === null ? [] : [next];
        }),
      })),
    })),
  }));
}

function optimisticallyDeleteComment(client: QueryClient, comment: Comment) {
  updateCommentCaches(client, comment.id, () => null);
  if (comment.parentId !== null) {
    updateCommentCaches(client, comment.parentId, (parent) => ({ ...parent, engagement: { ...parent.engagement, replyCount: Math.max(0, parent.engagement.replyCount - 1) } }));
  } else {
    client.setQueryData<InfiniteData<Page<Post>>>(feedKeys.all, (data) => data === undefined ? data : ({
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        items: page.items.map((post) => post.id === comment.postId ? { ...post, engagement: { ...post.engagement, commentCount: Math.max(0, post.engagement.commentCount - 1) } } : post),
      })),
    }));
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

const visibilityOptions: Array<{ value: Visibility; label: string; description: string }> = [
  { value: "public", label: "Public", description: "Everyone can see this" },
  { value: "private", label: "Private", description: "Only you can see this" },
];

function VisibilityIcon({ visibility }: { visibility: Visibility }) {
  if (visibility === "private") {
    return <svg className="feed-visibility-icon" viewBox="0 0 20 20" aria-hidden="true"><rect x="4" y="8.5" width="12" height="9" rx="2" /><path d="M6.75 8.5V6.25a3.25 3.25 0 0 1 6.5 0V8.5M10 12.25v1.75" /></svg>;
  }
  return <svg className="feed-visibility-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7.5" /><path d="M2.8 10h14.4M10 2.5c2 2.05 3.05 4.55 3.05 7.5S12 15.45 10 17.5C8 15.45 6.95 12.95 6.95 10S8 4.55 10 2.5Z" /></svg>;
}

function VisibilityPicker({ value, onChange }: { value: Visibility; onChange: (value: Visibility) => void }) {
  const [open, setOpen] = useState(false);
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = visibilityOptions.find((option) => option.value === value) ?? visibilityOptions[0];

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const selectedIndex = visibilityOptions.findIndex((option) => option.value === value);
    const frame = requestAnimationFrame(() => optionRefs.current[selectedIndex]?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, value]);

  const closeAndFocus = () => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const moveOptionFocus = (direction: 1 | -1) => {
    const currentIndex = optionRefs.current.findIndex((option) => option === document.activeElement);
    const nextIndex = (currentIndex + direction + visibilityOptions.length) % visibilityOptions.length;
    optionRefs.current[nextIndex]?.focus();
  };

  return <div className="feed-visibility" ref={rootRef}>
    <button
      ref={triggerRef}
      className="feed-visibility-trigger"
      type="button"
      role="combobox"
      aria-label="Post visibility"
      aria-controls={listboxId}
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={() => setOpen((current) => !current)}
      onKeyDown={(event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          setOpen(true);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setOpen(false);
        }
      }}
    >
      <VisibilityIcon visibility={value} />
      <span>{selected.label}</span>
      <FeedReferenceIcon className="feed-visibility-chevron" name="chevron" />
    </button>
    {open && <div id={listboxId} className="feed-visibility-menu" role="listbox" aria-label="Choose post visibility" onKeyDown={(event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        moveOptionFocus(event.key === "ArrowDown" ? 1 : -1);
      }
      if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        optionRefs.current[event.key === "Home" ? 0 : visibilityOptions.length - 1]?.focus();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeAndFocus();
      }
      if (event.key === "Tab") {
        setOpen(false);
      }
    }}>
      {visibilityOptions.map((option, index) => <button
        ref={(element) => { optionRefs.current[index] = element; }}
        type="button"
        role="option"
        aria-selected={value === option.value}
        className={value === option.value ? "is-selected" : ""}
        key={option.value}
        onClick={() => { onChange(option.value); closeAndFocus(); }}
      >
        <span className="feed-visibility-option-icon"><VisibilityIcon visibility={option.value} /></span>
        <span><strong>{option.label}</strong><small>{option.description}</small></span>
        <svg className="feed-visibility-check" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8.25 3.1 3.1L13 4.75" /></svg>
      </button>)}
    </div>}
  </div>;
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
      <VisibilityPicker value={visibility} onChange={setVisibility} />
      <button className="feed-post-button" type="button" aria-label="Post" disabled={mutation.isPending || (!body.trim() && !file)} onClick={() => mutation.mutate()}><FeedReferenceIcon name="post" /><span>{mutation.isPending ? file && progress < 100 ? `${progress}%` : "Posting" : "Post"}</span></button>
    </div>
    {error && <p className="feed-composer-error" role="alert">{error}</p>}
  </section>;
}

function CommentForm({ placeholder, submit, inputId }: { placeholder: string; submit: (body: string) => Promise<void>; inputId?: string }) {
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

  return <form className="feed-comment-form" onSubmit={onSubmit}><input id={inputId} value={body} onChange={(event) => setBody(event.target.value)} placeholder={placeholder} aria-label={placeholder} /><div className="feed-comment-extras" aria-hidden="true"><FeedReferenceIcon name="microphone" /><FeedReferenceIcon name="image" /></div><button disabled={pending || !body.trim()} aria-label="Post comment"><FeedReferenceIcon name="post" /></button>{error && <small role="alert">{error}</small>}</form>;
}

function ReactionControl({
  target, id, current, pending, compact = false, overlay, setOverlay, onToggle, onSelect,
}: {
  target: "post" | "comment";
  id: string;
  current: ReactionType | null;
  pending: boolean;
  compact?: boolean;
  overlay?: OpenOverlay;
  setOverlay: (overlay?: OpenOverlay) => void;
  onToggle: () => void;
  onSelect: (reaction: ReactionType) => void;
}) {
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const suppressClick = useRef(false);
  const open = overlay?.kind === "reaction" && overlay.target === target && overlay.id === id;
  const show = () => setOverlay({ kind: "reaction", target, id });
  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  useEffect(() => clearTimers, []);

  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "touch") return;
    longPressTimer.current = setTimeout(() => {
      suppressClick.current = true;
      show();
    }, 450);
  };
  const pointerUp = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };

  return <div
    className={`feed-reaction-control ${compact ? "is-compact" : ""}`}
    data-feed-overlay-root
    onPointerEnter={(event) => {
      if (event.pointerType === "touch") return;
      if (closeTimer.current) clearTimeout(closeTimer.current);
      openTimer.current = setTimeout(show, 300);
    }}
    onPointerLeave={(event) => {
      if (event.pointerType === "touch") return;
      if (openTimer.current) clearTimeout(openTimer.current);
      closeTimer.current = setTimeout(() => { if (open) setOverlay(undefined); }, 250);
    }}
  >
    {open && <div className="feed-reaction-picker" role="menu" aria-label="Choose a reaction">
      {reactionOptions.map((option) => <button type="button" role="menuitem" aria-label={option.label} title={option.label} key={option.type} onClick={() => onSelect(option.type)}><FeedReactionIcon name={option.type} size={compact ? 28 : 36} /><span>{option.label}</span></button>)}
    </div>}
    <button
      type="button"
      className={current === null ? "" : "is-reacted"}
      aria-haspopup="menu"
      aria-expanded={open}
      disabled={pending}
      style={current === null ? undefined : { color: reactionColor(current) }}
      onFocus={show}
      onPointerDown={pointerDown}
      onPointerUp={pointerUp}
      onPointerCancel={pointerUp}
      onClick={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          suppressClick.current = false;
          return;
        }
        onToggle();
      }}
    >{current === null ? compact ? null : <FeedReferenceIcon name="reaction" /> : <FeedReactionIcon name={current} size={compact ? 16 : 22} />}{reactionLabel(current)}</button>
  </div>;
}

function CommentDeleteDialog({ comment, pending, close, confirm }: { comment: Comment; pending: boolean; close: () => void; confirm: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = `delete-comment-${comment.id}`;
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.open = true;
  }, []);
  return <dialog ref={ref} className="feed-confirm-dialog" aria-labelledby={titleId} onClose={close}>
    <h2 id={titleId}>Delete comment?</h2>
    <p>{comment.depth === 0 && comment.engagement.replyCount > 0 ? "This comment and all of its replies will be permanently deleted." : "This comment will be permanently deleted."}</p>
    <div><button type="button" onClick={() => { if (typeof ref.current?.close === "function") ref.current.close(); else close(); }} disabled={pending}>Cancel</button><button className="is-danger" type="button" onClick={confirm} disabled={pending}>{pending ? "Deleting…" : "Delete"}</button></div>
  </dialog>;
}

function CommentItem({ comment, viewer, postAuthorId, overlay, setOverlay, showReactors }: { comment: Comment; viewer: FeedUser; postAuthorId: string; overlay?: OpenOverlay; setOverlay: (overlay?: OpenOverlay) => void; showReactors: (commentId: string) => void }) {
  const client = useQueryClient();
  const [replying, setReplying] = useState(false);
  const [repliesExpanded, setRepliesExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const menuOpen = overlay?.kind === "comment" && overlay.id === comment.id;
  const canEdit = viewer.id === comment.author.id;
  const canDelete = canEdit || viewer.id === postAuthorId;
  const replies = useInfiniteQuery({
    queryKey: feedKeys.replies(comment.id),
    queryFn: ({ pageParam }) => feedRepository.replies(comment.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: comment.depth === 0 && (replying || comment.engagement.replyCount > 0),
  });
  const reaction = useMutation({
    mutationFn: (next: ReactionType | null) => feedRepository.setCommentReaction(comment.id, next),
    onMutate: async (next) => {
      await Promise.all([client.cancelQueries({ queryKey: feedKeys.all }), client.cancelQueries({ queryKey: ["comments"] }), client.cancelQueries({ queryKey: ["replies"] })]);
      const snapshot = snapshotCommentCaches(client);
      updateCommentCaches(client, comment.id, (current) => withReaction(current, next));
      return snapshot;
    },
    onError: (cause, _next, snapshot) => {
      restoreCommentCaches(client, snapshot);
      setError(cause instanceof Error ? cause.message : "Reaction could not be saved.");
    },
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: feedKeys.all }),
      client.invalidateQueries({ queryKey: comment.parentId ? feedKeys.replies(comment.parentId) : feedKeys.comments(comment.postId) }),
    ]),
  });
  const edit = useMutation({
    mutationFn: (body: string) => feedRepository.updateComment(comment.id, body),
    onMutate: async (body) => {
      const snapshot = snapshotCommentCaches(client);
      updateCommentCaches(client, comment.id, (current) => ({ ...current, body, updatedAt: new Date().toISOString() }));
      return snapshot;
    },
    onSuccess: (updated) => {
      updateCommentCaches(client, comment.id, () => updated);
      setEditing(false);
      setError("");
      setOverlay(undefined);
    },
    onError: (cause, _body, snapshot) => {
      restoreCommentCaches(client, snapshot);
      setError(cause instanceof Error ? cause.message : "Comment could not be updated.");
    },
    onSettled: () => client.invalidateQueries({ queryKey: feedKeys.all }),
  });
  const deletion = useMutation({
    mutationFn: () => feedRepository.deleteComment(comment.id),
    onMutate: async () => {
      const snapshot = snapshotCommentCaches(client);
      optimisticallyDeleteComment(client, comment);
      return snapshot;
    },
    onSuccess: () => {
      setConfirming(false);
      setOverlay(undefined);
      client.removeQueries({ queryKey: feedKeys.replies(comment.id) });
    },
    onError: (cause, _variables, snapshot) => {
      restoreCommentCaches(client, snapshot);
      setConfirming(false);
      setError(cause instanceof Error ? cause.message : "Comment could not be deleted.");
    },
    onSettled: () => Promise.all([
      client.invalidateQueries({ queryKey: feedKeys.all }),
      client.invalidateQueries({ queryKey: feedKeys.comments(comment.postId) }),
      ...(comment.parentId === null ? [] : [client.invalidateQueries({ queryKey: feedKeys.replies(comment.parentId) })]),
    ]),
  });
  const add = async (body: string) => {
    await feedRepository.addReply(comment.id, body);
    setRepliesExpanded(true);
    await client.invalidateQueries({ queryKey: feedKeys.replies(comment.id) });
    setReplying(false);
  };

  const save = () => {
    const body = draft.trim();
    if (body && body !== comment.body) edit.mutate(body);
    else setEditing(false);
  };
  const editKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") { setDraft(comment.body); setEditing(false); }
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); save(); }
  };

  const previewReactions = reactionPreviewTypes(comment.engagement);
  const allReplies = replies.data?.pages.flatMap((page) => page.items) ?? [];
  const visibleReplies = repliesExpanded ? allReplies : allReplies.slice(0, 1);

  return <div className={`feed-comment ${comment.depth ? "is-reply" : ""}`}><Avatar user={comment.author} size={36} /><div className="feed-comment-content"><div className="feed-comment-bubble">
    <strong>{fullName(comment.author)}</strong>
    {editing ? <form className="feed-comment-edit" onSubmit={(event) => { event.preventDefault(); save(); }}><textarea autoFocus aria-label="Edit comment" maxLength={2000} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={editKeyDown} /><div><button type="button" onClick={() => { setDraft(comment.body); setEditing(false); }}>Cancel</button><button type="submit" disabled={edit.isPending || !draft.trim()}>Save</button></div></form> : <p>{comment.body}</p>}
    {canDelete && !editing && <div className="feed-comment-menu-root" data-feed-overlay-root><button type="button" aria-label="Comment options" aria-expanded={menuOpen} onClick={() => setOverlay(menuOpen ? undefined : { kind: "comment", id: comment.id })}><FeedReferenceIcon name="moreVertical" /></button>{menuOpen && <div className="feed-comment-menu" role="menu">{canEdit && <button type="button" role="menuitem" onClick={() => { setDraft(comment.body); setEditing(true); setOverlay(undefined); }}><FeedReferenceIcon name="edit" />Edit</button>}<button type="button" role="menuitem" onClick={() => { setConfirming(true); setOverlay(undefined); }}><FeedReferenceIcon name="delete" />Delete</button></div>}</div>}
  </div><div className="feed-comment-actions"><ReactionControl target="comment" id={comment.id} current={comment.engagement.viewerReaction} pending={reaction.isPending} compact overlay={overlay} setOverlay={setOverlay} onToggle={() => reaction.mutate(comment.engagement.viewerReaction === null ? "like" : null)} onSelect={(next) => { reaction.mutate(next); setOverlay(undefined); }} />{comment.depth === 0 && <button type="button" onClick={() => setReplying((value) => !value)}>Reply</button>}<span>{relativeTime(comment.createdAt)}</span><button type="button" className="feed-comment-reaction-summary" disabled={comment.engagement.reactionCount === 0} aria-label={`${comment.engagement.reactionCount} reactions${previewReactions.length ? `: ${previewReactions.map((type) => reactionLabel(type)).join(", ")}` : ""}`} onClick={() => showReactors(comment.id)}><span className="feed-comment-reaction-icons" aria-hidden="true">{previewReactions.map((type) => <FeedReactionIcon key={type} name={type} size={14} />)}</span><span>{comment.engagement.reactionCount}</span></button></div>{error && <p className="feed-comment-error" role="alert">{error}</p>}{comment.depth === 0 && <>{comment.engagement.replyCount > 1 && !repliesExpanded && <button className="feed-inline-button feed-view-replies" type="button" aria-expanded="false" onClick={() => setRepliesExpanded(true)}>View all {comment.engagement.replyCount} replies</button>}{visibleReplies.map((reply) => <CommentItem key={reply.id} comment={reply} viewer={viewer} postAuthorId={postAuthorId} overlay={overlay} setOverlay={setOverlay} showReactors={showReactors} />)}{repliesExpanded && replies.hasNextPage && <button className="feed-inline-button feed-view-replies" type="button" onClick={() => replies.fetchNextPage()}>Load more replies</button>}{replying && <CommentForm placeholder={`Reply to ${comment.author.firstName}…`} submit={add} />}</>}</div>{confirming && <CommentDeleteDialog comment={comment} pending={deletion.isPending} close={() => setConfirming(false)} confirm={() => deletion.mutate()} />}</div>;
}

function PostEditDialog({ post, close }: { post: Post; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputId = useId();
  const client = useQueryClient();
  const [body, setBody] = useState(post.body ?? "");
  const [file, setFile] = useState<File>();
  const [preview, setPreview] = useState<string>();
  const [imageRemoved, setImageRemoved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | undefined>(undefined);
  const normalizedBody = body.trim();
  const bodyChanged = normalizedBody !== (post.body ?? "");
  const imageChanged = file !== undefined || (imageRemoved && post.image !== null);
  const finalHasImage = file !== undefined || (!imageRemoved && post.image !== null);
  const imageUrl = preview ?? (imageRemoved ? undefined : post.image?.secureUrl);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.open = true;
  }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const mutation = useMutation({
    mutationFn: async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      let image: UpdatePostInput["image"] | undefined;
      if (file !== undefined) image = await uploadPostImage(file, setProgress, controller.signal);
      else if (imageRemoved && post.image !== null) image = null;
      const input: UpdatePostInput = {
        ...(bodyChanged ? { body: normalizedBody || null } : {}),
        ...(imageChanged ? { image } : {}),
      };
      return feedRepository.update(post.id, input, controller.signal);
    },
    onSuccess: (updated) => {
      client.setQueryData<InfiniteData<Page<Post>>>(feedKeys.all, (data) => replacePostInFeed(data, updated));
      setError("");
      void client.invalidateQueries({ queryKey: feedKeys.all });
      close();
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Post could not be updated."),
  });

  const choose = (selected?: File) => {
    setError("");
    if (selected === undefined) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type) || selected.size > 5_000_000) {
      setError("Choose a JPG, PNG, or WebP image smaller than 5 MB.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selected);
    setPreview(URL.createObjectURL(selected));
    setImageRemoved(false);
    setProgress(0);
  };
  const removeImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(undefined);
    setFile(undefined);
    setImageRemoved(true);
    setProgress(0);
  };

  return <dialog ref={ref} className="feed-post-edit-dialog" data-feed-overlay-root aria-labelledby={`edit-post-${post.id}`} onClose={close}>
    <form onSubmit={(event) => { event.preventDefault(); if (!mutation.isPending) mutation.mutate(); }}>
      <div className="feed-dialog-title"><h2 id={`edit-post-${post.id}`}>Edit Post</h2><button type="button" onClick={close} disabled={mutation.isPending} aria-label="Close">×</button></div>
      <label className="feed-post-edit-body"><span>Post text</span><textarea aria-label="Edit post text" value={body} maxLength={5000} onChange={(event) => setBody(event.target.value)} /></label>
      {imageUrl && <div className="feed-post-edit-image"><Image src={imageUrl} alt="Post image preview" width={700} height={400} unoptimized={preview !== undefined} /></div>}
      <div className="feed-post-edit-media"><label htmlFor={inputId} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") document.getElementById(inputId)?.click(); }}><FeedReferenceIcon name="image" />{imageUrl ? "Replace photo" : "Add photo"}<input id={inputId} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choose(event.target.files?.[0])} /></label>{imageUrl && <button type="button" onClick={removeImage}><FeedReferenceIcon name="delete" />Remove photo</button>}</div>
      {mutation.isPending && file && <div className="feed-post-upload-progress"><span style={{ width: `${progress}%` }} /><strong>{progress}%</strong></div>}
      {error && <p className="feed-post-dialog-error" role="alert">{error}</p>}
      {!normalizedBody && !finalHasImage && <p className="feed-post-dialog-error">Post text or image is required.</p>}
      <div className="feed-post-dialog-actions"><button type="button" onClick={() => mutation.isPending ? abortRef.current?.abort() : close()}>{mutation.isPending ? "Cancel upload" : "Cancel"}</button><button type="submit" className="is-primary" disabled={mutation.isPending || (!bodyChanged && !imageChanged) || (!normalizedBody && !finalHasImage)}>{mutation.isPending ? file && progress < 100 ? `Uploading ${progress}%` : "Saving…" : "Save"}</button></div>
    </form>
  </dialog>;
}

function PostAudienceDialog({ post, close }: { post: Post; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [visibility, setVisibility] = useState<Visibility>(post.visibility);
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.open = true;
  }, []);
  const mutation = useMutation({
    mutationFn: () => feedRepository.update(post.id, { visibility }),
    onSuccess: (updated) => {
      client.setQueryData<InfiniteData<Page<Post>>>(feedKeys.all, (data) => replacePostInFeed(data, updated));
      void client.invalidateQueries({ queryKey: feedKeys.all });
      close();
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Audience could not be changed."),
  });
  return <dialog ref={ref} className="feed-post-audience-dialog" data-feed-overlay-root aria-labelledby={`audience-post-${post.id}`} onClose={close}>
    <form onSubmit={(event) => { event.preventDefault(); mutation.mutate(); }}>
      <div className="feed-dialog-title"><h2 id={`audience-post-${post.id}`}>Change audience</h2><button type="button" onClick={close} disabled={mutation.isPending} aria-label="Close">×</button></div>
      <p>Choose who can see this post.</p>
      <label className={visibility === "public" ? "is-selected" : ""}><input type="radio" name={`audience-${post.id}`} value="public" checked={visibility === "public"} onChange={() => setVisibility("public")} /><span><strong>Public</strong><small>Anyone in the community can see this post.</small></span></label>
      <label className={visibility === "private" ? "is-selected" : ""}><input type="radio" name={`audience-${post.id}`} value="private" checked={visibility === "private"} onChange={() => setVisibility("private")} /><span><strong>Private</strong><small>Only you can see this post.</small></span></label>
      {error && <p className="feed-post-dialog-error" role="alert">{error}</p>}
      <div className="feed-post-dialog-actions"><button type="button" onClick={close} disabled={mutation.isPending}>Cancel</button><button type="submit" className="is-primary" disabled={mutation.isPending || visibility === post.visibility}>{mutation.isPending ? "Saving…" : "Save"}</button></div>
    </form>
  </dialog>;
}

function PostDeleteDialog({ post, close }: { post: Post; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const client = useQueryClient();
  const [error, setError] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.open = true;
  }, []);
  const mutation = useMutation({
    mutationFn: () => feedRepository.delete(post.id),
    onSuccess: () => {
      client.setQueryData<InfiniteData<Page<Post>>>(feedKeys.all, (data) => removePostFromFeed(data, post.id));
      client.removeQueries({ queryKey: feedKeys.comments(post.id), exact: true });
      client.removeQueries({ queryKey: feedKeys.reactors("post", post.id), exact: true });
      client.removeQueries({ queryKey: ["replies"] });
      client.removeQueries({ queryKey: ["reactors", "comment"] });
      void client.invalidateQueries({ queryKey: feedKeys.all });
      close();
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Post could not be deleted."),
  });
  return <dialog ref={ref} className="feed-confirm-dialog" data-feed-overlay-root aria-labelledby={`delete-post-${post.id}`} onClose={close}>
    <h2 id={`delete-post-${post.id}`}>Delete post?</h2>
    <p>This post, its comments, replies, and reactions will be permanently deleted.</p>
    {error && <p className="feed-post-dialog-error" role="alert">{error}</p>}
    <div><button type="button" onClick={close} disabled={mutation.isPending}>Cancel</button><button className="is-danger" type="button" onClick={() => mutation.mutate()} disabled={mutation.isPending}>{mutation.isPending ? "Deleting…" : "Delete"}</button></div>
  </dialog>;
}

const postMenuItems: Array<{ label: string; icon: FeedReferenceIconName }> = [
  { label: "Save Post", icon: "postSave" },
  { label: "Turn On Notification", icon: "bell" },
  { label: "Hide", icon: "hide" },
];

function Comments({ post, user, inputId, overlay, setOverlay, showReactors }: { post: Post; user: FeedUser; inputId: string; overlay?: OpenOverlay; setOverlay: (overlay?: OpenOverlay) => void; showReactors: (commentId: string) => void }) {
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
    <div className="feed-comment-entry feed-comment-entry--root"><Avatar user={user} size={36} /><CommentForm inputId={inputId} placeholder="Write a comment" submit={add} /></div>
    {post.engagement.commentCount > post.commentPreview.length && !expanded && <button type="button" className="feed-previous-comments" onClick={() => setExpanded(true)}>View all {post.engagement.commentCount} comments</button>}
    {comments.isLoading && <p className="feed-comments-loading">Loading comments…</p>}
    {items.map((comment) => <CommentItem key={comment.id} comment={comment} viewer={user} postAuthorId={post.author.id} overlay={overlay} setOverlay={setOverlay} showReactors={showReactors} />)}
    {comments.hasNextPage && <button type="button" className="feed-inline-button" onClick={() => comments.fetchNextPage()}>Load more comments</button>}
  </div>;
}

function ReactorsDialog({ target, close }: { target: { kind: "post" | "comment"; id: string }; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const query = useInfiniteQuery({
    queryKey: feedKeys.reactors(target.kind, target.id),
    queryFn: ({ pageParam }) => target.kind === "post" ? feedRepository.postReactors(target.id, pageParam) : feedRepository.commentReactors(target.id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.open = true;
  }, []);
  const reactors: Reactor[] = query.data?.pages.flatMap((page) => page.items) ?? [];

  return <dialog ref={ref} className="feed-likers-dialog" aria-labelledby="feed-reactions-title" onClose={close}><div className="feed-dialog-title"><h2 id="feed-reactions-title">Reactions</h2><button type="button" onClick={() => { if (typeof ref.current?.close === "function") ref.current.close(); else close(); }} aria-label="Close">×</button></div>{query.isLoading ? <p>Loading…</p> : reactors.length ? <ul>{reactors.map((reactor) => <li key={`${reactor.user.id}-${reactor.reactedAt}`}><div className="feed-reactor-avatar"><Avatar user={reactor.user} /><FeedReactionIcon name={reactor.reaction} size={18} /></div><span><strong>{fullName(reactor.user)}</strong><small>{reactionLabel(reactor.reaction)}</small></span></li>)}</ul> : <p>No reactions yet.</p>}{query.hasNextPage && <button className="feed-inline-button" onClick={() => query.fetchNextPage()}>Load more</button>}</dialog>;
}

function PostImage({ image, eager }: { image: PostImageData; eager: boolean }) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");

  return <div className={`feed-post-image is-${state}`} data-state={state} aria-busy={state === "loading"} style={{ aspectRatio: `${image.width} / ${image.height}` }}>
    {state === "loading" && <span className="feed-post-image-skeleton" aria-hidden="true" />}
    <Image className="feed-post-image-asset" src={image.secureUrl} alt="Image shared with this post" width={image.width} height={image.height} sizes="(max-width: 991px) 100vw, 636px" loading={eager ? "eager" : "lazy"} onLoad={() => setState("loaded")} onError={() => setState("error")} />
    {state === "error" && <div className="feed-post-image-fallback" role="status"><FeedReferenceIcon name="image" /><span>Image could not be loaded.</span></div>}
  </div>;
}

function PostCard({ post, user, eagerImage, showReactors, showCommentReactors, menuOpen, overlay, setOverlay }: { post: Post; user: FeedUser; eagerImage: boolean; showReactors: () => void; showCommentReactors: (commentId: string) => void; menuOpen: boolean; overlay?: OpenOverlay; setOverlay: (overlay?: OpenOverlay) => void }) {
  const client = useQueryClient();
  const isAuthor = post.author.id === user.id;
  const commentInputId = `comment-input-${post.id}`;
  const mutation = useMutation({
    mutationFn: (next: ReactionType | null) => feedRepository.setPostReaction(post.id, next),
    onMutate: async (next) => {
      await client.cancelQueries({ queryKey: feedKeys.all });
      const previous = client.getQueryData<InfiniteData<Page<Post>>>(feedKeys.all);
      client.setQueryData<InfiniteData<Page<Post>>>(feedKeys.all, (data) => data && ({
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => item.id === post.id ? updatePostReaction(item, next, user) : item),
        })),
      }));
      return previous;
    },
    onError: (_error, _variables, previous) => client.setQueryData(feedKeys.all, previous),
    onSettled: () => client.invalidateQueries({ queryKey: feedKeys.all }),
  });

  return <article className="feed-post-card">
    <header className="feed-post-head"><Avatar user={post.author} size={44} /><div><h2>{fullName(post.author)}</h2><p>{relativeTime(post.createdAt)} · {isAuthor ? <button type="button" className="feed-post-audience-button" onClick={() => setOverlay({ kind: "post-audience", id: post.id })}>{post.visibility === "public" ? "Public" : "Private"}</button> : <span>{post.visibility === "public" ? "Public" : "Private"}</span>}</p></div><div className="feed-post-menu-root" data-feed-overlay-root><button type="button" aria-label="Post menu" aria-expanded={menuOpen} onClick={() => setOverlay(menuOpen ? undefined : { kind: "post", id: post.id })}><FeedReferenceIcon name="moreVertical" /></button>{menuOpen && <div className="feed-post-menu" role="menu">{postMenuItems.map((item) => <DisabledButton className="feed-post-menu-item" label={item.label} key={item.label}><FeedReferenceIcon name={item.icon} />{item.label}</DisabledButton>)}{isAuthor && <><button type="button" role="menuitem" className="feed-post-menu-item" onClick={() => setOverlay({ kind: "post-edit", id: post.id })}><FeedReferenceIcon name="edit" />Edit Post</button><button type="button" role="menuitem" className="feed-post-menu-item" onClick={() => setOverlay({ kind: "post-delete", id: post.id })}><FeedReferenceIcon name="delete" />Delete Post</button></>}</div>}</div></header>
    {post.body && <p className="feed-post-body">{post.body}</p>}
    {post.image && <PostImage key={post.image.secureUrl} image={post.image} eager={eagerImage} />}
    <div className="feed-post-stats"><button type="button" disabled={post.engagement.reactionCount === 0} onClick={showReactors}><span className="feed-reaction-stack">{post.reactionPreview.map((reactor) => <Avatar key={reactor.user.id} user={reactor.user} size={24} />)}{post.engagement.reactionCount > post.reactionPreview.length && <i>+{post.engagement.reactionCount - post.reactionPreview.length}</i>}</span><strong>{post.engagement.reactionCount}</strong></button><div><span>{post.engagement.commentCount} Comment</span><span>0 Share</span></div></div>
    <div className="feed-post-actions"><ReactionControl target="post" id={post.id} current={post.engagement.viewerReaction} pending={mutation.isPending} overlay={overlay} setOverlay={setOverlay} onToggle={() => mutation.mutate(post.engagement.viewerReaction === null ? "like" : null)} onSelect={(next) => { mutation.mutate(next); setOverlay(undefined); }} /><button type="button" aria-controls={commentInputId} onClick={() => document.getElementById(commentInputId)?.focus()}><FeedReferenceIcon name="comment" />Comment</button><DisabledButton label="Share post"><FeedReferenceIcon name="share" />Share</DisabledButton></div>
    <Comments post={post} user={user} inputId={commentInputId} overlay={overlay} setOverlay={setOverlay} showReactors={showCommentReactors} />
    {overlay?.kind === "post-edit" && overlay.id === post.id && <PostEditDialog post={post} close={() => setOverlay(undefined)} />}
    {overlay?.kind === "post-audience" && overlay.id === post.id && <PostAudienceDialog post={post} close={() => setOverlay(undefined)} />}
    {overlay?.kind === "post-delete" && overlay.id === post.id && <PostDeleteDialog post={post} close={() => setOverlay(undefined)} />}
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
  const [reactors, setReactors] = useState<{ kind: "post" | "comment"; id: string }>();
  const [overlay, setOverlay] = useState<OpenOverlay>();
  const [focusModality, setFocusModality] = useState<"pointer" | "keyboard">("pointer");
  const query = useInfiniteQuery({
    queryKey: feedKeys.all,
    queryFn: ({ pageParam }) => feedRepository.list(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: auth.status === "authenticated",
  });
  const posts = Array.from(new Map((query.data?.pages.flatMap((page) => page.items) ?? []).map((post) => [post.id, post])).values());
  const eagerPostImageId = posts.find((post) => post.image !== null)?.id;
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

  return <div className="feed-app" data-focus-modality={focusModality} onKeyDownCapture={(event) => { if (event.key === "Tab") setFocusModality("keyboard"); }} onPointerDownCapture={() => setFocusModality("pointer")}>
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
            : posts.length ? <>{posts.map((post) => <PostCard key={post.id} post={post} user={auth.user} eagerImage={post.id === eagerPostImageId} menuOpen={overlay?.kind === "post" && overlay.id === post.id} overlay={overlay} setOverlay={setOverlay} showReactors={() => setReactors({ kind: "post", id: post.id })} showCommentReactors={(id) => setReactors({ kind: "comment", id })} />)}{query.hasNextPage && <button className="feed-load-more" type="button" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>{query.isFetchingNextPage ? "Loading…" : "Load more posts"}</button>}</>
              : <div className="feed-empty"><h2>Your feed is quiet</h2><p>Create the first post.</p></div>}
      </main>
      <RightSidebar />
    </div>
    <MobileNavigation />
    {reactors && <ReactorsDialog target={reactors} close={() => setReactors(undefined)} />}
  </div>;
}
