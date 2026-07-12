import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AppError } from "../errors/app-error.js";

const cursorPayloadSchema = z.object({
  v: z.literal(1),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
}).strict();

export interface TimelineCursor { createdAt: Date; id: string }

export class CursorService {
  constructor(readonly secret: string) {
    if (Buffer.byteLength(secret) < 32) throw new Error("Cursor signing secret must contain at least 32 bytes");
  }

  encode(cursor: TimelineCursor): string {
    const payload = Buffer.from(JSON.stringify({ v: 1, createdAt: cursor.createdAt.toISOString(), id: cursor.id })).toString("base64url");
    return `${payload}.${this.sign(payload)}`;
  }

  decode(value: string): TimelineCursor {
    try {
      const [payload, signature, extra] = value.split(".");
      if (payload === undefined || signature === undefined || extra !== undefined || !this.validSignature(payload, signature)) throw new Error("Invalid signature");
      const parsed = cursorPayloadSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
      return { createdAt: new Date(parsed.createdAt), id: parsed.id };
    } catch {
      throw new AppError(400, "BAD_REQUEST", "The pagination cursor is invalid");
    }
  }

  private sign(payload: string): string { return createHmac("sha256", this.secret).update(payload).digest("base64url"); }
  private validSignature(payload: string, signature: string): boolean {
    const expected = Buffer.from(this.sign(payload)); const received = Buffer.from(signature);
    return expected.length === received.length && timingSafeEqual(expected, received);
  }
}
