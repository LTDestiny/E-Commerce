// ==========================================
// Order Repository - PostgreSQL (Prisma)
// ==========================================

import {
  Order,
  OrderStatus,
  OrderItem,
  ShippingAddress,
  CreateOrderRequest,
} from "@ecommerce/shared";
import { prisma } from "../lib/prisma";
import { OrderRow } from "../types";

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customerId: row.customerId,
    items: row.items as OrderItem[],
    totalAmount: row.totalAmount,
    shippingAddress: row.shippingAddress as ShippingAddress,
    status: row.status as OrderStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

class OrderRepository {
  async create(request: CreateOrderRequest): Promise<Order> {
    const totalAmount = request.items.reduce(
      (sum: number, item: any) => sum + item.unitPrice * item.quantity,
      0,
    );

    const row = await prisma.order.create({
      data: {
        customerId: request.customerId,
        items: request.items as object[],
        totalAmount,
        shippingAddress: request.shippingAddress as object,
        status: OrderStatus.PENDING,
      },
    });

    return toOrder(row);
  }

  async findById(id: string): Promise<Order | null> {
    const row = await prisma.order.findUnique({ where: { id } });
    return row ? toOrder(row) : null;
  }

  async findAll(): Promise<Order[]> {
    const rows = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toOrder);
  }

  async findByCustomerId(customerId: string): Promise<Order[]> {
    const rows = await prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toOrder);
  }

  async updateStatus(id: string, status: OrderStatus): Promise<Order | null> {
    try {
      const row = await prisma.order.update({
        where: { id },
        data: { status },
      });
      return toOrder(row);
    } catch {
      return null;
    }
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    totalRevenue: number;
  }> {
    const [total, revenue, orders] = await Promise.all([
      prisma.order.count(),
      prisma.order.aggregate({ _sum: { totalAmount: true } }),
      prisma.order.findMany({ select: { status: true } }),
    ]);

    const byStatus: Record<string, number> = {};
    orders.forEach((o) => {
      byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    });

    return {
      total,
      byStatus,
      totalRevenue: revenue._sum.totalAmount || 0,
    };
  }
}

export const orderRepository = new OrderRepository();
