CREATE SCHEMA IF NOT EXISTS "public";
CREATE TYPE "account_status" AS ENUM ('ACTIVE', 'DISABLED');
CREATE TYPE "post_visibility" AS ENUM ('PUBLIC', 'PRIVATE');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "first_name" VARCHAR(80) NOT NULL,
  "last_name" VARCHAR(80) NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "email_normalized" VARCHAR(320) NOT NULL,
  "password_hash" VARCHAR(255) NOT NULL,
  "avatar_url" VARCHAR(2048),
  "status" "account_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_normalized_check" CHECK ("email_normalized" = lower(btrim("email")))
);

CREATE TABLE "refresh_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "family_id" UUID NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "last_used_at" TIMESTAMPTZ(3),
  "replaced_by_id" UUID,
  "ip_hash" CHAR(64),
  "user_agent_hash" CHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_sessions_expiry_check" CHECK ("expires_at" > "created_at")
);

CREATE TABLE "posts" (
  "id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "body" VARCHAR(5000),
  "visibility" "post_visibility" NOT NULL DEFAULT 'PUBLIC',
  "image_public_id" VARCHAR(255),
  "image_secure_url" VARCHAR(2048),
  "image_version" INTEGER,
  "image_width" INTEGER,
  "image_height" INTEGER,
  "image_bytes" INTEGER,
  "image_format" VARCHAR(20),
  "like_count" INTEGER NOT NULL DEFAULT 0,
  "comment_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "posts_content_check" CHECK (NULLIF(btrim("body"), '') IS NOT NULL OR "image_public_id" IS NOT NULL),
  CONSTRAINT "posts_counts_check" CHECK ("like_count" >= 0 AND "comment_count" >= 0),
  CONSTRAINT "posts_image_metadata_check" CHECK (
    ("image_public_id" IS NULL AND "image_secure_url" IS NULL AND "image_version" IS NULL AND "image_width" IS NULL AND "image_height" IS NULL AND "image_bytes" IS NULL AND "image_format" IS NULL)
    OR
    ("image_public_id" IS NOT NULL AND "image_secure_url" IS NOT NULL AND "image_version" IS NOT NULL AND "image_width" > 0 AND "image_height" > 0 AND "image_bytes" > 0 AND "image_format" IS NOT NULL)
  )
);

CREATE TABLE "comments" (
  "id" UUID NOT NULL,
  "post_id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "parent_id" UUID,
  "depth" SMALLINT NOT NULL DEFAULT 0,
  "body" VARCHAR(2000) NOT NULL,
  "like_count" INTEGER NOT NULL DEFAULT 0,
  "reply_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "comments_body_check" CHECK (NULLIF(btrim("body"), '') IS NOT NULL),
  CONSTRAINT "comments_counts_check" CHECK ("like_count" >= 0 AND "reply_count" >= 0),
  CONSTRAINT "comments_depth_parent_check" CHECK (("depth" = 0 AND "parent_id" IS NULL) OR ("depth" = 1 AND "parent_id" IS NOT NULL))
);

CREATE TABLE "post_likes" (
  "id" UUID NOT NULL,
  "post_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "comment_likes" (
  "id" UUID NOT NULL,
  "comment_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_normalized_key" ON "users"("email_normalized");
CREATE INDEX "users_status_idx" ON "users"("status");
CREATE UNIQUE INDEX "refresh_sessions_token_hash_key" ON "refresh_sessions"("token_hash");
CREATE UNIQUE INDEX "refresh_sessions_replaced_by_id_key" ON "refresh_sessions"("replaced_by_id");
CREATE INDEX "refresh_sessions_user_expiry_idx" ON "refresh_sessions"("user_id", "expires_at");
CREATE INDEX "refresh_sessions_family_idx" ON "refresh_sessions"("family_id");
CREATE INDEX "refresh_sessions_active_family_idx" ON "refresh_sessions"("family_id", "expires_at") WHERE "revoked_at" IS NULL;
CREATE INDEX "posts_author_created_id_idx" ON "posts"("author_id", "created_at" DESC, "id" DESC);
CREATE INDEX "posts_public_feed_idx" ON "posts"("created_at" DESC, "id" DESC) WHERE "visibility" = 'PUBLIC';
CREATE INDEX "posts_private_author_feed_idx" ON "posts"("author_id", "created_at" DESC, "id" DESC) WHERE "visibility" = 'PRIVATE';
CREATE INDEX "comments_post_parent_created_id_idx" ON "comments"("post_id", "parent_id", "created_at", "id");
CREATE INDEX "comments_parent_created_id_idx" ON "comments"("parent_id", "created_at", "id");
CREATE INDEX "comments_root_feed_idx" ON "comments"("post_id", "created_at", "id") WHERE "parent_id" IS NULL;
CREATE INDEX "comments_replies_feed_idx" ON "comments"("parent_id", "created_at", "id") WHERE "parent_id" IS NOT NULL;
CREATE INDEX "post_likes_post_created_id_idx" ON "post_likes"("post_id", "created_at", "id");
CREATE INDEX "post_likes_user_idx" ON "post_likes"("user_id");
CREATE UNIQUE INDEX "post_likes_post_user_key" ON "post_likes"("post_id", "user_id");
CREATE INDEX "comment_likes_comment_created_id_idx" ON "comment_likes"("comment_id", "created_at", "id");
CREATE INDEX "comment_likes_user_idx" ON "comment_likes"("user_id");
CREATE UNIQUE INDEX "comment_likes_comment_user_key" ON "comment_likes"("comment_id", "user_id");

ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "refresh_sessions" ADD CONSTRAINT "refresh_sessions_replaced_by_id_fkey" FOREIGN KEY ("replaced_by_id") REFERENCES "refresh_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "post_likes" ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE FUNCTION "validate_comment_parent"() RETURNS trigger AS $$
DECLARE
  parent_post_id UUID;
  parent_depth SMALLINT;
BEGIN
  IF NEW."parent_id" IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT "post_id", "depth" INTO parent_post_id, parent_depth FROM "comments" WHERE "id" = NEW."parent_id";
  IF parent_post_id IS NULL OR parent_post_id <> NEW."post_id" OR parent_depth <> 0 THEN
    RAISE EXCEPTION 'Reply parent must be a root comment on the same post' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "comments_validate_parent_trigger"
BEFORE INSERT OR UPDATE OF "parent_id", "post_id", "depth" ON "comments"
FOR EACH ROW EXECUTE FUNCTION "validate_comment_parent"();
