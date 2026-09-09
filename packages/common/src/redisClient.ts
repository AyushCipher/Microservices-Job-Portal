import { createClient, RedisClientType } from "redis";

export interface CreateRedisClientOptions {
  url: string | undefined;
  label: string;
}

export const createRedisClient = ({url,label,}: CreateRedisClientOptions): RedisClientType => {
  const client = createClient({ url }) as RedisClientType;

  client.on("error", (err) => console.error(`[${label}] Redis Client Error`, err));

  client
    .connect()
    .then(() => console.log(`[${label}] connected to redis`))
    .catch((err) => console.error(`[${label}] failed to connect to redis`, err));

  return client;
};
