import type { ReactionType } from "../types";

export const reactionOptions: Array<{ type: ReactionType; label: string; color: string }> = [
  { type: "like", label: "Like", color: "#1877f2" },
  { type: "love", label: "Love", color: "#f55368" },
  { type: "care", label: "Care", color: "#f7b928" },
  { type: "haha", label: "Haha", color: "#f7b928" },
  { type: "wow", label: "Wow", color: "#f7b928" },
  { type: "sad", label: "Sad", color: "#f7b928" },
  { type: "angry", label: "Angry", color: "#e9710f" },
];

export const reactionLabel = (reaction: ReactionType | null) => reactionOptions.find(({ type }) => type === reaction)?.label ?? "Like";
export const reactionColor = (reaction: ReactionType | null) => reactionOptions.find(({ type }) => type === reaction)?.color ?? "currentColor";

export function FeedReactionIcon({ name, size = 24 }: { name: ReactionType; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 32 32", "aria-hidden": true, "data-reaction-icon": name } as const;
  if (name === "like") return <svg {...common}><circle cx="16" cy="16" r="15" fill="#1877F2" /><path fill="#fff" d="M13.1 25H9.2a1.5 1.5 0 0 1-1.5-1.5v-8.2c0-.8.7-1.5 1.5-1.5h3.9V25Zm2-10.9 3.2-6.4c.5-1 2-.7 2 .4v4.6h3.4c1.4 0 2.4 1.3 2 2.6l-2.1 7.4c-.4 1.4-1.7 2.3-3.1 2.3h-5.4V14.1Z" /></svg>;
  if (name === "love") return <svg {...common}><circle cx="16" cy="16" r="15" fill="#F55368" /><path fill="#fff" d="M16 24.3 8.6 17c-4.3-4.3 2.1-10.7 6.4-6.4l1 1 1-1c4.3-4.3 10.7 2.1 6.4 6.4L16 24.3Z" /></svg>;
  if (name === "care") return <svg {...common}><circle cx="16" cy="16" r="15" fill="#F7B928" /><circle cx="11" cy="12" r="1.5" fill="#3E2A14" /><circle cx="21" cy="12" r="1.5" fill="#3E2A14" /><path stroke="#3E2A14" strokeWidth="1.8" strokeLinecap="round" d="M12 16.5c2.5 1.8 5.5 1.8 8 0" /><path fill="#F55368" d="m16 26-5.1-4.7c-3-2.8 1.3-7.1 4.3-4.3l.8.8.8-.8c3-2.8 7.3 1.5 4.3 4.3L16 26Z" /></svg>;
  if (name === "haha") return <svg {...common}><circle cx="16" cy="16" r="15" fill="#F7B928" /><path stroke="#3E2A14" strokeWidth="2" strokeLinecap="round" d="m7.8 12 3-1.7M24.2 12l-3-1.7" /><path fill="#3E2A14" d="M7.5 17.2h17c-.9 6-4.3 8.4-8.5 8.4s-7.6-2.4-8.5-8.4Z" /><path fill="#fff" d="M10.2 18.6h11.6c-.5 1.2-1.4 2-2.8 2.5h-6c-1.4-.5-2.3-1.3-2.8-2.5Z" /></svg>;
  if (name === "wow") return <svg {...common}><circle cx="16" cy="16" r="15" fill="#F7B928" /><circle cx="10.5" cy="12" r="2" fill="#3E2A14" /><circle cx="21.5" cy="12" r="2" fill="#3E2A14" /><ellipse cx="16" cy="21" rx="4" ry="5" fill="#3E2A14" /></svg>;
  if (name === "sad") return <svg {...common}><circle cx="16" cy="16" r="15" fill="#F7B928" /><circle cx="10.5" cy="12.5" r="1.7" fill="#3E2A14" /><circle cx="21.5" cy="12.5" r="1.7" fill="#3E2A14" /><path stroke="#3E2A14" strokeWidth="2" strokeLinecap="round" d="M11 23c2.8-2.7 7.2-2.7 10 0" /><path fill="#48A9F8" d="M23.2 16.2c2 2.7 2.7 4.2 2.7 5.4a2.7 2.7 0 1 1-5.4 0c0-1.2.7-2.7 2.7-5.4Z" /></svg>;
  return <svg {...common}><defs><linearGradient id="angry-gradient" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#F7B928" /><stop offset="1" stopColor="#E9710F" /></linearGradient></defs><circle cx="16" cy="16" r="15" fill="url(#angry-gradient)" /><path stroke="#3E2A14" strokeWidth="2" strokeLinecap="round" d="m8 10 5 2m11-2-5 2M11 23c2.8-2.7 7.2-2.7 10 0" /><circle cx="11" cy="15" r="1.7" fill="#3E2A14" /><circle cx="21" cy="15" r="1.7" fill="#3E2A14" /></svg>;
}
