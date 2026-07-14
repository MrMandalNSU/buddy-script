CREATE TYPE "reaction_type" AS ENUM ('LIKE', 'LOVE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY');

ALTER TABLE "post_likes"
  ADD COLUMN "reaction_type" "reaction_type" NOT NULL DEFAULT 'LIKE',
  ADD COLUMN "updated_at" TIMESTAMPTZ(3);

ALTER TABLE "comment_likes"
  ADD COLUMN "reaction_type" "reaction_type" NOT NULL DEFAULT 'LIKE',
  ADD COLUMN "updated_at" TIMESTAMPTZ(3);

UPDATE "post_likes" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;
UPDATE "comment_likes" SET "updated_at" = "created_at" WHERE "updated_at" IS NULL;

ALTER TABLE "post_likes" ALTER COLUMN "updated_at" SET NOT NULL;
ALTER TABLE "comment_likes" ALTER COLUMN "updated_at" SET NOT NULL;

CREATE INDEX "post_likes_post_updated_id_idx" ON "post_likes"("post_id", "updated_at" DESC, "id" DESC);
CREATE INDEX "comment_likes_comment_updated_id_idx" ON "comment_likes"("comment_id", "updated_at" DESC, "id" DESC);
