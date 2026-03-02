// ==========================================
// Payment Repository - PostgreSQL (Prisma)
// ==========================================

import { Payment, PaymentStatus, PaymentMethod } from "@ecommerce/shared";
import { prisma } from "../lib/prisma";
import { PaymentRow } from "../types";

function toPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    orderId: row.orderId,
    customerId: row.customerId,
    amount: row.amount,
    currency: row.currency,
    method: row.method as PaymentMethod,
    status: row.status as PaymentStatus,
    transactionId: row.transactionId || undefined,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

class PaymentRepository {
  async create(
    orderId: string,
    customerId: string,
    amount: number,
    method: PaymentMethod = PaymentMethod.CREDIT_CARD,
  ): Promise<Payment> {
    const row = await prisma.payment.create({
      data: {
        orderId,
        customerId,
        amount,
        currency: "VND",
        method,
        status: PaymentStatus.PENDING,
        idempotencyKey: `payment-${orderId}`,
      },
    });
    return toPayment(row);
  }

  async findById(id: string): Promise<Payment | null> {
    const row = await prisma.payment.findUnique({ where: { id } });
    return row ? toPayment(row) : null;
  }

  async findByOrderId(orderId: string): Promise<Payment | null> {
    const row = await prisma.payment.findFirst({ where: { orderId } });
    return row ? toPayment(row) : null;
  }

  async findAll(): Promise<Payment[]> {
    const rows = await prisma.payment.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toPayment);
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    transactionId?: string,
  ): Promise<Payment | null> {
    try {
      const data: { status: string; transactionId?: string } = { status };
      if (transactionId) data.transactionId = transactionId;

      const row = await prisma.payment.update({
        where: { id },
        data,
      });
      return toPayment(row);
    } catch {
      return null;
    }
  }
}

export const paymentRepository = new PaymentRepository();
