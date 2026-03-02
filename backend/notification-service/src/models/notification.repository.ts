// ==========================================
// Notification Repository - PostgreSQL (Prisma)
// ==========================================

import {
  Notification,
  NotificationType,
  NotificationStatus,
} from "@ecommerce/shared";
import { prisma } from "../lib/prisma";
import { NotificationRow } from "../types";

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    orderId: row.orderId,
    customerId: row.customerId,
    type: row.type as NotificationType,
    subject: row.subject,
    body: row.body,
    status: row.status as NotificationStatus,
    sentAt: row.sentAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

class NotificationRepository {
  async create(
    orderId: string,
    customerId: string,
    type: NotificationType,
    subject: string,
    body: string,
  ): Promise<Notification> {
    const row = await prisma.notification.create({
      data: {
        orderId,
        customerId,
        type,
        subject,
        body,
        status: NotificationStatus.PENDING,
      },
    });
    return toNotification(row);
  }

  async findAll(): Promise<Notification[]> {
    const rows = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toNotification);
  }

  async findById(id: string): Promise<Notification | null> {
    const row = await prisma.notification.findUnique({ where: { id } });
    return row ? toNotification(row) : null;
  }

  async findByOrderId(orderId: string): Promise<Notification[]> {
    const rows = await prisma.notification.findMany({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toNotification);
  }

  async updateStatus(
    id: string,
    status: NotificationStatus,
  ): Promise<Notification | null> {
    try {
      const data: { status: string; sentAt?: Date } = { status };
      if (status === NotificationStatus.SENT) {
        data.sentAt = new Date();
      }

      const row = await prisma.notification.update({
        where: { id },
        data,
      });
      return toNotification(row);
    } catch {
      return null;
    }
  }
}

export const notificationRepository = new NotificationRepository();
