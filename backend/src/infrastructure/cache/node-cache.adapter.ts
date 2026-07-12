import NodeCache from "node-cache";
import type { CachePort } from "./cache.port.js";

export class NodeCacheAdapter implements CachePort {
  readonly #cache: NodeCache;
  readonly #inflight = new Map<string, Promise<unknown>>();

  constructor(readonly maxKeys: number) {
    this.#cache = new NodeCache({ useClones: true, deleteOnExpire: true, checkperiod: 30, maxKeys });
  }

  get(key: string): unknown { return this.#cache.get(key); }
  set(key: string, value: unknown, ttlSeconds: number): void { this.#cache.set(key, value, ttlSeconds); }
  delete(key: string): void { this.#cache.del(key); }
  deleteByPrefix(prefix: string): number { return this.#cache.del(this.#cache.keys().filter((key) => key.startsWith(prefix))); }

  async wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const cached = this.get(key) as T | undefined;
    if (cached !== undefined) return cached;
    const existing = this.#inflight.get(key) as Promise<T> | undefined;
    if (existing !== undefined) return existing;
    const pending = loader().then((value) => { this.set(key, value, ttlSeconds); return value; }).finally(() => this.#inflight.delete(key));
    this.#inflight.set(key, pending);
    return pending;
  }

  stats() { const stats = this.#cache.getStats(); return { keys: this.#cache.keys().length, hits: stats.hits, misses: stats.misses }; }
  close(): void { this.#cache.close(); this.#cache.flushAll(); this.#inflight.clear(); }
}
