// ==========================================
// Notification Event Handlers
// Pub-Sub: Listens to multiple events → Send notifications
// ==========================================

import {
  DomainEvent,
  EVENT_CHANNELS,
  NotificationType,
  NotificationStatus,
  IEventBus,
  IEventStore,
  createEvent,
  NotificationSentEvent,
  retryWithBackoff,
} from "@ecommerce/shared";
import { notificationRepository } from "../models/notification.repository";
import { config } from "../config";
import { IdempotencyStore, RedisIdempotencyStore } from "@ecommerce/shared";
import { renderPaymentSuccessEmail, sendEmail } from "../lib/mailer";

type CustomerContact = {
  id: string;
  name?: string;
  email?: string;
};

async function fetchCustomerContact(customerId: string): Promise<CustomerContact | null> {
  try {
    const res = await fetch(`${config.services.auth}/api/users/${customerId}`, {
      headers: {
        "x-user-id": "notification-service",
        "x-user-email": "notification-service@internal.local",
        "x-user-role": "ADMIN",
        "x-user-name": encodeURIComponent("Notification Service"),
      },
    });

    if (!res.ok) {
      console.warn(`[${config.serviceName}] Failed to fetch customer ${customerId}: ${res.status}`);
      return null;
    }

    return (await res.json()) as CustomerContact;
  } catch (error) {
    console.warn(`[${config.serviceName}] Customer lookup failed for ${customerId}:`, error);
    return null;
  }
}

export function registerEventHandlers(
  eventBus: IEventBus,
  eventStore: IEventStore,
): void {
  const idempotencyStore = process.env.REDIS_URL
    ? new RedisIdempotencyStore(process.env.REDIS_URL)
    : new IdempotencyStore();
  // ----- Listen: Order Placed → Send confirmation email -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_PLACED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_PLACED") return;
      await eventStore.append(event);

      try {
        const { orderId, customerId, totalAmount } = event.payload;
        await sendNotification(
          orderId,
          customerId,
          NotificationType.EMAIL,
          "Đơn hàng đã được tiếp nhận",
          `Đơn hàng #${orderId.slice(0, 8)} với tổng giá trị ${totalAmount.toLocaleString()} VND đã được tiếp nhận. Chúng tôi đang xử lý đơn hàng của bạn.`,
          event.correlationId,
          eventBus,
          eventStore,
          idempotencyStore,
        );
      } catch (err) {
        console.error(
          `[${config.serviceName}] Notification handler error:`,
          err,
        );
        throw err;
      }
    },
  );

  // ----- Listen: Order Confirmed → Send confirmation -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_CONFIRMED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_CONFIRMED") return;
      await eventStore.append(event);

      try {
        const { orderId, customerId } = event.payload;
        await sendNotification(
          orderId,
          customerId,
          NotificationType.EMAIL,
          "Đơn hàng đã được xác nhận",
          `Đơn hàng #${orderId.slice(0, 8)} đã được xác nhận thành công. Thanh toán và kiểm kho hoàn tất.`,
          event.correlationId,
          eventBus,
          eventStore,
          idempotencyStore,
        );
      } catch (err) {
        console.error(
          `[${config.serviceName}] Notification handler error:`,
          err,
        );
        throw err;
      }
    },
  );

  // ----- Listen: Order Shipped → Send tracking info -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_SHIPPED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_SHIPPED") return;
      await eventStore.append(event);

      try {
        const { orderId, trackingNumber } = event.payload;
        await sendNotification(
          orderId,
          "customer",
          NotificationType.SMS,
          "Đơn hàng đang được giao",
          `Đơn hàng #${orderId.slice(0, 8)} đã được giao cho đơn vị vận chuyển. Mã tracking: ${trackingNumber}`,
          event.correlationId,
          eventBus,
          eventStore,
          idempotencyStore,
        );
      } catch (err) {
        console.error(
          `[${config.serviceName}] Notification handler error:`,
          err,
        );
        throw err;
      }
    },
  );

  // ----- Listen: Order Cancelled → Notify customer -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_CANCELLED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_CANCELLED") return;
      await eventStore.append(event);

      try {
        const { orderId, customerId, reason } = event.payload;
        await sendNotification(
          orderId,
          customerId,
          NotificationType.EMAIL,
          "Đơn hàng đã bị hủy",
          `Đơn hàng #${orderId.slice(0, 8)} đã bị hủy. Lý do: ${reason}. Nếu bạn đã thanh toán, chúng tôi sẽ hoàn tiền trong 3-5 ngày làm việc.`,
          event.correlationId,
          eventBus,
          eventStore,
          idempotencyStore,
        );
      } catch (err) {
        console.error(
          `[${config.serviceName}] Notification handler error:`,
          err,
        );
        throw err;
      }
    },
  );

  // ----- Listen: Payment Failed → Notify customer -----
  eventBus.subscribe(
    EVENT_CHANNELS.PAYMENT_FAILED,
    async (event: DomainEvent) => {
      if (event.type !== "PAYMENT_FAILED") return;
      await eventStore.append(event);

      try {
        const { orderId, reason } = event.payload;
        await sendNotification(
          orderId,
          "customer",
          NotificationType.PUSH,
          "Thanh toán thất bại",
          `Thanh toán cho đơn hàng #${orderId.slice(0, 8)} thất bại: ${reason}. Vui lòng thử lại.`,
          event.correlationId,
          eventBus,
          eventStore,
          idempotencyStore,
        );
      } catch (err) {
        console.error(
          `[${config.serviceName}] Notification handler error:`,
          err,
        );
        throw err;
      }
    },
  );

  // ----- Listen: Payment Processed → Send email + in-app success notification -----
  eventBus.subscribe(
    EVENT_CHANNELS.PAYMENT_PROCESSED,
    async (event: DomainEvent) => {
      if (event.type !== "PAYMENT_PROCESSED") return;
      await eventStore.append(event);

      try {
        const { orderId, amount, transactionId } = event.payload;
        const customerId = String(event.metadata?.customerId || "");

        if (!customerId) {
          console.error(`[${config.serviceName}] Missing customerId in PAYMENT_PROCESSED metadata`);
          return;
        }

        // Fetch order details to get orderCode
        let orderCode = `ORD-${orderId.slice(0, 8)}`;
        try {
          const res = await fetch(`http://order-service:4001/api/orders/${orderId}`, {
            headers: {
              "x-user-id": customerId,
              "x-user-role": "USER",
            }
          });
          if (res.ok) {
            const order = await res.json() as any;
            if (order && order.orderCode) {
              orderCode = order.orderCode;
            }
          }
        } catch (fetchErr) {
          console.error(`[${config.serviceName}] Failed to fetch order details for ${orderId}:`, fetchErr);
        }

        const customer = await fetchCustomerContact(customerId);
        if (!customer?.email) {
          throw new Error(`Cannot send payment success email: customer email not found for ${customerId}`);
        }

        await sendNotification(
          orderId,
          customerId,
          NotificationType.EMAIL,
          "Thanh toán thành công",
          `Thanh toán thành công cho đơn hàng ${orderCode}. Số tiền: ${amount.toLocaleString("vi-VN")} VND. Mã giao dịch: ${transactionId}.`,
          event.correlationId,
          eventBus,
          eventStore,
          idempotencyStore,
          {
            recipientEmail: customer.email,
            emailHtml: renderPaymentSuccessEmail({
              customerName: customer.name,
              orderCode,
              orderId,
              amount,
              transactionId,
            }),
          },
        );

        await sendNotification(
          orderId,
          customerId,
          NotificationType.IN_APP,
          "Thanh toán thành công",
          `Thanh toán thành công cho đơn hàng ${orderCode}. Đơn hàng của bạn đã được ghi nhận.`,
          event.correlationId,
          eventBus,
          eventStore,
          idempotencyStore,
        );
      } catch (err) {
        console.error(
          `[${config.serviceName}] Notification handler error:`,
          err,
        );
        throw err;
      }
    },
  );

  console.log(`[${config.serviceName}] Event handlers registered`);
}

async function sendNotification(
  orderId: string,
  customerId: string,
  type: NotificationType,
  subject: string,
  body: string,
  correlationId: string,
  eventBus: IEventBus,
  eventStore: IEventStore,
  idempotencyStore: any,
  delivery?: {
    recipientEmail?: string;
    emailHtml?: string;
  },
): Promise<void> {
  const idempotencyKey = `notification-${type}-${orderId}-${correlationId}-${subject}`;
  if (await idempotencyStore.check(idempotencyKey)) {
    console.log(
      `[${config.serviceName}] Duplicate notification for ${orderId} (corr=${correlationId}) - skipped`,
    );
    return;
  }

  const notification = await retryWithBackoff(
    () =>
      notificationRepository.create(orderId, customerId, type, subject, body),
    2,
    300,
  );

  try {
    if (type === NotificationType.EMAIL && delivery?.recipientEmail) {
      await sendEmail(
        delivery.recipientEmail,
        subject,
        delivery?.emailHtml || `<p>${body}</p>`,
      );
    }

    await notificationRepository.updateStatus(
      notification.id,
      NotificationStatus.SENT,
    );
  } catch (error) {
    await notificationRepository.updateStatus(
      notification.id,
      NotificationStatus.FAILED,
    );
    throw error;
  }

  const sentEvent = createEvent<NotificationSentEvent>(
    "NOTIFICATION_SENT",
    config.serviceName,
    {
      orderId,
      notificationId: notification.id,
      type,
      recipient: customerId,
    },
    correlationId,
  );

  await eventStore.append(sentEvent);
  await eventBus.publish(EVENT_CHANNELS.NOTIFICATION_SENT, sentEvent);

  await idempotencyStore.store(idempotencyKey, {
    notificationId: notification.id,
  });

  console.log(
    `[${config.serviceName}] 📧 ${type} sent for order ${orderId}: "${subject}"`,
  );
}
