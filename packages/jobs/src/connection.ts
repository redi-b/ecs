import IORedis from "ioredis";

export function createRedisConnection(redisUrl: string) {
  return new IORedis(redisUrl, {
    maxRetriesPerRequest: null, // required by BullMQ
  });
}
