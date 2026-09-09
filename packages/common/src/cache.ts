import { RedisClientType } from "redis";

// Default TTL(if not specified any TTL while setting cache entries) for cache entries in seconds
const DEFAULT_TTL_SECONDS = 60;

export const createCache = (redisClient: RedisClientType) => {
  const getCache = async <T>(key: string): Promise<T | null> => {
    try {
      const cached = await redisClient.get(key);
      return cached ? (JSON.parse(cached) as T) : null;
    } catch (error) {
      console.error("Cache read error:", error);
      return null;
    }
  };


  const setCache = async (
    key: string,
    value: unknown,
    ttlSeconds: number = DEFAULT_TTL_SECONDS
  ): Promise<void> => {
    try {
      await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
    } catch (error) {
      console.error("Cache write error:", error);
    }
  };


  const invalidateKey = async (key: string): Promise<void> => {
    try {
      await redisClient.del(key);
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  };


  const invalidateByPrefix = async (prefix: string): Promise<void> => {
    try {
      const keys: string[] = [];

      // node-redis's scanIterator yields batches (arrays of keys) per
      // iteration, not one key at a time — flatten to a single key list.
      for await (const batch of redisClient.scanIterator({
        MATCH: `${prefix}*`,
        COUNT: 100,
      })) {
        if (Array.isArray(batch)) {
          keys.push(...(batch as unknown as string[]));
        } else {
          keys.push(batch as unknown as string);
        }
      }

      if (keys.length > 0) {
        await redisClient.del(keys);
      }
      
    } catch (error) {
      console.error("Cache invalidation error:", error);
    }
  };

  return { getCache, setCache, invalidateKey, invalidateByPrefix };
};

export type Cache = ReturnType<typeof createCache>;
