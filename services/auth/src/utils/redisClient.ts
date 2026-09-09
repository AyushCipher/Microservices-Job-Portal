import dotenv from "dotenv";
dotenv.config();

import { createRedisClient, createRateLimiter, createCache } from "@hireheaven/common";

export const redisClient = createRedisClient({
  url: process.env.Redis_url,
  label: "Auth service",
});

export const rateLimiter = createRateLimiter(redisClient);
export const cache = createCache(redisClient);