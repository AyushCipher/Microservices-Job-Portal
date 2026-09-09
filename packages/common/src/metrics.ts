import { NextFunction, Request, Response } from "express";
import {
  Registry,
  Histogram,
  Counter,
  Gauge,
  collectDefaultMetrics,
} from "prom-client";

export interface ServiceMetrics {
  register: Registry;
  metricsMiddleware: (req: Request, res: Response, next: NextFunction) => void;
  metricsHandler: (_req: Request, res: Response) => Promise<void>;
  httpRequestDuration: Histogram<string>;
  httpRequestsTotal: Counter<string>;
  httpRequestsInFlight: Gauge<string>;
  redisCacheHits: Counter<string>;
  redisCacheMisses: Counter<string>;
  rateLimitExceeded: Counter<string>;
  kafkaMessagesTotal: Counter<string>;
  recordCacheHit: (prefix: string) => void;
  recordCacheMiss: (prefix: string) => void;
  recordRateLimitExceeded: (prefix: string) => void;
  recordKafkaMessage: (topic: string, status: "success" | "error") => void;
}

export const createMetrics = (serviceName: string): ServiceMetrics => {
  const register = new Registry();

  register.setDefaultLabels({ service: serviceName });
  collectDefaultMetrics({ register });

  const httpRequestDuration = new Histogram({
    name: "http_request_duration_seconds",
    help: "Duration of HTTP requests in seconds",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  });

  const httpRequestsTotal = new Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests handled",
    labelNames: ["method", "route", "status_code"],
    registers: [register],
  });

  const httpRequestsInFlight = new Gauge({
    name: "http_requests_in_flight",
    help: "Current number of HTTP requests currently being processed",
    registers: [register],
  });

  const redisCacheHits = new Counter({
    name: "redis_cache_hits_total",
    help: "Total number of Redis cache hits",
    labelNames: ["prefix"],
    registers: [register],
  });

  const redisCacheMisses = new Counter({
    name: "redis_cache_misses_total",
    help: "Total number of Redis cache misses",
    labelNames: ["prefix"],
    registers: [register],
  });

  const rateLimitExceeded = new Counter({
    name: "rate_limit_exceeded_total",
    help: "Total number of requests rejected by rate limiting",
    labelNames: ["prefix"],
    registers: [register],
  });

  const kafkaMessagesTotal = new Counter({
    name: "kafka_messages_total",
    help: "Total number of Kafka events processed or produced",
    labelNames: ["topic", "status"],
    registers: [register],
  });

  const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    httpRequestsInFlight.inc();
    const endTimer = httpRequestDuration.startTimer();

    res.on("finish", () => {
      httpRequestsInFlight.dec();
      const route = req.route?.path || req.path;
      const statusCode = res.statusCode ? res.statusCode.toString() : "200";

      endTimer({
        method: req.method,
        route,
        status_code: statusCode,
      });

      httpRequestsTotal.inc({
        method: req.method,
        route,
        status_code: statusCode,
      });
    });

    next();
  };

  const metricsHandler = async (_req: Request, res: Response) => {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  };

  const recordCacheHit = (prefix: string) => {
    redisCacheHits.inc({ prefix });
  };

  const recordCacheMiss = (prefix: string) => {
    redisCacheMisses.inc({ prefix });
  };

  const recordRateLimitExceeded = (prefix: string) => {
    rateLimitExceeded.inc({ prefix });
  };

  const recordKafkaMessage = (topic: string, status: "success" | "error") => {
    kafkaMessagesTotal.inc({ topic, status });
  };

  return {
    register,
    metricsMiddleware,
    metricsHandler,
    httpRequestDuration,
    httpRequestsTotal,
    httpRequestsInFlight,
    redisCacheHits,
    redisCacheMisses,
    rateLimitExceeded,
    kafkaMessagesTotal,
    recordCacheHit,
    recordCacheMiss,
    recordRateLimitExceeded,
    recordKafkaMessage,
  };
};
