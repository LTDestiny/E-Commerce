import Redis from "ioredis";
import { InventoryItem } from "@ecommerce/shared";
import { config } from "../config";

const redis = new Redis(config.redis.url);

const PRODUCT_CACHE_TTL_SECONDS = 60;

export function getInventoryProductCacheKey(productId: string): string {
  return `inventory:product:${productId}`;
}

export async function getCachedInventoryProduct(
  productId: string,
): Promise<InventoryItem | null> {
  const key = getInventoryProductCacheKey(productId);
  const cached = await redis.get(key);

  if (!cached) {
    return null;
  }

  return JSON.parse(cached) as InventoryItem;
}

export async function setCachedInventoryProduct(
  productId: string,
  item: InventoryItem,
): Promise<void> {
  const key = getInventoryProductCacheKey(productId);

  await redis.set(
    key,
    JSON.stringify(item),
    "EX",
    PRODUCT_CACHE_TTL_SECONDS,
  );
}

export async function deleteCachedInventoryProduct(
  productId: string,
): Promise<void> {
  const key = getInventoryProductCacheKey(productId);
  await redis.del(key);
}

export async function deleteCachedInventoryProducts(
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) return;

  const keys = productIds.map(getInventoryProductCacheKey);
  await redis.del(...keys);
}

export async function disconnectCache(): Promise<void> {
  await redis.quit();
}