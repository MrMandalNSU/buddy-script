import "dotenv/config";
import { defineConfig } from "prisma/config";

const migrationUrl = process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? process.env.DATABASE_URL_DEV;

if (migrationUrl === undefined || migrationUrl.length === 0) {
  throw new Error("DIRECT_URL, DATABASE_URL, or DATABASE_URL_DEV is required for Prisma CLI commands");
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --import tsx prisma/seed.ts",
  },
  datasource: { url: migrationUrl },
});
