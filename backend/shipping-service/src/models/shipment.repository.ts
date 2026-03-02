// ==========================================
// Shipment Repository - PostgreSQL (Prisma)
// ==========================================

import {
  Shipment,
  ShippingStatus,
  ShippingCarrier,
  ShippingAddress,
} from "@ecommerce/shared";
import { prisma } from "../lib/prisma";
import { ShipmentRow } from "../types";

function toShipment(row: ShipmentRow): Shipment {
  return {
    id: row.id,
    orderId: row.orderId,
    carrier: row.carrier as ShippingCarrier,
    trackingNumber: row.trackingNumber || undefined,
    status: row.status as ShippingStatus,
    estimatedDelivery: row.estimatedDelivery?.toISOString(),
    actualDelivery: row.actualDelivery?.toISOString(),
    shippingAddress: row.shippingAddress as ShippingAddress,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

class ShipmentRepository {
  async create(
    orderId: string,
    shippingAddress: Shipment["shippingAddress"],
    carrier: ShippingCarrier = ShippingCarrier.GIAO_HANG_NHANH,
  ): Promise<Shipment> {
    const estimatedDelivery = new Date();
    estimatedDelivery.setDate(estimatedDelivery.getDate() + 3);

    const row = await prisma.shipment.create({
      data: {
        orderId,
        carrier,
        status: ShippingStatus.SCHEDULED,
        estimatedDelivery,
        shippingAddress: shippingAddress as object,
      },
    });
    return toShipment(row);
  }

  async findById(id: string): Promise<Shipment | null> {
    const row = await prisma.shipment.findUnique({ where: { id } });
    return row ? toShipment(row) : null;
  }

  async findByOrderId(orderId: string): Promise<Shipment | null> {
    const row = await prisma.shipment.findFirst({ where: { orderId } });
    return row ? toShipment(row) : null;
  }

  async findAll(): Promise<Shipment[]> {
    const rows = await prisma.shipment.findMany({
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toShipment);
  }

  async updateStatus(
    id: string,
    status: ShippingStatus,
    trackingNumber?: string,
  ): Promise<Shipment | null> {
    try {
      const data: {
        status: string;
        trackingNumber?: string;
        actualDelivery?: Date;
      } = { status };
      if (trackingNumber) data.trackingNumber = trackingNumber;
      if (status === ShippingStatus.DELIVERED) {
        data.actualDelivery = new Date();
      }

      const row = await prisma.shipment.update({
        where: { id },
        data,
      });
      return toShipment(row);
    } catch {
      return null;
    }
  }
}

export const shipmentRepository = new ShipmentRepository();
