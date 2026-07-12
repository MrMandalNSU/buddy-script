export interface PageOptions {
  limit?: number;
}

export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export function normalizePageLimit(limit?: number): number {
  if (limit === undefined) return DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(limit, MAX_PAGE_SIZE);
}

export function takePage<T>(rows: T[], limit: number): Page<T> {
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}
