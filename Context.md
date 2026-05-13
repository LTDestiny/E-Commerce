# Project Context - E-Commerce Order Processing System

Last reviewed: 2026-05-01

## Operating Rule For Future Updates

Read this file before making any project change.

After every project update:

1. Update the relevant sections in this file if architecture, commands, data model, event flow, routes, UI behavior, or known issues changed.
2. Add a short entry to "Update Log".
3. Keep this file aligned with the real source code, not only with the design documents.

This file is the working memory for the project. Treat it as the first source of context for future requests, then verify details in source before editing.

## Project Summary

This is an event-driven e-commerce order processing demo for a software architecture/design course.

The implementation is a TypeScript/Node.js microservices system with:

- Next.js frontend on port `3000`.
- API Gateway on port `4000`.
- Order Service on port `4001`.
- Payment Service on port `4002`.
- Inventory Service on port `4003`.
- Shipping Service on port `4004`.
- Notification Service on port `4005`.
- Redis Pub/Sub as the event bus.
- PostgreSQL with one database per service.
- Prisma in each persistence-backed service.

The architecture documents and some frontend labels still mention Java Spring Boot, Kafka/RabbitMQ, EventStoreDB, Kong, etc. The actual runnable implementation is Node.js/TypeScript, Express, Redis Pub/Sub, PostgreSQL, and Prisma.

## Repository Layout

```text
Project/
  Context.md                         # This project memory file
  ecommerce-order-processing.dsl     # Structurizr/C4 architecture model
  Diagram/*.mmd                      # Mermaid architecture diagrams
  Images/*.png                       # Rendered diagrams
  backend/
    docker-compose.yml               # Redis, Postgres, services, frontend
    frontend.Dockerfile              # Dev Dockerfile for Next frontend
    README.md                        # Backend quick start and API docs
    shared/                          # Shared event/types/utils package
    api-gateway/                     # Gateway + SSE stream
    order-service/                   # Order lifecycle and saga state
    payment-service/                 # Payment processing simulation
    inventory-service/               # Stock reservation and seed products
    shipping-service/                # Shipping scheduling simulation
    notification-service/            # Notification log and simulated send
    postgres-init/init.sql           # Creates DBs and base tables
  frontend/
    src/app/                         # Next.js app router
    src/components/                  # Page, layout, shared, shadcn UI
    src/hooks/use-event-stream.ts    # SSE hook
    src/lib/api.ts                   # API client
    src/lib/constants.ts             # Static UI/architecture content
```

## Runtime Architecture

### Backend

Each service is a separate Node.js package under `backend/`.

Shared package:

- `backend/shared/src/types/*.ts`: domain DTOs, statuses, event interfaces.
- `backend/shared/src/types/events.ts`: all domain events and Redis channel names.
- `backend/shared/src/events/event-bus.ts`: `RedisEventBus`, `createEvent`.
- `backend/shared/src/events/event-store.ts`: in-memory event store, mostly dev/reference.
- `backend/shared/src/utils/index.ts`: IDs, sleep, retry, in-memory idempotency store, circuit breaker.

Infrastructure:

- Redis Pub/Sub routes events by channel.
- PostgreSQL has separate DBs: `order_db`, `payment_db`, `inventory_db`, `shipping_db`, `notification_db`.
- Each service has its own Prisma schema and local `PrismaEventStore` storing received and emitted events in that service's `events` table.

API Gateway:

- File: `backend/api-gateway/src/index.ts`
- Proxies:
  - `/api/orders` -> Order Service
  - `/api/payments` -> Payment Service
  - `/api/inventory` -> Inventory Service
  - `/api/shipments` -> Shipping Service
  - `/api/notifications` -> Notification Service
- Health aggregation: `GET /api/health`
- SSE stream: `GET /api/events/stream`
- SSE subscribes to every channel in `EVENT_CHANNELS` and broadcasts events to connected frontend clients.

### Frontend

Next.js app router:

- `frontend/src/app/(main)/layout.tsx`: main shell with navbar/footer.
- `frontend/src/app/(main)/page.tsx`: home overview.
- `frontend/src/app/(main)/dashboard/page.tsx`: live SSE events, order stats, service health.
- `frontend/src/app/(main)/orders/page.tsx`: product catalog, cart, create order, order list.
- Architecture/static pages use components under `frontend/src/components/pages/`.

API client:

- `frontend/src/lib/api.ts`
- Default API base: `NEXT_PUBLIC_API_URL || "http://localhost:4000"`.

SSE:

- `frontend/src/hooks/use-event-stream.ts`
- Keeps the last 100 events in memory.

UI:

- Shadcn-style components under `frontend/src/components/ui/`.
- Icons are from `lucide-react`.
- Animations use `motion/react`.

## Event Channels And Saga Flow

Channel constants live in `backend/shared/src/types/events.ts`.

Key channels:

- `order.placed`
- `order.confirmed`
- `order.cancelled`
- `order.completed`
- `inventory.stock_reserved`
- `inventory.stock_reservation_failed`
- `inventory.stock_released`
- `inventory.low_stock_alert`
- `payment.processed`
- `payment.failed`
- `payment.refunded`
- `shipping.scheduled`
- `shipping.shipped`
- `shipping.delivered`
- `shipping.delivery_failed`
- `notification.sent`
- `notification.failed`

Happy path:

1. Frontend creates order via `POST /api/orders`.
2. Order Service stores order as `PENDING`, emits `ORDER_PLACED` on `order.placed`.
3. Inventory Service receives `ORDER_PLACED`, reserves stock, emits `STOCK_RESERVED`.
4. Payment Service receives `ORDER_PLACED`, simulates payment gateway through circuit breaker, emits `PAYMENT_PROCESSED`.
5. Notification Service receives `ORDER_PLACED`, stores/sends notification, emits `NOTIFICATION_SENT`.
6. Order Service listens for `STOCK_RESERVED` and `PAYMENT_PROCESSED`. It tracks both in an in-memory `sagaState` map. When both are true, it updates order to `CONFIRMED` and emits `ORDER_CONFIRMED`.
7. Shipping Service receives `ORDER_CONFIRMED`, creates shipment, emits `SHIPPING_SCHEDULED`, then after 5 seconds emits `ORDER_SHIPPED`.
8. Order Service updates status to `SHIPPING_SCHEDULED` and then `SHIPPED`.
9. Notification Service sends follow-up notifications for confirmed/shipped/cancelled/payment failed events.

Failure path:

- Inventory failure emits `STOCK_RESERVATION_FAILED`; Order Service cancels order and emits `ORDER_CANCELLED`.
- Payment failure emits `PAYMENT_FAILED`; Order Service cancels order and emits `ORDER_CANCELLED`.
- Inventory Service listens to `ORDER_CANCELLED` and releases reserved stock if a reservation exists.
- Payment Service listens to `ORDER_CANCELLED` and refunds if payment was already completed.

Important implementation detail:

- `OrderService` saga state is in memory. If the service restarts mid-saga, it can lose whether stock/payment already completed.
- Each service appends events to its own DB, so there is no single global event store query across all services.

## Data Model

### Order Service

Files:

- `backend/order-service/prisma/schema.prisma`
- `backend/order-service/src/models/order.repository.ts`

Tables:

- `orders`: `id`, `customerId`, `items`, `totalAmount`, `shippingAddress`, `status`, timestamps.
- `events`: local event store.

Statuses from shared enum include:

- `PENDING`, `INVENTORY_RESERVED`, `PAYMENT_PROCESSING`, `PAYMENT_COMPLETED`, `CONFIRMED`, `SHIPPING_SCHEDULED`, `SHIPPED`, `DELIVERED`, `CANCELLED`, `REFUNDED`.

### Inventory Service

Files:

- `backend/inventory-service/prisma/schema.prisma`
- `backend/inventory-service/src/models/inventory.repository.ts`

Tables:

- `inventory_items`: seeded on startup if empty.
- `stock_reservations`: per-order reservation.
- `events`: local event store.

Seed products:

- `PROD-001` iPhone 15 Pro Max
- `PROD-002` Samsung Galaxy S24 Ultra
- `PROD-003` MacBook Pro M3
- `PROD-004` AirPods Pro 2
- `PROD-005` iPad Air M2

### Payment Service

Files:

- `backend/payment-service/prisma/schema.prisma`
- `backend/payment-service/src/models/payment.repository.ts`
- `backend/payment-service/src/handlers/payment.handler.ts`

Tables:

- `payments`: has unique `idempotencyKey`.
- `events`: local event store.

Simulation:

- Delay: 2000ms.
- Failure rate: 10%.
- In-memory idempotency store keyed as `payment-${orderId}`.

### Shipping Service

Files:

- `backend/shipping-service/prisma/schema.prisma`
- `backend/shipping-service/src/models/shipment.repository.ts`
- `backend/shipping-service/src/handlers/shipping.handler.ts`

Tables:

- `shipments`
- `events`

Current limitation:

- `ORDER_CONFIRMED` event only carries `orderId` and `customerId`, so Shipping Service uses a placeholder shipping address instead of the actual order shipping address.

### Notification Service

Files:

- `backend/notification-service/prisma/schema.prisma`
- `backend/notification-service/src/models/notification.repository.ts`
- `backend/notification-service/src/handlers/notification.handler.ts`

Tables:

- `notifications`
- `events`

It simulates sending by immediately updating notification status to `SENT`.

## API Surface

Gateway base: `http://localhost:4000`

- `GET /api/health`
- `GET /api/events/stream`
- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/stats`
- `GET /api/orders/:id`
- `GET /api/orders/:id/events`
- `GET /api/inventory`
- `GET /api/inventory/alerts/low-stock`
- `GET /api/inventory/:productId`
- `GET /api/payments`
- `GET /api/payments/:id`
- `GET /api/payments/order/:orderId`
- `GET /api/shipments`
- `GET /api/shipments/:id`
- `GET /api/shipments/order/:orderId`
- `GET /api/notifications`
- `GET /api/notifications/order/:orderId`

Route-order caution:

- In `payment.routes.ts`, `/api/payments/:id` is declared before `/api/payments/order/:orderId`, so `/api/payments/order/:orderId` may be swallowed by the `/:id` route. Put specific routes before generic `/:id` if fixing.
- In `shipping.routes.ts`, `/api/shipments/:id` is declared before `/api/shipments/order/:orderId`, same issue.
- Inventory already handles `/alerts/low-stock` before `/:productId`.

## Run Commands

Backend local development:

```bash
cd backend/shared && npm install && npm run build
cd ../api-gateway && npm install && npm run dev
cd ../order-service && npm install && npm run dev
cd ../payment-service && npm install && npm run dev
cd ../inventory-service && npm install && npm run dev
cd ../shipping-service && npm install && npm run dev
cd ../notification-service && npm install && npm run dev
```

Redis only:

```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Docker Compose:

```bash
cd backend
docker-compose up --build
```

Potential Docker Compose issue:

- In the current `backend/docker-compose.yml`, the `frontend` service appears indented under the top-level `volumes:` block rather than top-level `services:`. If Docker Compose fails with a volume/service schema error, fix indentation by moving `frontend:` back under `services:`.

## Verification Commands

Use these after relevant edits:

```bash
cd backend/shared && npm run build
cd backend/api-gateway && npm run build
cd backend/order-service && npm run build
cd backend/payment-service && npm run build
cd backend/inventory-service && npm run build
cd backend/shipping-service && npm run build
cd backend/notification-service && npm run build
cd frontend && npm run lint && npm run build
```

Notes:

- Service build scripts run `npx prisma generate` before `tsc`.
- Builds require dependencies already installed in each package.
- Network is needed if dependencies are missing.

## Known Issues And Mismatches

These are not fixed unless a task asks for them.

- `Context.md` was previously mojibake/corrupted Vietnamese; this version rewrites it as the canonical context.
- Many source strings and docs display mojibake Vietnamese text. Fixing text requires updating UI/constants/docs carefully.
- Static docs and `ecommerce-order-processing.dsl` describe Java Spring Boot/Kafka/RabbitMQ/React-Angular, while code implements Node.js/Express/Redis/Next.js.
- `frontend/src/app/page.tsx` redirects to `/`, which can create a self-redirect/infinite redirect for the root route. The actual home route exists in route group `frontend/src/app/(main)/page.tsx`.
- `payment.routes.ts` and `shipping.routes.ts` declare generic `/:id` before `/order/:orderId`.
- `ShippingService` uses a placeholder address because `ORDER_CONFIRMED` lacks `shippingAddress`.
- `InventoryService` config includes `stockFailureRate`, but reservation logic currently only fails from actual insufficient stock.
- Dead Letter Queue is a TODO in `RedisEventBus.handleMessage`, not implemented.
- Retry utility exists but is not wired into event handling.
- Circuit breaker is only used in Payment Service simulation.
- Idempotency is in-memory plus DB unique key, but duplicate handling in `paymentRepository.create` can still throw if the service restarts after a prior payment row exists.
- No automated tests are present.
- Root `README.md` is deleted in the current Git worktree according to `git status`; do not restore or revert unless requested.
- `backend/docker-compose.yml` and `backend/frontend.Dockerfile` have existing uncommitted changes; preserve user changes unless the task explicitly targets them.

## Git/Workspace Notes

The repository may trigger Git safe-directory protection because the sandbox user differs from the repository owner.

Use:

```bash
git -c safe.directory='D:/lotrinhoc/IUH/hk8/KTTKPM/Project' -C 'D:\lotrinhoc\IUH\hk8\KTTKPM\Project' status --short
```

Current observed status before this context rewrite:

```text
 D README.md
 M backend/docker-compose.yml
?? Context.md
?? backend/frontend.Dockerfile
```

Do not revert user changes without explicit request.

## Documentation Assets

Architecture/design docs:

- `ecommerce-order-processing.dsl`: C4/Structurizr model for system context, containers, and service components.
- Mermaid diagrams in `Diagram/`:
  - `Design Patterns Applied.mmd`
  - `Error Handling & Compensating Transactions.mmd`
  - `Event Flow - Order Processing Sequence.mmd`
  - `Event Types & Data Flow.mmd`
  - `Event-Driven Order Processing System - Architecture.mmd`
  - `Microservices Architecture with Event Bus.mmd`
  - `Saga Pattern - Choreography-based Flow.mmd`
  - `Scalability & Load Distribution.mmd`
- Rendered PNGs are in `Images/` with matching names.

## Update Log

- 2026-05-01: Read the project source and rewrote `Context.md` as the canonical working context. Captured runtime architecture, event flow, service responsibilities, route surface, commands, known issues, and the rule that future updates must read and update this file.
