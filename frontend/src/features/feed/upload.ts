import { z } from "zod";
import { apiRequest } from "@/shared/api/client";
import type { VerifiedImage } from "./types";
const signatureSchema = z.object({ signature: z.string(), timestamp: z.number(), folder: z.string(), cloudName: z.string(), apiKey: z.string(), uploadUrl: z.string(), constraints: z.object({ maxBytes: z.number(), formats: z.array(z.string()) }), signedParameters: z.object({ allowedFormats: z.string(), tags: z.string(), context: z.string() }) });
const cloudinarySchema = z.object({ public_id: z.string(), secure_url: z.string(), version: z.number(), width: z.number(), height: z.number(), bytes: z.number(), format: z.string(), signature: z.string() });
export async function uploadPostImage(file: File, onProgress: (progress: number) => void, signal: AbortSignal): Promise<VerifiedImage & { signature: string }> {
  const signed = await apiRequest<z.infer<typeof signatureSchema>>("/api/v1/uploads/signature", { method: "POST", schema: signatureSchema });
  if (file.size > signed.constraints.maxBytes || !signed.constraints.formats.includes(file.type.split("/")[1] ?? "")) throw new Error("Choose a supported image within the upload size limit.");
  const form = new FormData(); form.set("file", file); form.set("api_key", signed.apiKey); form.set("timestamp", String(signed.timestamp)); form.set("folder", signed.folder); form.set("signature", signed.signature); form.set("allowed_formats", signed.signedParameters.allowedFormats); form.set("tags", signed.signedParameters.tags); form.set("context", signed.signedParameters.context);
  const raw = await xhrUpload(signed.uploadUrl, form, onProgress, signal); const uploaded = cloudinarySchema.parse(raw);
  return { publicId: uploaded.public_id, secureUrl: uploaded.secure_url, version: uploaded.version, width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes, format: uploaded.format, signature: uploaded.signature };
}
function xhrUpload(url: string, body: FormData, onProgress: (progress: number) => void, signal: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => { const xhr = new XMLHttpRequest(); xhr.open("POST", url); xhr.responseType = "json"; xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); }; xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.response) : reject(new Error("Image upload failed.")); xhr.onerror = () => reject(new Error("Image upload failed.")); xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError")); signal.addEventListener("abort", () => xhr.abort(), { once: true }); xhr.send(body); });
}
