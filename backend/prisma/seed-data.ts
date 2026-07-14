import { PostVisibility, ReactionType } from "../src/generated/prisma/client.js";

export const DEMO_PASSWORD = "Password123!";

export const demoIds = {
  users: {
    alex: "01900000-0000-7000-8000-000000000001",
    karim: "01900000-0000-7000-8000-000000000002",
    radovan: "01900000-0000-7000-8000-000000000003",
    ryan: "01900000-0000-7000-8000-000000000004",
    dylan: "01900000-0000-7000-8000-000000000005",
    ava: "01900000-0000-7000-8000-000000000006",
    maya: "01900000-0000-7000-8000-000000000007",
    noah: "01900000-0000-7000-8000-000000000008",
  },
  posts: {
    healthy: "01900000-0000-7000-8000-000000000101",
    alexPrivate: "01900000-0000-7000-8000-000000000102",
    designSystems: "01900000-0000-7000-8000-000000000103",
    community: "01900000-0000-7000-8000-000000000104",
    remoteWork: "01900000-0000-7000-8000-000000000105",
    accessibility: "01900000-0000-7000-8000-000000000106",
    prototype: "01900000-0000-7000-8000-000000000107",
    habits: "01900000-0000-7000-8000-000000000108",
    welcome: "01900000-0000-7000-8000-000000000109",
    mayaPrivate: "01900000-0000-7000-8000-000000000110",
  },
} as const;

export interface DemoUser {
  id: string; firstName: string; lastName: string; email: string; avatarUrl: string;
}

interface StockImage {
  publicId: string; url: string; width: number; height: number; bytes: number; format: "png";
}

export interface DemoPost {
  id: string; authorId: string; body: string | null; visibility: PostVisibility; minutesAgo: number; image?: StockImage;
}

export interface DemoComment {
  id: string; postId: string; authorId: string; body: string; minutesAgo: number; parentId?: string;
}

export interface DemoReaction {
  id: string; targetId: string; userId: string; reactionType: ReactionType; minutesAgo: number;
}

const image = (name: string, width: number, height: number, bytes: number): StockImage => ({
  publicId: `stock/${name.replace(".png", "")}`, url: `/assets/${name}`, width, height, bytes, format: "png",
});

export const demoUsers: readonly DemoUser[] = [
  { id: demoIds.users.alex, firstName: "Alex", lastName: "Morgan", email: "alex@buddy.test", avatarUrl: "/assets/img1.png" },
  { id: demoIds.users.karim, firstName: "Karim", lastName: "Saif", email: "karim@buddy.test", avatarUrl: "/assets/post_img.png" },
  { id: demoIds.users.radovan, firstName: "Radovan", lastName: "SkillArena", email: "radovan@buddy.test", avatarUrl: "/assets/Avatar.png" },
  { id: demoIds.users.ryan, firstName: "Ryan", lastName: "Roslansky", email: "ryan@buddy.test", avatarUrl: "/assets/img2.png" },
  { id: demoIds.users.dylan, firstName: "Dylan", lastName: "Field", email: "dylan@buddy.test", avatarUrl: "/assets/img3.png" },
  { id: demoIds.users.ava, firstName: "Ava", lastName: "Thompson", email: "ava@buddy.test", avatarUrl: "/assets/img5.png" },
  { id: demoIds.users.maya, firstName: "Maya", lastName: "Patel", email: "maya@buddy.test", avatarUrl: "/assets/img6.png" },
  { id: demoIds.users.noah, firstName: "Noah", lastName: "Williams", email: "noah@buddy.test", avatarUrl: "/assets/img7.png" },
] as const;

export const demoPosts: readonly DemoPost[] = [
  { id: demoIds.posts.welcome, authorId: demoIds.users.alex, body: "Welcome to BuddyScript! I’m excited to share ideas, learn from this community, and build thoughtful products together.", visibility: PostVisibility.PUBLIC, minutesAgo: 4 },
  { id: demoIds.posts.healthy, authorId: demoIds.users.karim, body: "Healthy Tracking App — a thoughtful way to build better habits and celebrate small wins every day.", visibility: PostVisibility.PUBLIC, minutesAgo: 12, image: image("timeline_img.png", 1200, 790, 1_222_361) },
  { id: demoIds.posts.designSystems, authorId: demoIds.users.dylan, body: "A design system works best when it is treated as a shared product, not a folder of components. We have been exploring clearer contribution paths this week.", visibility: PostVisibility.PUBLIC, minutesAgo: 75, image: image("recommend1.png", 624, 360, 439_451) },
  { id: demoIds.posts.community, authorId: demoIds.users.ryan, body: "Great conversations happen when a community makes room for different experiences. Join our product community session this Friday.", visibility: PostVisibility.PUBLIC, minutesAgo: 210, image: image("feed_event1.png", 528, 320, 300_009) },
  { id: demoIds.posts.remoteWork, authorId: demoIds.users.maya, body: "My favorite remote-work ritual is a short written plan before the first meeting. It creates focus without adding another call.", visibility: PostVisibility.PUBLIC, minutesAgo: 390 },
  { id: demoIds.posts.accessibility, authorId: demoIds.users.ava, body: "Accessibility reviews keep improving our product for everyone. Keyboard flows and meaningful focus states are now part of every feature definition.", visibility: PostVisibility.PUBLIC, minutesAgo: 720, image: image("recommend2.png", 624, 360, 336_264) },
  { id: demoIds.posts.prototype, authorId: demoIds.users.noah, body: null, visibility: PostVisibility.PUBLIC, minutesAgo: 1_260, image: image("recommend3.png", 624, 360, 303_573) },
  { id: demoIds.posts.habits, authorId: demoIds.users.radovan, body: "A small reminder from this week: consistent progress beats occasional perfection. What habit has made the biggest difference for you?", visibility: PostVisibility.PUBLIC, minutesAgo: 2_880, image: image("recommend4.png", 624, 360, 491_326) },
  { id: demoIds.posts.alexPrivate, authorId: demoIds.users.alex, body: "A quiet preview of my new portfolio direction. Keeping this private while I refine the details.", visibility: PostVisibility.PRIVATE, minutesAgo: 45, image: image("profile-1.png", 584, 392, 203_334) },
  { id: demoIds.posts.mayaPrivate, authorId: demoIds.users.maya, body: "Draft notes for next week’s product retrospective.", visibility: PostVisibility.PRIVATE, minutesAgo: 1_800 },
] as const;

export const demoComments: readonly DemoComment[] = [
  { id: "01900000-0000-7000-8000-000000000201", postId: demoIds.posts.healthy, authorId: demoIds.users.radovan, body: "It is a long established fact that a reader can be distracted by content when looking at its layout. This visual hierarchy keeps the important progress clear.", minutesAgo: 10 },
  { id: "01900000-0000-7000-8000-000000000202", postId: demoIds.posts.healthy, authorId: demoIds.users.karim, parentId: "01900000-0000-7000-8000-000000000201", body: "Thank you! That was the part we iterated on most.", minutesAgo: 9 },
  { id: "01900000-0000-7000-8000-000000000203", postId: demoIds.posts.healthy, authorId: demoIds.users.ava, body: "The progress view is calm and immediately understandable.", minutesAgo: 8 },
  { id: "01900000-0000-7000-8000-000000000204", postId: demoIds.posts.healthy, authorId: demoIds.users.noah, parentId: "01900000-0000-7000-8000-000000000203", body: "Agreed—the restrained color palette helps a lot.", minutesAgo: 7 },
  { id: "01900000-0000-7000-8000-000000000205", postId: demoIds.posts.designSystems, authorId: demoIds.users.alex, body: "Treating documentation and governance as product features made our system much easier to adopt.", minutesAgo: 68 },
  { id: "01900000-0000-7000-8000-000000000206", postId: demoIds.posts.designSystems, authorId: demoIds.users.dylan, parentId: "01900000-0000-7000-8000-000000000205", body: "Exactly. The contribution experience matters as much as the component API.", minutesAgo: 64 },
  { id: "01900000-0000-7000-8000-000000000207", postId: demoIds.posts.designSystems, authorId: demoIds.users.maya, body: "Would love to hear how you measure adoption across teams.", minutesAgo: 61 },
  { id: "01900000-0000-7000-8000-000000000208", postId: demoIds.posts.community, authorId: demoIds.users.karim, body: "Looking forward to it. The last session had excellent practical takeaways.", minutesAgo: 190 },
  { id: "01900000-0000-7000-8000-000000000209", postId: demoIds.posts.community, authorId: demoIds.users.ryan, parentId: "01900000-0000-7000-8000-000000000208", body: "Glad to hear it—we have a hands-on format planned again.", minutesAgo: 184 },
  { id: "01900000-0000-7000-8000-000000000210", postId: demoIds.posts.remoteWork, authorId: demoIds.users.ava, body: "A short plan also makes async handoffs much smoother.", minutesAgo: 360 },
  { id: "01900000-0000-7000-8000-000000000211", postId: demoIds.posts.remoteWork, authorId: demoIds.users.alex, parentId: "01900000-0000-7000-8000-000000000210", body: "Yes—especially when decisions and open questions are captured together.", minutesAgo: 350 },
  { id: "01900000-0000-7000-8000-000000000212", postId: demoIds.posts.accessibility, authorId: demoIds.users.radovan, body: "Making accessibility part of the definition of done is the sustainable approach.", minutesAgo: 690 },
  { id: "01900000-0000-7000-8000-000000000213", postId: demoIds.posts.accessibility, authorId: demoIds.users.noah, body: "Visible focus states helped our power users too.", minutesAgo: 675 },
  { id: "01900000-0000-7000-8000-000000000214", postId: demoIds.posts.habits, authorId: demoIds.users.maya, body: "Writing down one priority before opening my inbox.", minutesAgo: 2_820 },
  { id: "01900000-0000-7000-8000-000000000215", postId: demoIds.posts.habits, authorId: demoIds.users.radovan, parentId: "01900000-0000-7000-8000-000000000214", body: "That is a great one. Simple enough to repeat every day.", minutesAgo: 2_810 },
] as const;

const reaction = (suffix: string, targetId: string, userId: string, reactionType: ReactionType, minutesAgo: number): DemoReaction => ({
  id: `01900000-0000-7000-8000-000000000${suffix}`, targetId, userId, reactionType, minutesAgo,
});

export const demoPostReactions: readonly DemoReaction[] = [
  reaction("301", demoIds.posts.healthy, demoIds.users.radovan, ReactionType.LOVE, 9),
  reaction("302", demoIds.posts.healthy, demoIds.users.ava, ReactionType.CARE, 8),
  reaction("303", demoIds.posts.healthy, demoIds.users.alex, ReactionType.HAHA, 7),
  reaction("304", demoIds.posts.designSystems, demoIds.users.alex, ReactionType.WOW, 65),
  reaction("305", demoIds.posts.designSystems, demoIds.users.maya, ReactionType.SAD, 60),
  reaction("306", demoIds.posts.designSystems, demoIds.users.ryan, ReactionType.ANGRY, 55),
  reaction("307", demoIds.posts.community, demoIds.users.karim, ReactionType.LIKE, 180),
  reaction("308", demoIds.posts.community, demoIds.users.noah, ReactionType.LOVE, 170),
  reaction("309", demoIds.posts.remoteWork, demoIds.users.ava, ReactionType.CARE, 340),
  reaction("310", demoIds.posts.accessibility, demoIds.users.radovan, ReactionType.HAHA, 660),
  reaction("311", demoIds.posts.accessibility, demoIds.users.dylan, ReactionType.WOW, 650),
  reaction("312", demoIds.posts.habits, demoIds.users.maya, ReactionType.SAD, 2_800),
] as const;

export const demoCommentReactions: readonly DemoReaction[] = [
  reaction("401", "01900000-0000-7000-8000-000000000201", demoIds.users.alex, ReactionType.LOVE, 8),
  reaction("402", "01900000-0000-7000-8000-000000000201", demoIds.users.ava, ReactionType.CARE, 7),
  reaction("403", "01900000-0000-7000-8000-000000000203", demoIds.users.karim, ReactionType.HAHA, 6),
  reaction("404", "01900000-0000-7000-8000-000000000205", demoIds.users.dylan, ReactionType.WOW, 62),
  reaction("405", "01900000-0000-7000-8000-000000000207", demoIds.users.ryan, ReactionType.SAD, 58),
  reaction("406", "01900000-0000-7000-8000-000000000208", demoIds.users.alex, ReactionType.ANGRY, 175),
  reaction("407", "01900000-0000-7000-8000-000000000210", demoIds.users.maya, ReactionType.LIKE, 335),
  reaction("408", "01900000-0000-7000-8000-000000000212", demoIds.users.ava, ReactionType.LOVE, 650),
  reaction("409", "01900000-0000-7000-8000-000000000214", demoIds.users.radovan, ReactionType.CARE, 2_790),
  reaction("410", "01900000-0000-7000-8000-000000000202", demoIds.users.ryan, ReactionType.HAHA, 5),
  reaction("411", "01900000-0000-7000-8000-000000000204", demoIds.users.maya, ReactionType.WOW, 4),
  reaction("412", "01900000-0000-7000-8000-000000000206", demoIds.users.noah, ReactionType.SAD, 50),
  reaction("413", "01900000-0000-7000-8000-000000000209", demoIds.users.ava, ReactionType.ANGRY, 160),
  reaction("414", "01900000-0000-7000-8000-000000000211", demoIds.users.dylan, ReactionType.LIKE, 330),
  reaction("415", "01900000-0000-7000-8000-000000000215", demoIds.users.alex, ReactionType.LOVE, 2_780),
] as const;

export function validateDemoFixtures(): void {
  const unique = (values: readonly string[], label: string): void => {
    if (new Set(values).size !== values.length) throw new Error(`Duplicate ${label} in demo fixtures`);
  };
  unique(demoUsers.map((item) => item.id), "user ID");
  unique(demoUsers.map((item) => item.email.toLowerCase()), "user email");
  unique(demoPosts.map((item) => item.id), "post ID");
  unique(demoComments.map((item) => item.id), "comment ID");
  unique(demoPostReactions.map((item) => item.id), "post reaction ID");
  unique(demoCommentReactions.map((item) => item.id), "comment reaction ID");
  const userIds = new Set(demoUsers.map((item) => item.id));
  const postIds = new Set(demoPosts.map((item) => item.id));
  const comments = new Map(demoComments.map((item) => [item.id, item]));
  for (const post of demoPosts) {
    if (!userIds.has(post.authorId) || (post.body === null && post.image === undefined)) throw new Error(`Invalid demo post ${post.id}`);
  }
  for (const comment of demoComments) {
    if (!userIds.has(comment.authorId) || !postIds.has(comment.postId)) throw new Error(`Invalid demo comment ${comment.id}`);
    if (comment.parentId !== undefined) {
      const parent = comments.get(comment.parentId);
      if (parent === undefined || parent.parentId !== undefined || parent.postId !== comment.postId) throw new Error(`Invalid demo reply ${comment.id}`);
    }
  }
  const validateReactions = (items: readonly DemoReaction[], targetIds: ReadonlySet<string>, label: string): void => {
    unique(items.map(({ targetId, userId }) => `${targetId}:${userId}`), `${label} target/account pair`);
    for (const item of items) {
      if (!targetIds.has(item.targetId) || !userIds.has(item.userId)) throw new Error(`Invalid demo ${label} ${item.id}`);
    }
    const seededTypes = new Set(items.map(({ reactionType }) => reactionType));
    for (const reactionType of Object.values(ReactionType)) {
      if (!seededTypes.has(reactionType)) throw new Error(`Missing ${reactionType} demo ${label}`);
    }
  };
  validateReactions(demoPostReactions, postIds, "post reaction");
  validateReactions(demoCommentReactions, new Set(comments.keys()), "comment reaction");
}

export const demoSummary = Object.freeze({
  users: demoUsers.length, posts: demoPosts.length,
  publicPosts: demoPosts.filter((item) => item.visibility === PostVisibility.PUBLIC).length,
  privatePosts: demoPosts.filter((item) => item.visibility === PostVisibility.PRIVATE).length,
  comments: demoComments.filter((item) => item.parentId === undefined).length,
  replies: demoComments.filter((item) => item.parentId !== undefined).length,
  postReactions: demoPostReactions.length, commentReactions: demoCommentReactions.length,
});
