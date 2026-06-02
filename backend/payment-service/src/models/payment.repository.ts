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
    provider: row.provider,
    qrCode: row.qrCode || undefined,
    transferContent: row.transferContent || undefined,
    paidAt: row.paidAt ? row.paidAt.toISOString() : undefined,
    expiredAt: row.expiredAt ? row.expiredAt.toISOString() : undefined,
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
    const idempotencyKey = `payment-${orderId}`;

    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return toPayment(existing);
    }

    try {
      const row = await prisma.payment.create({
        data: {
          orderId,
          customerId,
          amount,
          currency: "VND",
          method,
          status: PaymentStatus.PENDING,
          idempotencyKey,
          provider: "SEPAY",
        },
      });
      return toPayment(row);
    } catch (error) {
      const duplicate = await prisma.payment.findUnique({
        where: { idempotencyKey },
      });

      if (duplicate) {
        return toPayment(duplicate);
      }

      throw error;
    }
  }

  async createSepay(
    orderId: string,
    customerId: string,
    amount: number,
    qrCode: string,
    transferContent: string,
    expiredAt: Date,
  ): Promise<Payment> {
    const idempotencyKey = `payment-${orderId}`;

    const existing = await prisma.payment.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      return toPayment(existing);
    }

    try {
      const row = await prisma.payment.create({
        data: {
          orderId,
          customerId,
          amount,
          currency: "VND",
          method: "SEPAY_QR",
          status: "PENDING",
          idempotencyKey,
          provider: "SEPAY",
          qrCode,
          transferContent,
          expiredAt,
        },
      });
      return toPayment(row);
    } catch (error) {
      const duplicate = await prisma.payment.findUnique({
        where: { idempotencyKey },
      });

      if (duplicate) {
        return toPayment(duplicate);
      }

      throw error;
    }
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

  async findExpiredPending(now: Date, limit = 100): Promise<Payment[]> {
    const rows = await prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        expiredAt: { lt: now },
      },
      orderBy: { expiredAt: "asc" },
      take: limit,
    });
    return rows.map(toPayment);
  }

  async failPending(id: string): Promise<Payment | null> {
    const result = await prisma.payment.updateMany({
      where: {
        id,
        status: PaymentStatus.PENDING,
      },
      data: {
        status: PaymentStatus.FAILED,
      },
    });

    if (result.count === 0) return null;
    return this.findById(id);
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    transactionId?: string,
    paidAt?: Date,
  ): Promise<Payment | null> {
    try {
      const data: { status: string; transactionId?: string; paidAt?: Date } = { status };
      if (transactionId) data.transactionId = transactionId;
      if (paidAt) data.paidAt = paidAt;

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
