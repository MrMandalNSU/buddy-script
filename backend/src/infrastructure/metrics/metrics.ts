import type { RequestHandler } from "express";
import { collectDefaultMetrics, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: "buddyscript_" });

const requestDuration = new Histogram({
  name: "buddyscript_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"] as const,
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

export const metricsMiddleware: RequestHandler = (request, response, next) => {
  const end = requestDuration.startTimer();
  response.once("finish", () => {
    const route: unknown = request.route;
    const routePath: unknown = typeof route === "object" && route !== null && "path" in route ? route.path : undefined;
    const stableRoute = typeof routePath === "string" ? `${request.baseUrl}${routePath}` : "unmatched";
    end({ method: request.method, route: stableRoute, status_code: String(response.statusCode) });
  });
  next();
};
