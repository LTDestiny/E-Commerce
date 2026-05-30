// Simple E2E test script: create order via API Gateway and poll Payment service
// Requires services running locally via docker-compose (backend/docker-compose.yml)

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function createOrder() {
  const resp = await fetch("http://localhost:4000/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      customerId: "cust-1",
      items: [
        {
          productId: "prod-1",
          productName: "Product 1",
          quantity: 1,
          unitPrice: 10,
        },
      ],
      shippingAddress: {
        fullName: "Test",
        phone: "0900000000",
        street: "Street",
        city: "City",
        state: "",
        zipCode: "",
        country: "VN",
      },
    }),
  });
  if (!resp.ok) throw new Error("Failed to create order: " + resp.status);
  return resp.json();
}

async function pollPayment(orderId, timeoutMs = 30000) {
  // Poll order events to detect PAYMENT_PROCESSED
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(`http://localhost:4001/api/orders/${orderId}/events`);
    if (r.status === 200) {
      const events = await r.json();
      const paymentEvent = events.find(
        (e) => e.event && e.event.type === "PAYMENT_PROCESSED",
      );
      if (paymentEvent) return paymentEvent;
    }
    await sleep(1000);
  }
  throw new Error("Timed out waiting for payment");
}

(async () => {
  try {
    console.log("Creating order...");
    const order = await createOrder();
    console.log("Order created:", order.id);

    console.log(
      "Waiting for events: payment, stock, shipping, notification...",
    );
    const paymentEvent = await pollPayment(order.id, 60000);
    console.log("Payment event found:", paymentEvent.event.type);

    // wait for stock reserved
    const waitFor = async (type, timeoutMs = 60000) => {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const r = await fetch(
          `http://localhost:4001/api/orders/${order.id}/events`,
        );
        if (r.status === 200) {
          const events = await r.json();
          const ev = events.find((e) => e.event && e.event.type === type);
          if (ev) return ev;
        }
        await sleep(1000);
      }
      throw new Error("Timed out waiting for " + type);
    };

    const stockEvent = await waitFor("STOCK_RESERVED", 60000);
    console.log("Stock event:", stockEvent.event.type);

    const shippingEvent = await waitFor("SHIPPING_SCHEDULED", 120000);
    console.log("Shipping event:", shippingEvent.event.type);

    const notificationEvent = await waitFor("NOTIFICATION_SENT", 120000);
    console.log("Notification event:", notificationEvent.event.type);

    console.log("E2E test succeeded — all events observed");
    process.exit(0);
  } catch (err) {
    console.error("E2E test failed:", err);
    process.exit(1);
  }
})();
