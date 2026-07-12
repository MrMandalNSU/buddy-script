export interface CachePort {
  get(key: string): unknown;
  set(key: string, value: unknown, ttlSeconds: number): void;
  delete(key: string): void;
  deleteByPrefix(prefix: string): number;
  wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T>;
  stats(): { keys: number; hits: number; misses: number };
  close(): void;
}
