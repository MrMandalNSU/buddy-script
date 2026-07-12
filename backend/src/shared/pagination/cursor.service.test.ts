import { v7 as uuidv7 } from "uuid";
import { describe, expect, it } from "vitest";
import { CursorService } from "./cursor.service.js";

const service = new CursorService("cursor-secret".repeat(4));

describe("signed cursor service", () => {
  it("round-trips a stable timestamp and UUID", () => {
    const value = { createdAt: new Date("2026-07-12T10:00:00.000Z"), id: uuidv7() };
    expect(service.decode(service.encode(value))).toEqual(value);
  });

  it("rejects tampered and malformed cursors", () => {
    const encoded = service.encode({ createdAt: new Date(), id: uuidv7() });
    expect(() => service.decode(`${encoded}x`)).toThrow("pagination cursor is invalid");
    expect(() => service.decode("not-a-cursor")).toThrow("pagination cursor is invalid");
  });
});
