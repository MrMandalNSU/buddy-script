import { afterEach, describe, expect, it, vi } from "vitest";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryService } from "./cloudinary.service.js";

const secret = "api-secret";
const service = new CloudinaryService("demo-cloud", "api-key", secret, "buddyscript", 5_000_000, () => 1_720_000_000_000);

function result(overrides: Partial<Parameters<CloudinaryService["verify"]>[1]> = {}) {
  const publicId = "buddyscript/users/user-123/posts/image"; const version = 1;
  return {
    publicId, secureUrl: `https://res.cloudinary.com/demo-cloud/image/upload/v1/${publicId}.jpg`, version,
    width: 1_200, height: 800, bytes: 120_000, format: "jpg",
    signature: cloudinary.utils.api_sign_request({ public_id: publicId, version }, secret), ...overrides,
  };
}

describe("Cloudinary service", () => {
  afterEach(() => vi.restoreAllMocks());
  it("creates owner-scoped short-lived upload parameters", () => {
    expect(service.signature("user-123")).toMatchObject({
      timestamp: 1_720_000_000, folder: "buddyscript/users/user-123/posts", cloudName: "demo-cloud", apiKey: "api-key",
      constraints: { maxBytes: 5_000_000, formats: ["jpg", "jpeg", "png", "webp"] },
    });
  });

  it("accepts valid results and rejects tampering, foreign ownership, and oversized images", () => {
    expect(service.verify("user-123", result())).toMatchObject({ publicId: "buddyscript/users/user-123/posts/image", format: "jpg" });
    expect(() => service.verify("user-123", result({ signature: "tampered" }))).toThrow("signature");
    expect(() => service.verify("other-user", result())).toThrow("authenticated user");
    expect(() => service.verify("user-123", result({ bytes: 5_000_001 }))).toThrow("size");
  });

  it("destroys only assets inside the BuddyScript user post folder", async () => {
    const destroy = vi.spyOn(cloudinary.uploader, "destroy").mockResolvedValue({ result: "ok" });
    await service.destroy("buddyscript/users/user-123/posts/image");
    expect(destroy).toHaveBeenCalledWith("buddyscript/users/user-123/posts/image", { resource_type: "image", invalidate: true });
    await expect(service.destroy("outside/users/user-123/posts/image")).rejects.toThrow("outside");
  });
});
