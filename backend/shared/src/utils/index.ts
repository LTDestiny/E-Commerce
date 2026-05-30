// ==========================================
// Shared Utilities
// ==========================================

import { v4 as uuidv4 } from "uuid";

/**
 * Generate unique ID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 * Pattern: Retry Mechanism
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        console.log(
          `Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`,
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

/**
 * Idempotency key store (in-memory for dev)
 * Pattern: Idempotency Pattern
 */
export class IdempotencyStore {
  private processedKeys: Map<string, { result: unknown; processedAt: string }> =
    new Map();

  async check(key: string): Promise<boolean> {
    return this.processedKeys.has(key);
  }

  async store(key: string, result: unknown): Promise<void> {
    this.processedKeys.set(key, {
      result,
      processedAt: new Date().toISOString(),
    });
  }

  async getResult(key: string): Promise<unknown | null> {
    return this.processedKeys.get(key)?.result ?? null;
  }
}

/**
 * Redis-backed Idempotency Store
 * Stores the result as JSON under a key with TTL (milliseconds)
 */
import Redis from "ioredis";

export class RedisIdempotencyStore {
  private redis: Redis;
  private defaultTtlMs: number;

  constructor(redisUrl: string, defaultTtlMs = 60_000 * 5) {
    this.redis = new Redis(redisUrl);
    this.defaultTtlMs = defaultTtlMs;
  }

  async check(key: string): Promise<boolean> {
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async store(key: string, result: unknown, ttlMs?: number): Promise<void> {
    const value = JSON.stringify({
      result,
      storedAt: new Date().toISOString(),
    });
    const ttl = Math.ceil((ttlMs ?? this.defaultTtlMs) / 1000);
    await this.redis.set(key, value, "EX", ttl);
  }

  async getResult(key: string): Promise<unknown | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed.result ?? null;
    } catch {
      return null;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

/**
 * Circuit Breaker Pattern
 */
export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: Date;
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly successThreshold: number;

  constructor(
    failureThreshold = 5,
    recoveryTimeoutMs = 30000,
    successThreshold = 3,
  ) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeoutMs;
    this.successThreshold = successThreshold;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error("Circuit breaker is OPEN - request rejected");
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        console.log("[CircuitBreaker] State: CLOSED (recovered)");
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = new Date();
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.log("[CircuitBreaker] State: OPEN (failures exceeded threshold)");
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.recoveryTimeout;
  }
}
