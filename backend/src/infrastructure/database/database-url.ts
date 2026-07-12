import { AppError } from "../../shared/errors/app-error.js";

export function requireDatabaseUrl(databaseUrl: string | undefined): string {
  if (databaseUrl === undefined) {
    throw new AppError(500, "INTERNAL_ERROR", "Database configuration is missing");
  }
  return databaseUrl;
}

export function isPooledNeonUrl(databaseUrl: string): boolean {
  try {
    return new URL(databaseUrl).hostname.includes("-pooler.");
  } catch {
    return false;
  }
}
