import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import { hashPassword } from "../src/modules/auth/password.service.js";
import { DEMO_PASSWORD, demoCommentReactions, demoComments, demoPostReactions, demoPosts, demoSummary, demoUsers, validateDemoFixtures } from "./seed-data.js";

const databaseUrl = process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV;
if (databaseUrl === undefined) throw new Error("DATABASE_URL or DATABASE_URL_DEV is required to seed the database");

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });
const at = (now: Date, minutesAgo: number): Date => new Date(now.getTime() - minutesAgo * 60_000);

async function persistFixtures(tx: Prisma.TransactionClient, passwordHash: string, now: Date): Promise<void> {
  for (const user of demoUsers) {
    const data = { firstName: user.firstName, lastName: user.lastName, email: user.email, emailNormalized: user.email.toLowerCase(), avatarUrl: user.avatarUrl, passwordHash };
    await tx.user.upsert({ where: { id: user.id }, create: { id: user.id, ...data }, update: data });
  }

  for (const post of demoPosts) {
    const imageData = post.image === undefined ? {
      imagePublicId: null, imageSecureUrl: null, imageVersion: null, imageWidth: null, imageHeight: null, imageBytes: null, imageFormat: null,
    } : {
      imagePublicId: post.image.publicId, imageSecureUrl: post.image.url, imageVersion: 1,
      imageWidth: post.image.width, imageHeight: post.image.height, imageBytes: post.image.bytes, imageFormat: post.image.format,
    };
    const data = { authorId: post.authorId, body: post.body, visibility: post.visibility, createdAt: at(now, post.minutesAgo), ...imageData };
    await tx.post.upsert({ where: { id: post.id }, create: { id: post.id, ...data }, update: data });
  }

  for (const comment of demoComments.filter((item) => item.parentId === undefined)) {
    const data = { postId: comment.postId, authorId: comment.authorId, body: comment.body, depth: 0, parentId: null, createdAt: at(now, comment.minutesAgo) };
    await tx.comment.upsert({ where: { id: comment.id }, create: { id: comment.id, ...data }, update: data });
  }
  for (const reply of demoComments.filter((item) => item.parentId !== undefined)) {
    const data = { postId: reply.postId, authorId: reply.authorId, body: reply.body, depth: 1, parentId: reply.parentId ?? null, createdAt: at(now, reply.minutesAgo) };
    await tx.comment.upsert({ where: { id: reply.id }, create: { id: reply.id, ...data }, update: data });
  }

  for (const reaction of demoPostReactions) {
    const reactedAt = at(now, reaction.minutesAgo);
    const data = { reactionType: reaction.reactionType, createdAt: reactedAt, updatedAt: reactedAt };
    await tx.postLike.upsert({
      where: { postId_userId: { postId: reaction.targetId, userId: reaction.userId } },
      create: { id: reaction.id, postId: reaction.targetId, userId: reaction.userId, ...data },
      update: data,
    });
  }
  for (const reaction of demoCommentReactions) {
    const reactedAt = at(now, reaction.minutesAgo);
    const data = { reactionType: reaction.reactionType, createdAt: reactedAt, updatedAt: reactedAt };
    await tx.commentLike.upsert({
      where: { commentId_userId: { commentId: reaction.targetId, userId: reaction.userId } },
      create: { id: reaction.id, commentId: reaction.targetId, userId: reaction.userId, ...data },
      update: data,
    });
  }

  await tx.$executeRaw`UPDATE posts p SET like_count = (SELECT count(*)::integer FROM post_likes pl WHERE pl.post_id = p.id), comment_count = (SELECT count(*)::integer FROM comments c WHERE c.post_id = p.id AND c.parent_id IS NULL)`;
  await tx.$executeRaw`UPDATE comments c SET like_count = (SELECT count(*)::integer FROM comment_likes cl WHERE cl.comment_id = c.id), reply_count = (SELECT count(*)::integer FROM comments r WHERE r.parent_id = c.id)`;
}

async function seed(): Promise<void> {
  validateDemoFixtures();
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await prisma.$transaction((tx) => persistFixtures(tx, passwordHash, new Date()), { maxWait: 10_000, timeout: 30_000 });
  console.info("BuddyScript demo data seeded", { ...demoSummary, login: "alex@buddy.test" });
}

seed()
  .catch((error: unknown) => { console.error("Database seed failed", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
