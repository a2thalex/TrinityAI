/**
 * Redis Service for caching and session storage
 * Manages Redis connection and provides utility methods
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

class RedisService {
  private client: RedisClientType | null = null;
  private isConnected: boolean = false;

  /**
   * Initialize Redis connection
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      logger.warn('Redis is already connected');
      return;
    }

    try {
      this.client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 5000,
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Max Redis reconnection attempts reached');
              return new Error('Max reconnection attempts reached');
            }
            const delay = Math.min(retries * 100, 3000);
            logger.info(`Reconnecting to Redis in ${delay}ms (attempt ${retries})`);
            return delay;
          }
        }
      });

      // Event handlers
      this.client.on('error', (err) => {
        logger.error('Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Connected to Redis');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Disconnected from Redis');
        this.isConnected = false;
      });

      // Connect
      await this.client.connect();

      // Test connection
      await this.client.ping();
      logger.info('Redis connection successful');

    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('Disconnected from Redis');
    }
  }

  /**
   * Get Redis client
   */
  getClient(): RedisClientType {
    if (!this.client || !this.isConnected) {
      throw new Error('Redis client is not connected');
    }
    return this.client;
  }

  /**
   * Set a key-value pair with optional TTL
   */
  async set(key: string, value: any, ttl?: number): Promise<void> {
    const client = this.getClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl) {
      await client.setEx(key, ttl, serialized);
    } else {
      await client.set(key, serialized);
    }
  }

  /**
   * Get a value by key
   */
  async get<T = any>(key: string): Promise<T | null> {
    const client = this.getClient();
    const value = await client.get(key);

    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as any;
    }
  }

  /**
   * Delete a key
   */
  async delete(key: string): Promise<boolean> {
    const client = this.getClient();
    const result = await client.del(key);
    return result > 0;
  }

  /**
   * Check if a key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = this.getClient();
    const result = await client.exists(key);
    return result > 0;
  }

  /**
   * Get all keys matching a pattern
   */
  async keys(pattern: string): Promise<string[]> {
    const client = this.getClient();
    return await client.keys(pattern);
  }

  /**
   * Set multiple key-value pairs
   */
  async mset(pairs: Record<string, any>): Promise<void> {
    const client = this.getClient();
    const serialized: Record<string, string> = {};

    for (const [key, value] of Object.entries(pairs)) {
      serialized[key] = typeof value === 'string' ? value : JSON.stringify(value);
    }

    await client.mSet(serialized);
  }

  /**
   * Get multiple values by keys
   */
  async mget<T = any>(keys: string[]): Promise<(T | null)[]> {
    const client = this.getClient();
    const values = await client.mGet(keys);

    return values.map(value => {
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return value as any;
      }
    });
  }

  /**
   * Increment a counter
   */
  async incr(key: string): Promise<number> {
    const client = this.getClient();
    return await client.incr(key);
  }

  /**
   * Decrement a counter
   */
  async decr(key: string): Promise<number> {
    const client = this.getClient();
    return await client.decr(key);
  }

  /**
   * Add to a set
   */
  async sadd(key: string, members: string[]): Promise<number> {
    const client = this.getClient();
    return await client.sAdd(key, members);
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string): Promise<string[]> {
    const client = this.getClient();
    return await client.sMembers(key);
  }

  /**
   * Add to a sorted set
   */
  async zadd(key: string, members: { score: number; value: string }[]): Promise<number> {
    const client = this.getClient();
    return await client.zAdd(key, members);
  }

  /**
   * Get range from sorted set
   */
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    const client = this.getClient();
    return await client.zRange(key, start, stop);
  }

  /**
   * Push to a list
   */
  async lpush(key: string, values: string[]): Promise<number> {
    const client = this.getClient();
    return await client.lPush(key, values);
  }

  /**
   * Get range from a list
   */
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const client = this.getClient();
    return await client.lRange(key, start, stop);
  }

  /**
   * Set hash field
   */
  async hset(key: string, field: string, value: any): Promise<number> {
    const client = this.getClient();
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    return await client.hSet(key, field, serialized);
  }

  /**
   * Get hash field
   */
  async hget<T = any>(key: string, field: string): Promise<T | null> {
    const client = this.getClient();
    const value = await client.hGet(key, field);

    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch {
      return value as any;
    }
  }

  /**
   * Get all hash fields
   */
  async hgetall<T = any>(key: string): Promise<Record<string, T>> {
    const client = this.getClient();
    const hash = await client.hGetAll(key);
    const result: Record<string, T> = {};

    for (const [field, value] of Object.entries(hash)) {
      try {
        result[field] = JSON.parse(value) as T;
      } catch {
        result[field] = value as any;
      }
    }

    return result;
  }

  /**
   * Flush all data (use with caution)
   */
  async flushAll(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Cannot flush Redis in production');
    }
    const client = this.getClient();
    await client.flushAll();
    logger.warn('Redis database flushed');
  }
}

// Export singleton instance
export const redisService = new RedisService();

// Export connection function for initialization
export async function connectRedis(): Promise<void> {
  await redisService.connect();
}

// Export disconnect function for cleanup
export async function disconnectRedis(): Promise<void> {
  await redisService.disconnect();
}

export default redisService;