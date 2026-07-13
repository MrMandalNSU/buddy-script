import { describe, expect, it } from "vitest";
import { avatarForUser } from "./avatar.service.js";
describe("stock avatar assignment", () => { it("is deterministic and bounded to bundled assets", () => { const first = avatarForUser("01900000-0000-7000-8000-000000000001"); expect(avatarForUser("01900000-0000-7000-8000-000000000001")).toBe(first); expect(first).toMatch(/^\/assets\/img[1-8]\.png$/); }); });
