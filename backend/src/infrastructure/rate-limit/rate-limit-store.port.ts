export interface RateLimitRecord { totalHits: number; resetAt: Date }

export interface RateLimitStorePort {
  increment(key: string, windowMs: number): RateLimitRecord;
  decrement(key: string): void;
  reset(key: string): void;
  resetAll(): void;
  close(): void;
}
