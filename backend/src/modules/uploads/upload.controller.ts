import type { Request, Response } from "express";
import { AppError } from "../../shared/errors/app-error.js";
import { successEnvelope } from "../../shared/http/envelope.js";
import type { CloudinaryService } from "./cloudinary.service.js";

export class UploadController {
  constructor(readonly cloudinary: CloudinaryService) {}
  signature = (request: Request, response: Response): void => {
    if (request.auth === undefined) throw new AppError(401, "UNAUTHORIZED", "Authentication is required");
    response.json(successEnvelope(this.cloudinary.signature(request.auth.userId), request.requestId));
  };
}
