import { NextFunction, Request, Response } from "express";
import { RedisClientType } from "redis";

export interface RateLimiterOptions {
  windowSeconds: number;
  maxRequests: number;
  prefix: string;
}


export const createRateLimiter = (redisClient: RedisClientType) => {
  return ({ windowSeconds, maxRequests, prefix }: RateLimiterOptions) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const identifier = req.ip || "unknown";
        const key = `ratelimit:${prefix}:${identifier}`;

        const current = await redisClient.incr(key);

        if (current === 1) {
          await redisClient.expire(key, windowSeconds);
        }

        // Queries Redis for the remaining "Time to Live" (TTL) on the tracking key to determine how many seconds are left before the user's request limit resets
        const ttl = await redisClient.ttl(key);

        res.setHeader("X-RateLimit-Limit", maxRequests);
        res.setHeader(
          "X-RateLimit-Remaining",
          Math.max(maxRequests - current, 0)
        );

        if (current > maxRequests) {
          res.setHeader("Retry-After", ttl > 0 ? ttl : windowSeconds);
          return res.status(429).json({
            message: "Too many requests. Please try again later.",
          });
        }

        next();
      } catch (error) {
        console.error("Rate limiter error:", error);
        next();
      }
    };
  };
};

export type RateLimiter = ReturnType<typeof createRateLimiter>;
