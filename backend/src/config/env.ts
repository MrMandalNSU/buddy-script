import { z } from "zod";

const booleanFromString = z.string().trim().toLowerCase().transform((value, context) => {
  if (value === "true") return true;
  if (value === "false") return false;
  context.addIssue({ code: "custom", message: "Expected 'true' or 'false'" });
  return z.NEVER;
});

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  TRUST_PROXY: booleanFromString.default(false),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  DATABASE_URL: z.url().optional(),
  DATABASE_URL_DEV: z.url().optional(),
  DIRECT_URL: z.url().optional(),
  JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_REFRESH_SECRET: z.string().min(32).optional(),
  JWT_ISSUER: z.string().min(1).default("buddyscript-api"),
  JWT_AUDIENCE: z.string().min(1).default("buddyscript-web"),
  JWT_KEY_ID: z.string().min(1).default("primary-2026"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3_600).default(600),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(3_600).max(31_536_000).default(2_592_000),
  COOKIE_SECURE: booleanFromString.optional(),
  CURSOR_SIGNING_SECRET: z.string().min(32).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().min(1).optional(),
  CLOUDINARY_POST_FOLDER: z.string().regex(/^[A-Za-z0-9_-]+$/).default("buddyscript"),
  CLOUDINARY_MAX_IMAGE_BYTES: z.coerce.number().int().min(100_000).max(20_000_000).default(5_000_000),
  CACHE_ENABLED: booleanFromString.default(true),
  CACHE_PUBLIC_FEED_TTL_SECONDS: z.coerce.number().int().min(1).max(60).default(5),
  CACHE_MAX_KEYS: z.coerce.number().int().min(10).max(100_000).default(1_000),
});

export type Environment = Readonly<{
  nodeEnv: z.infer<typeof envSchema>["NODE_ENV"];
  port: number;
  logLevel: z.infer<typeof envSchema>["LOG_LEVEL"];
  trustProxy: boolean;
  allowedOrigins: ReadonlySet<string>;
  shutdownTimeoutMs: number;
  databaseUrl?: string;
  directUrl?: string;
  jwtAccessSecret?: string;
  jwtRefreshSecret?: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtKeyId: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  cookieSecure: boolean;
  cursorSigningSecret?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  cloudinaryPostFolder: string;
  cloudinaryMaxImageBytes: number;
  cacheEnabled: boolean;
  cachePublicFeedTtlSeconds: number;
  cacheMaxKeys: number;
}>;

export class EnvironmentValidationError extends Error {
  constructor(readonly details: string[]) {
    super("Invalid environment configuration");
    this.name = "EnvironmentValidationError";
  }
}

export function loadEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new EnvironmentValidationError(result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`));
  }

  const allowedOrigins = new Set(
    result.data.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  );
  const databaseUrl = result.data.DATABASE_URL ?? result.data.DATABASE_URL_DEV;
  const directUrl = result.data.DIRECT_URL ?? databaseUrl;

  return Object.freeze({
    nodeEnv: result.data.NODE_ENV,
    port: result.data.PORT,
    logLevel: result.data.LOG_LEVEL,
    trustProxy: result.data.TRUST_PROXY,
    allowedOrigins,
    shutdownTimeoutMs: result.data.SHUTDOWN_TIMEOUT_MS,
    ...(databaseUrl === undefined ? {} : { databaseUrl }),
    ...(directUrl === undefined ? {} : { directUrl }),
    ...(result.data.JWT_ACCESS_SECRET === undefined ? {} : { jwtAccessSecret: result.data.JWT_ACCESS_SECRET }),
    ...(result.data.JWT_REFRESH_SECRET === undefined ? {} : { jwtRefreshSecret: result.data.JWT_REFRESH_SECRET }),
    jwtIssuer: result.data.JWT_ISSUER,
    jwtAudience: result.data.JWT_AUDIENCE,
    jwtKeyId: result.data.JWT_KEY_ID,
    accessTokenTtlSeconds: result.data.ACCESS_TOKEN_TTL_SECONDS,
    refreshTokenTtlSeconds: result.data.REFRESH_TOKEN_TTL_SECONDS,
    cookieSecure: result.data.COOKIE_SECURE ?? result.data.NODE_ENV === "production",
    ...(result.data.CURSOR_SIGNING_SECRET === undefined ? {} : { cursorSigningSecret: result.data.CURSOR_SIGNING_SECRET }),
    ...(result.data.CLOUDINARY_CLOUD_NAME === undefined ? {} : { cloudinaryCloudName: result.data.CLOUDINARY_CLOUD_NAME }),
    ...(result.data.CLOUDINARY_API_KEY === undefined ? {} : { cloudinaryApiKey: result.data.CLOUDINARY_API_KEY }),
    ...(result.data.CLOUDINARY_API_SECRET === undefined ? {} : { cloudinaryApiSecret: result.data.CLOUDINARY_API_SECRET }),
    cloudinaryPostFolder: result.data.CLOUDINARY_POST_FOLDER,
    cloudinaryMaxImageBytes: result.data.CLOUDINARY_MAX_IMAGE_BYTES,
    cacheEnabled: result.data.CACHE_ENABLED,
    cachePublicFeedTtlSeconds: result.data.CACHE_PUBLIC_FEED_TTL_SECONDS,
    cacheMaxKeys: result.data.CACHE_MAX_KEYS,
  });
}
