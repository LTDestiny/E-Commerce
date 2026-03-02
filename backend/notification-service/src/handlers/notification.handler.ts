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
} from "@ecommerce/shared";
import { notificationRepository } from "../models/notification.repository";
import { config } from "../config";

export function registerEventHandlers(
  eventBus: IEventBus,
  eventStore: IEventStore,
): void {
  // ----- Listen: Order Placed → Send confirmation email -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_PLACED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_PLACED") return;
      await eventStore.append(event);

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
      );
    },
  );

  // ----- Listen: Order Confirmed → Send confirmation -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_CONFIRMED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_CONFIRMED") return;
      await eventStore.append(event);

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
      );
    },
  );

  // ----- Listen: Order Shipped → Send tracking info -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_SHIPPED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_SHIPPED") return;
      await eventStore.append(event);

      const { orderId, trackingNumber } = event.payload;
      await sendNotification(
        orderId,
        "customer", // In real app, resolve from order
        NotificationType.SMS,
        "Đơn hàng đang được giao",
        `Đơn hàng #${orderId.slice(0, 8)} đã được giao cho đơn vị vận chuyển. Mã tracking: ${trackingNumber}`,
        event.correlationId,
        eventBus,
        eventStore,
      );
    },
  );

  // ----- Listen: Order Cancelled → Notify customer -----
  eventBus.subscribe(
    EVENT_CHANNELS.ORDER_CANCELLED,
    async (event: DomainEvent) => {
      if (event.type !== "ORDER_CANCELLED") return;
      await eventStore.append(event);

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
      );
    },
  );

  // ----- Listen: Payment Failed → Notify customer -----
  eventBus.subscribe(
    EVENT_CHANNELS.PAYMENT_FAILED,
    async (event: DomainEvent) => {
      if (event.type !== "PAYMENT_FAILED") return;
      await eventStore.append(event);

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
      );
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
): Promise<void> {
  const notification = await notificationRepository.create(
    orderId,
    customerId,
    type,
    subject,
    body,
  );

  // Simulate sending (in production: use email/SMS/push service)
  await notificationRepository.updateStatus(
    notification.id,
    NotificationStatus.SENT,
  );

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

  console.log(
    `[${config.serviceName}] 📧 ${type} sent for order ${orderId}: "${subject}"`,
  );
}
