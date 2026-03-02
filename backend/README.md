# ==========================================

# E-Commerce Order Processing System - Backend

# ==========================================

# Hệ thống xử lý đơn hàng real-time

# Event-Driven Architecture + Microservices

# ==========================================

## Kiến trúc

```
┌─────────────┐     ┌──────────────────────────────────────────────┐
│   Frontend   │────▶│  API Gateway (:4000)                         │
│   Next.js    │◀────│  - Routing / Proxy                           │
│   (:3000)    │  SSE│  - SSE Event Stream                          │
└─────────────┘     └──────────┬───────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Redis Event Bus     │
                    │  Pub/Sub (:6379)     │
                    └──────────┬──────────┘
                               │
        ┌──────────┬───────────┼───────────┬──────────┐
        │          │           │           │          │
   ┌────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐ ┌──▼─────┐
   │ Order  │ │Payment │ │Inventory│ │Shipping│ │Notif.  │
   │ :4001  │ │ :4002  │ │ :4003  │ │ :4004  │ │ :4005  │
   └────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

## Quick Start

### Development (local)

```bash
# 1. Start Redis
docker run -d -p 6379:6379 --name redis redis:7-alpine

# 2. Install dependencies
cd shared && npm install && npm run build && cd ..
cd order-service && npm install && cd ..
cd payment-service && npm install && cd ..
cd inventory-service && npm install && cd ..
cd shipping-service && npm install && cd ..
cd notification-service && npm install && cd ..
cd api-gateway && npm install && cd ..

# 3. Start all services (in separate terminals)
cd api-gateway && npm run dev
cd order-service && npm run dev
cd payment-service && npm run dev
cd inventory-service && npm run dev
cd shipping-service && npm run dev
cd notification-service && npm run dev
```

### Docker Compose

```bash
docker-compose up --build
```

## Ports

| Service              | Port |
| -------------------- | ---- |
| API Gateway          | 4000 |
| Order Service        | 4001 |
| Payment Service      | 4002 |
| Inventory Service    | 4003 |
| Shipping Service     | 4004 |
| Notification Service | 4005 |
| Redis                | 6379 |

## API Endpoints

### API Gateway (http://localhost:4000)

| Method | Path                   | Description          |
| ------ | ---------------------- | -------------------- |
| GET    | /api/health            | All services health  |
| GET    | /api/events/stream     | SSE event stream     |
| POST   | /api/orders            | Create order         |
| GET    | /api/orders            | List orders          |
| GET    | /api/orders/:id        | Get order            |
| GET    | /api/orders/:id/events | Order event timeline |
| GET    | /api/inventory         | List products        |
| GET    | /api/payments          | List payments        |
| GET    | /api/shipments         | List shipments       |
| GET    | /api/notifications     | List notifications   |

## Design Patterns Implemented

1. **Saga Pattern (Choreography)** - Services coordinate via events
2. **Event Sourcing** - All events stored in Event Store
3. **Pub-Sub** - Redis as message broker
4. **Idempotency** - Prevent duplicate payment processing
5. **Circuit Breaker** - Protect from cascade failures
6. **Dead Letter Queue** - Handle failed events (structure ready)
7. **CQRS** - Separate read/write models (structure ready)
