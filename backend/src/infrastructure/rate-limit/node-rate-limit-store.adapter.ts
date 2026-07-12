import NodeCache from "node-cache";
import type { RateLimitRecord, RateLimitStorePort } from "./rate-limit-store.port.js";

export class NodeRateLimitStoreAdapter implements RateLimitStorePort {
  readonly #cache = new NodeCache({ useClones: true, deleteOnExpire: true, checkperiod: 30 });

  increment(key: string, windowMs: number): RateLimitRecord {
    const current = this.#cache.get<RateLimitRecord>(key);
    if (current === undefined || current.resetAt <= new Date()) {
      const created = { totalHits: 1, resetAt: new Date(Date.now() + windowMs) };
      this.#cache.set(key, created, Math.ceil(windowMs / 1_000)); return created;
    }
    const updated = { ...current, totalHits: current.totalHits + 1 };
    this.#cache.set(key, updated, Math.max(1, Math.ceil((current.resetAt.getTime() - Date.now()) / 1_000))); return updated;
  }

  decrement(key: string): void {
    const current = this.#cache.get<RateLimitRecord>(key);
    if (current !== undefined && current.totalHits > 0) this.#cache.set(key, { ...current, totalHits: current.totalHits - 1 });
  }
  reset(key: string): void { this.#cache.del(key); }
  resetAll(): void { this.#cache.flushAll(); }
  close(): void { this.#cache.close(); this.#cache.flushAll(); }
}
