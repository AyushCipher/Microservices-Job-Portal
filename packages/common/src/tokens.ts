import jwt, { JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { RedisClientType } from "redis";

export interface TokenSubject {
  id: number;
  role: string;
}

export interface AccessTokenPayload extends TokenSubject, JwtPayload {
  type: "access";
}

export interface RefreshTokenPayload extends TokenSubject, JwtPayload {
  type: "refresh";
}

const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const signAccessToken = (subject: TokenSubject, secret: string) => {
  const jti = randomUUID();

  const token = jwt.sign({ ...subject, type: "access" }, secret, {
    expiresIn: ACCESS_TOKEN_TTL,
    jwtid: jti,
  });

  return { token, jti };
};


export const signRefreshToken = (subject: TokenSubject, secret: string) => {
  const jti = randomUUID();

  const token = jwt.sign({ ...subject, type: "refresh" }, secret, {
    expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    jwtid: jti,
  });

  return { token, jti };
};


export const verifyToken = <T extends JwtPayload = JwtPayload>(
  token: string,
  secret: string
): T => jwt.verify(token, secret) as T;

const refreshKey = (jti: string) => `refresh:${jti}`;
const blacklistKey = (jti: string) => `blacklist:${jti}`;


/** Stores a refresh token's jti so it can be looked up / revoked on logout. */
export const storeRefreshToken = async (
  redisClient: RedisClientType,
  userId: number,
  jti: string
) => {
  await redisClient.set(refreshKey(jti), String(userId), {
    EX: REFRESH_TOKEN_TTL_SECONDS,
  });
};


export const isRefreshTokenValid = async (
  redisClient: RedisClientType,
  jti: string
) => (await redisClient.get(refreshKey(jti))) !== null;


export const revokeRefreshToken = async (
  redisClient: RedisClientType,
  jti: string
) => {
  await redisClient.del(refreshKey(jti));
};


/** Blacklists an access token's jti for the remainder of its natural lifetime (logout). */
export const blacklistAccessToken = async (
  redisClient: RedisClientType,
  jti: string,
  remainingTtlSeconds: number
) => {
  if (remainingTtlSeconds <= 0) return;
  await redisClient.set(blacklistKey(jti), "1", { EX: remainingTtlSeconds });
};

export const isAccessTokenBlacklisted = async (
  redisClient: RedisClientType,
  jti: string
) => (await redisClient.get(blacklistKey(jti))) !== null;
