import { describe, expect, it } from "vitest";
import { createMetrics } from "./metrics.js";

describe("createMetrics", () => {
  it("initializes registry, middleware, and metrics handler with custom metrics", async () => {
    const {
      register,
      metricsMiddleware,
      metricsHandler,
      httpRequestsTotal,
      httpRequestsInFlight,
      recordCacheHit,
      recordCacheMiss,
      recordRateLimitExceeded,
      recordKafkaMessage,
    } = createMetrics("test-service");

    expect(register).toBeDefined();
    expect(metricsMiddleware).toBeTypeOf("function");
    expect(metricsHandler).toBeTypeOf("function");
    expect(httpRequestsTotal).toBeDefined();
    expect(httpRequestsInFlight).toBeDefined();

    recordCacheHit("cache:test:");
    recordCacheMiss("cache:test:");
    recordRateLimitExceeded("limit:test:");
    recordKafkaMessage("send-mail", "success");

    const metricsOutput = await register.metrics();
    expect(metricsOutput).toContain("test-service");
    expect(metricsOutput).toContain("http_requests_total");
    expect(metricsOutput).toContain("http_requests_in_flight");
    expect(metricsOutput).toMatch(/redis_cache_hits_total\{.*prefix="cache:test:".*\} 1/);
    expect(metricsOutput).toMatch(/redis_cache_misses_total\{.*prefix="cache:test:".*\} 1/);
    expect(metricsOutput).toMatch(/rate_limit_exceeded_total\{.*prefix="limit:test:".*\} 1/);
    expect(metricsOutput).toMatch(/kafka_messages_total\{.*topic="send-mail".*status="success".*\} 1/);
  });

  it("updates request metrics on HTTP finish event", async () => {
    const { register, metricsMiddleware } = createMetrics("auth-service");

    const finishHandlers: Array<() => void> = [];
    const req: any = { method: "POST", route: { path: "/api/auth/login" } };
    const res: any = {
      statusCode: 200,
      on: (event: string, handler: () => void) => {
        if (event === "finish") finishHandlers.push(handler);
      },
    };
    let nextCalled = false;
    const next = () => {
      nextCalled = true;
    };

    metricsMiddleware(req, res, next);
    expect(nextCalled).toBe(true);

    finishHandlers.forEach((handler) => handler());

    const metricsOutput = await register.metrics();
    expect(metricsOutput).toMatch(/http_requests_total\{.*method="POST".*route="\/api\/auth\/login".*status_code="200".*\} 1/);
    expect(metricsOutput).toMatch(/http_request_duration_seconds_count\{.*method="POST".*route="\/api\/auth\/login".*status_code="200".*\} 1/);
  });
});
