// ==========================================
// Inventory Repository - PostgreSQL (Prisma)
// ==========================================

import { InventoryItem, StockReservation } from "@ecommerce/shared";
import { prisma } from "../lib/prisma";
import {
  InventoryItemRow,
  StockReservationRow,
  FailedStockItem,
} from "../types";
import { deleteCachedInventoryProducts } from "../lib/cache";

function toInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    productId: row.productId,
    productName: row.productName,
    totalStock: row.totalStock,
    reservedStock: row.reservedStock,
    availableStock: row.availableStock,
    lowStockThreshold: row.lowStockThreshold,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toStockReservation(row: StockReservationRow): StockReservation {
  return {
    id: row.id,
    orderId: row.orderId,
    items: row.items as Array<{ productId: string; quantity: number }>,
    status: row.status as StockReservation["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

class InventoryRepository {
  /**
   * Seed products if the inventory table is empty.
   * Called once at service startup.
   */
  async seedIfEmpty(): Promise<void> {
    const products = [] as Array<{
      productId: string;
      productName: string;
      totalStock: number;
      availableStock: number;
      lowStockThreshold: number;
    }>;

    if (products.length === 0) {
      console.log("[Inventory] No seed data inserted; waiting for real PostgreSQL inventory rows.");
      return;
    }

    for (const p of products) {
      await prisma.inventoryItem.upsert({
        where: { productId: p.productId },
        update: {},
        create: p,
      });
    }
    console.log(`[Inventory] Seeded/Ensured ${products.length} products in database`);
  }

  async findAll(): Promise<InventoryItem[]> {
    const rows = await prisma.inventoryItem.findMany();
    return rows.map(toInventoryItem);
  }

  async findByProductId(productId: string): Promise<InventoryItem | null> {
    const row = await prisma.inventoryItem.findUnique({
      where: { productId },
    });
    return row ? toInventoryItem(row) : null;
  }

  async reserveStock(
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<{
    success: boolean;
    reservation?: StockReservation;
    failedItems?: FailedStockItem[];
  }> {
    // Check availability first
    const failedItems: FailedStockItem[] = [];

    for (const item of items) {
      const inv = await prisma.inventoryItem.findUnique({
        where: { productId: item.productId },
      });
      if (!inv || inv.availableStock < item.quantity) {
        failedItems.push({
          productId: item.productId,
          requestedQuantity: item.quantity,
          availableQuantity: inv?.availableStock || 0,
        });
      }
    }

    if (failedItems.length > 0) {
      return { success: false, failedItems };
    }

    // Use a transaction to reserve atomically
    const reservation = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.inventoryItem.update({
          where: { productId: item.productId },
          data: {
            reservedStock: { increment: item.quantity },
            availableStock: { decrement: item.quantity },
          },
        });
      }

      return tx.stockReservation.create({
        data: {
          orderId,
          items: items as object[],
          status: "RESERVED",
        },
      });
    });

    await deleteCachedInventoryProducts(items.map((item) => item.productId));

    return { success: true, reservation: toStockReservation(reservation) };
  }

  async releaseStock(orderId: string): Promise<boolean> {
    const reservation = await prisma.stockReservation.findFirst({
      where: { orderId, status: "RESERVED" },
    });

    if (!reservation) return false;

    const items = reservation.items as Array<{
      productId: string;
      quantity: number;
    }>;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.inventoryItem.update({
          where: { productId: item.productId },
          data: {
            reservedStock: { decrement: item.quantity },
            availableStock: { increment: item.quantity },
          },
        });
      }

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: "RELEASED" },
      });
    });

    await deleteCachedInventoryProducts(items.map((item) => item.productId));

    return true;
  }

  async confirmStockDeduction(orderId: string): Promise<boolean> {
    const reservation = await prisma.stockReservation.findFirst({
      where: { orderId, status: "RESERVED" },
    });

    if (!reservation) return false;

    const items = reservation.items as Array<{
      productId: string;
      quantity: number;
    }>;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.inventoryItem.update({
          where: { productId: item.productId },
          data: {
            totalStock: { decrement: item.quantity },
            reservedStock: { decrement: item.quantity },
          },
        });
      }

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: "COMPLETED" },
      });
    });

    await deleteCachedInventoryProducts(items.map((item) => item.productId));
    return true;
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    const rows = await prisma.$queryRaw<
      InventoryItemRow[]
    >`SELECT * FROM inventory_items WHERE "availableStock" <= "lowStockThreshold"`;
    return rows.map(toInventoryItem);
  }
}

export const inventoryRepository = new InventoryRepository();
