"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@/features/auth/types";
import { authService } from "@/features/auth/service";
import { currentUser, mockFeedRepository } from "../mockRepository";
import { toggleReaction } from "../model";
import type { Comment, Post, ReactionSummary, Reply, Visibility } from "../types";

const fullName = (user: User) => `${user.firstName} ${user.lastName}`;
const relativeTime = (date: string) => {
  const minutes = Math.max(1, Math.round((Date.now() - Date.parse(date)) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60); return hours < 24 ? `${hours}h` : `${Math.round(hours / 24)}d`;
};

function Avatar({ user, size = 42 }: { user: User; size?: number }) {
  return <Image className="avatar" src={user.avatarUrl} alt={`${fullName(user)}'s avatar`} width={size} height={size} />;
}

function LikersDialog({ reactions, onClose }: { reactions: ReactionSummary; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  return <dialog ref={ref} className="likers-dialog" onClose={onClose} aria-labelledby="likers-title">
    <div className="dialog-title"><h2 id="likers-title">Liked by</h2><button type="button" onClick={() => ref.current?.close()} aria-label="Close">×</button></div>
    {reactions.users.length ? <ul>{reactions.users.map((user) => <li key={user.id}><Avatar user={user} /><span><strong>{fullName(user)}</strong><small>{user.headline}</small></span></li>)}</ul> : <p>No likes yet. Be the first.</p>}
  </dialog>;
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => { const saved = localStorage.getItem("buddy-theme"); const next = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light"; }); return () => cancelAnimationFrame(frame); }, []);
  const toggle = () => { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light"; localStorage.setItem("buddy-theme", next ? "dark" : "light"); };
  return <button type="button" className="theme-toggle" role="switch" aria-checked={dark} onClick={toggle}><span>☀</span><i className={dark ? "active" : ""} /><span>☾</span><span className="sr-only">Use dark theme</span></button>;
}

function Header() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const logout = async () => { await authService.logout(); router.replace("/login"); router.refresh(); };
  return <header className="site-header"><div className="header-inner">
    <Image src="/assets/logo.svg" alt="BuddyScript" width={170} height={40} priority />
    <label className="header-search"><span>⌕</span><input type="search" placeholder="Input search text" disabled aria-label="Search is not available in this demo" /></label>
    <nav aria-label="Primary navigation"><button className="nav-active" aria-label="Home">⌂</button><button disabled aria-label="Friends is not available">♧</button><button disabled aria-label="Notifications are not available">♢<b>6</b></button><button disabled aria-label="Messages are not available">□</button></nav>
    <div className="profile-menu"><button type="button" onClick={() => setOpen(!open)} aria-expanded={open}><Avatar user={currentUser} size={38} /><span>{currentUser.firstName}</span><span>⌄</span></button>{open && <div className="profile-dropdown"><strong>{fullName(currentUser)}</strong><small>{currentUser.email}</small><button type="button" onClick={logout}>Log out</button></div>}</div>
  </div></header>;
}

const sideLinks = [["⌂", "Feed"], ["♧", "My community"], ["♙", "Messages"], ["▣", "Notifications"], ["☆", "Explore"], ["▦", "Saved posts"]];
function LeftSidebar() { return <aside className="left-sidebar" aria-label="Feed shortcuts"><div className="profile-card"><Avatar user={currentUser} size={70} /><h2>{fullName(currentUser)}</h2><p>{currentUser.headline}</p></div><nav>{sideLinks.map(([symbol, label], index) => <button type="button" key={label} disabled={index > 0} className={index === 0 ? "active" : ""}><span>{symbol}</span>{label}</button>)}</nav><div className="event-card"><Image src="/assets/feed_event1.png" alt="Design meetup event" width={260} height={175} /><strong>Design systems meetup</strong><small>Sunday · 7:30 PM</small></div></aside>; }

const friends = [
  { ...currentUser, id: "steve", firstName: "Steve", lastName: "Jobs", avatarUrl: "/assets/people1.png", headline: "CEO of Apple" },
  { ...currentUser, id: "ryan", firstName: "Ryan", lastName: "Roslansky", avatarUrl: "/assets/people2.png", headline: "CEO of LinkedIn" },
  { ...currentUser, id: "dylan", firstName: "Dylan", lastName: "Field", avatarUrl: "/assets/people3.png", headline: "CEO of Figma" },
];
function PeopleRow({ user, action }: { user: User; action?: boolean }) { return <div className="people-row"><Avatar user={user} size={44} /><span><strong>{fullName(user)}</strong><small>{user.headline}</small></span>{action ? <button type="button" disabled>Follow</button> : <i aria-label="Online" />}</div>; }
function RightSidebar() { return <aside className="right-sidebar"><section><div className="section-heading"><h2>You Might Like</h2><button disabled>See All</button></div><PeopleRow user={{ ...friends[1], firstName: "Radovan", lastName: "SkillArena", avatarUrl: "/assets/Avatar.png", headline: "Founder & CEO at Trophy" }} action /></section><section><div className="section-heading"><h2>Your Friends</h2><button disabled>See All</button></div><label className="friend-search">⌕<input disabled placeholder="Input search text" aria-label="Friend search is not available" /></label>{friends.map((friend) => <PeopleRow user={friend} key={friend.id} />)}</section></aside>; }

function Stories() { const assets = ["card_ppl1.png", "card_ppl2.png", "card_ppl3.png", "card_ppl4.png"]; return <section className="stories" aria-label="Stories"><button disabled className="story-create"><span>+</span><small>Create Story</small></button>{assets.map((asset, index) => <button disabled className="story" key={asset}><Image src={`/assets/${asset}`} alt="" fill sizes="120px" /><span><Image src={`/assets/mobile_story_img${index ? "1" : ""}.png`} alt="" width={34} height={34} /></span><small>{["Karim", "Dylan", "Ryan", "Ava"][index]}</small></button>)}</section>; }

function Composer({ onCreated }: { onCreated: () => Promise<void> }) {
  const [body, setBody] = useState(""); const [visibility, setVisibility] = useState<Visibility>("public"); const [imageUrl, setImageUrl] = useState<string>(); const [error, setError] = useState(""); const [pending, setPending] = useState(false); const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  const choose = (file?: File) => { setError(""); if (!file) return; if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; } if (file.size > 5_000_000) { setError("Image must be smaller than 5 MB."); return; } setImageUrl((old) => { if (old?.startsWith("blob:")) URL.revokeObjectURL(old); return URL.createObjectURL(file); }); };
  const submit = async () => { if (!body.trim() && !imageUrl) { setError("Write something or add a photo."); return; } setPending(true); const result = await mockFeedRepository.create({ body: body.trim(), imageUrl, visibility }); setPending(false); if (!result.ok) { setError(result.error.message); return; } setBody(""); setImageUrl(undefined); await onCreated(); };
  return <section className="composer"><div className="composer-top"><Avatar user={currentUser} /><textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write something ..." aria-label="Post text" maxLength={1000} /></div>{imageUrl && <div className="image-preview"><Image src={imageUrl} alt="Selected post preview" width={700} height={400} unoptimized /><button onClick={() => setImageUrl(undefined)} type="button" aria-label="Remove selected image">×</button></div>}<div className="composer-bottom"><div><input ref={fileRef} hidden type="file" accept="image/*" onChange={(e) => choose(e.target.files?.[0])} /><button type="button" onClick={() => fileRef.current?.click()}>▧ <span>Photo</span></button><button type="button" disabled>▷ <span>Video</span></button><button type="button" disabled>▦ <span>Event</span></button><button type="button" disabled>▤ <span>Article</span></button></div><label className="visibility"><span className="sr-only">Post visibility</span><select value={visibility} onChange={(e) => setVisibility(e.target.value as Visibility)}><option value="public">Public</option><option value="private">Private</option></select></label><button className="post-button" type="button" disabled={pending} onClick={submit}>➤ {pending ? "Posting" : "Post"}</button></div>{error && <p className="composer-error" role="alert">{error}</p>}</section>;
}

function CommentForm({ placeholder, onSubmit, inputId }: { placeholder: string; onSubmit: (body: string) => Promise<void>; inputId?: string }) { const [body, setBody] = useState(""); const [pending, setPending] = useState(false); const submit = async (e: React.FormEvent) => { e.preventDefault(); if (!body.trim()) return; setPending(true); await onSubmit(body.trim()); setPending(false); setBody(""); }; return <form className="comment-form" onSubmit={submit}><Avatar user={currentUser} size={34} /><input id={inputId} value={body} onChange={(e) => setBody(e.target.value)} placeholder={placeholder} aria-label={placeholder} /><button type="submit" disabled={pending || !body.trim()} aria-label="Send">➤</button></form>; }

type EntityProps = { postId: string; item: Comment | Reply; kind: "comment" | "reply"; commentId: string; onRefresh: () => Promise<void>; onLikers: (reactions: ReactionSummary) => void };
function CommentItem({ postId, item, kind, commentId, onRefresh, onLikers }: EntityProps) {
  const [replying, setReplying] = useState(false);
  const toggle = async () => { if (kind === "comment") await mockFeedRepository.toggleCommentLike(postId, item.id); else await mockFeedRepository.toggleReplyLike(postId, commentId, item.id); await onRefresh(); };
  return <div className={`comment ${kind === "reply" ? "reply" : ""}`}><Avatar user={item.author} size={36} /><div className="comment-content"><div className="comment-bubble"><strong>{fullName(item.author)}</strong><p>{item.body}</p></div><div className="comment-actions"><button className={item.reactions.likedByViewer ? "liked" : ""} type="button" onClick={toggle}>{item.reactions.likedByViewer ? "Unlike" : "Like"}</button>{kind === "comment" && <button type="button" onClick={() => setReplying(!replying)}>Reply</button>}<span>{relativeTime(item.createdAt)}</span>{item.reactions.users.length > 0 && <button className="reaction-count" onClick={() => onLikers(item.reactions)}>♥ {item.reactions.users.length}</button>}</div>{kind === "comment" && <>{(item as Comment).replies.map((reply) => <CommentItem key={reply.id} postId={postId} item={reply} kind="reply" commentId={item.id} onRefresh={onRefresh} onLikers={onLikers} />)}{replying && <CommentForm placeholder={`Reply to ${item.author.firstName}...`} onSubmit={async (body) => { await mockFeedRepository.addReply(postId, item.id, body); setReplying(false); await onRefresh(); }} />}</>}</div></div>;
}

function PostCard({ post, onRefresh, onLikers }: { post: Post; onRefresh: () => Promise<void>; onLikers: (reactions: ReactionSummary) => void }) {
  const [menu, setMenu] = useState(false); const [optimistic, setOptimistic] = useState(post.reactions);
  const like = async () => { setOptimistic(toggleReaction(optimistic, currentUser)); const result = await mockFeedRepository.togglePostLike(post.id); if (!result.ok) setOptimistic(post.reactions); else await onRefresh(); };
  return <article className="post-card"><div className="post-head"><Avatar user={post.author} /><div><h2>{fullName(post.author)}</h2><p>{relativeTime(post.createdAt)} · <span>{post.visibility === "public" ? "◉ Public" : "● Private"}</span></p></div><div className="post-menu"><button type="button" onClick={() => setMenu(!menu)} aria-label="Post options" aria-expanded={menu}>•••</button>{menu && <div><button disabled>Save post</button><button disabled>Hide post</button><button disabled>Report post</button></div>}</div></div><p className="post-body">{post.body}</p>{post.imageUrl && <div className="post-image"><Image src={post.imageUrl} alt="Image shared with this post" width={900} height={600} unoptimized={post.imageUrl.startsWith("blob:")} /></div>}<div className="post-stats"><button type="button" onClick={() => onLikers(optimistic)}><span>♥</span>{optimistic.users.length ? `${optimistic.users.length} ${optimistic.users.length === 1 ? "person" : "people"}` : "Be the first to like"}</button><span>{post.comments.length} {post.comments.length === 1 ? "Comment" : "Comments"}</span></div><div className="post-actions"><button type="button" className={optimistic.likedByViewer ? "liked" : ""} onClick={like}>♡ {optimistic.likedByViewer ? "Unlike" : "Like"}</button><button type="button" onClick={() => document.getElementById(`comment-${post.id}`)?.focus()}>▢ Comment</button><button type="button" disabled>⌁ Share</button></div><div className="comments"><CommentForm inputId={`comment-${post.id}`} placeholder="Write a comment" onSubmit={async (body) => { await mockFeedRepository.addComment(post.id, body); await onRefresh(); }} />{post.comments.map((comment) => <CommentItem key={comment.id} postId={post.id} item={comment} kind="comment" commentId={comment.id} onRefresh={onRefresh} onLikers={onLikers} />)}</div></article>;
}

export function FeedApp() {
  const [posts, setPosts] = useState<Post[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [likers, setLikers] = useState<ReactionSummary>();
  const load = useCallback(async () => { const result = await mockFeedRepository.list(currentUser.id); if (result.ok) { setPosts(result.data.items); setError(""); } else setError(result.error.message); setLoading(false); }, []);
  useEffect(() => { const frame = requestAnimationFrame(() => { void load(); }); return () => cancelAnimationFrame(frame); }, [load]);
  return <div className="feed-app"><ThemeToggle /><Header /><div className="feed-layout"><LeftSidebar /><main className="feed-main"><Stories /><Composer onCreated={load} />{error && <div className="feed-error" role="alert">{error}<button onClick={load}>Try again</button></div>}{loading ? <div className="feed-loading" aria-live="polite"><span /><span /><span /><p>Loading your feed...</p></div> : posts.length ? posts.map((post) => <PostCard key={post.id} post={post} onRefresh={load} onLikers={setLikers} />) : <div className="feed-empty"><h2>Your feed is quiet</h2><p>Create the first post to get the conversation started.</p></div>}</main><RightSidebar /></div>{likers && <LikersDialog reactions={likers} onClose={() => setLikers(undefined)} />}</div>;
}
