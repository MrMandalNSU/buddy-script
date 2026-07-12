import { Router } from "express";
import type { ReadinessState } from "../infrastructure/lifecycle/readiness.js";
import { successEnvelope } from "../shared/http/envelope.js";

export function createHealthRouter(readiness: ReadinessState): Router {
  const router = Router();

  router.get("/live", (request, response) => {
    response.json(successEnvelope({ status: "alive", uptimeSeconds: Math.floor(process.uptime()) }, request.requestId));
  });

  router.get("/ready", (request, response) => {
    const ready = readiness.isReady();
    response.status(ready ? 200 : 503).json(successEnvelope({ status: ready ? "ready" : "not_ready" }, request.requestId));
  });

  return router;
}
