import { Router } from "express";
import { metricsRegistry } from "../infrastructure/metrics/metrics.js";

export function createMetricsRouter(): Router {
  const router = Router();
  router.get("/", async (_request, response, next) => {
    try { response.type(metricsRegistry.contentType).send(await metricsRegistry.metrics()); }
    catch (error) { next(error); }
  });
  return router;
}
