import { timingSafeEqual } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import type { Environment } from "../../config/env.js";
import { AppError } from "../../shared/errors/app-error.js";

export interface VerifiedImage { publicId: string; secureUrl: string; version: number; width: number; height: number; bytes: number; format: string }
export interface CloudinaryUploadResult extends VerifiedImage { signature: string }

export class CloudinaryService {
  readonly allowedFormats = ["jpg", "jpeg", "png", "webp"] as const;
  constructor(
    readonly cloudName: string, readonly apiKey: string, readonly apiSecret: string, readonly rootFolder: string,
    readonly maxImageBytes: number, readonly now: () => number = Date.now,
  ) { cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true }); }

  signature(userId: string) {
    const timestamp = Math.floor(this.now() / 1_000); const folder = this.userFolder(userId);
    const uploadParameters = { timestamp, folder, allowed_formats: this.allowedFormats.join(","), tags: "buddyscript_pending", context: `owner_id=${userId}` };
    return {
      signature: cloudinary.utils.api_sign_request(uploadParameters, this.apiSecret), timestamp, folder,
      cloudName: this.cloudName, apiKey: this.apiKey,
      uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(this.cloudName)}/image/upload`,
      constraints: { maxBytes: this.maxImageBytes, formats: this.allowedFormats },
      signedParameters: { allowedFormats: uploadParameters.allowed_formats, tags: uploadParameters.tags, context: uploadParameters.context },
    };
  }

  verify(userId: string, result: CloudinaryUploadResult): VerifiedImage {
    const expected = cloudinary.utils.api_sign_request({ public_id: result.publicId, version: result.version }, this.apiSecret);
    if (!safeEqual(expected, result.signature)) throw invalidImage("Image upload signature is invalid");
    if (!result.publicId.startsWith(`${this.userFolder(userId)}/`)) throw invalidImage("Image does not belong to the authenticated user");
    let url: URL;
    try { url = new URL(result.secureUrl); } catch { throw invalidImage("Image URL is invalid"); }
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(`/${this.cloudName}/image/upload/`)) throw invalidImage("Image URL is not from the configured Cloudinary account");
    if (!this.allowedFormats.includes(result.format.toLowerCase() as typeof this.allowedFormats[number])) throw invalidImage("Image format is not allowed");
    if (!Number.isInteger(result.bytes) || result.bytes < 1 || result.bytes > this.maxImageBytes) throw invalidImage("Image size is not allowed");
    if (!Number.isInteger(result.width) || !Number.isInteger(result.height) || result.width < 1 || result.height < 1 || result.width > 8_000 || result.height > 8_000) throw invalidImage("Image dimensions are not allowed");
    return { publicId: result.publicId, secureUrl: result.secureUrl, version: result.version, width: result.width, height: result.height, bytes: result.bytes, format: result.format.toLowerCase() };
  }

  private userFolder(userId: string): string { return `${this.rootFolder}/users/${userId}/posts`; }
}

export function createCloudinaryService(environment: Environment): CloudinaryService | undefined {
  if (environment.cloudinaryCloudName === undefined || environment.cloudinaryApiKey === undefined || environment.cloudinaryApiSecret === undefined) return undefined;
  return new CloudinaryService(environment.cloudinaryCloudName, environment.cloudinaryApiKey, environment.cloudinaryApiSecret, environment.cloudinaryPostFolder, environment.cloudinaryMaxImageBytes);
}
function safeEqual(expected: string, received: string): boolean { const left = Buffer.from(expected); const right = Buffer.from(received); return left.length === right.length && timingSafeEqual(left, right); }
function invalidImage(message: string): AppError { return new AppError(422, "VALIDATION_ERROR", message); }
