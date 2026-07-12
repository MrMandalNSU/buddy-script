import { Router } from "express";
import { openApiDocument } from "../openapi/document.js";

export function createOpenApiRouter(): Router {
  const router = Router();
  router.get("/openapi.json", (_request, response) => response.json(openApiDocument));
  return router;
}
