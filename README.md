# Hệ Thống Xử Lý Đơn Hàng Real-Time (E-Commerce Order Processing System)

## Mục Lục

- [1. Bối Cảnh](#1-bối-cảnh)
- [2. Kiến Trúc Hệ Thống](#2-kiến-trúc-hệ-thống)
  - [2.1. Event-Driven Architecture (EDA)](#21-event-driven-architecture-eda)
  - [2.2. Microservices Architecture](#22-microservices-architecture)
  - [2.3. CQRS (Command Query Responsibility Segregation)](#23-cqrs-command-query-responsibility-segregation)
- [3. Design Patterns](#3-design-patterns)
  - [3.1. Saga Pattern (Choreography-based)](#31-saga-pattern-choreography-based)
  - [3.2. Event Sourcing Pattern](#32-event-sourcing-pattern)
  - [3.3. Publish-Subscribe Pattern](#33-publish-subscribe-pattern)
  - [3.4. Idempotency Pattern](#34-idempotency-pattern)
  - [3.5. Dead Letter Queue Pattern](#35-dead-letter-queue-pattern)
  - [3.6. Circuit Breaker Pattern](#36-circuit-breaker-pattern)
- [4. Luồng Xử Lý Đơn Hàng](#4-luồng-xử-lý-đơn-hàng)
- [5. Event Types & Data Flow](#5-event-types--data-flow)
- [6. Xử Lý Lỗi & Compensating Transactions](#6-xử-lý-lỗi--compensating-transactions)
- [7. Scalability & Load Distribution](#7-scalability--load-distribution)
- [8. Architecture Characteristics](#8-architecture-characteristics)
- [9. Trade-offs](#9-trade-offs)
- [10. Công Nghệ Sử Dụng](#10-công-nghệ-sử-dụng)
- [11. Cấu Trúc Dự Án](#11-cấu-trúc-dự-án)

---

## 1. Bối Cảnh

Hệ thống xử lý đơn hàng cho **nền tảng thương mại điện tử**, khi khách hàng đặt hàng cần thực hiện **đồng thời** các tác vụ:

| Tác vụ                 | Service phụ trách    |
| ---------------------- | -------------------- |
| Cập nhật kho hàng      | Inventory Service    |
| Xử lý thanh toán       | Payment Service      |
| Gửi xác nhận cho khách | Notification Service |
| Sắp xếp vận chuyển     | Shipping Service     |

Yêu cầu hệ thống:

- **Real-time processing** — phản hồi ngay lập tức khi đặt hàng
- **High scalability** — xử lý tải cao trong mùa sale/khuyến mãi
- **Fault tolerance** — một service lỗi không ảnh hưởng toàn hệ thống
- **Event-driven** — các tác vụ độc lập chạy song song

---

## 2. Kiến Trúc Hệ Thống

### 2.1. Event-Driven Architecture (EDA) — Kiến trúc chính

![Event-Driven Architecture](Images/Event-Driven%20Order%20Processing%20System%20-%20Architecture.png)

**Lý do phù hợp:**

- Các tác vụ **độc lập** và có thể **chạy song song**
- Cần xử lý **real-time** và phản hồi ngay lập tức
- Yêu cầu **khả năng mở rộng cao** (horizontal scaling)
- **Loose coupling** giữa các service

**Cách hoạt động:**

1. **Order Service** nhận yêu cầu đặt hàng từ khách hàng
2. Publish event `Order Placed` lên **Event Bus** (Kafka/RabbitMQ)
3. Các service **subscribe** và xử lý độc lập, song song
4. Kết quả được publish lại lên Event Bus dưới dạng event mới
5. **Event Store** lưu trữ tất cả events để audit và replay

### 2.2. Microservices Architecture

![Microservices Architecture](Images/Microservices%20Architecture%20with%20Event%20Bus.png)

Kết hợp với EDA, hệ thống bao gồm **5 microservices độc lập**:

| Service                  | Công nghệ        | Chức năng                  | Database   |
| ------------------------ | ---------------- | -------------------------- | ---------- |
| **Order Service**        | Java Spring Boot | Quản lý vòng đời đơn hàng  | PostgreSQL |
| **Inventory Service**    | Java Spring Boot | Quản lý kho hàng & tồn kho | PostgreSQL |
| **Payment Service**      | Java Spring Boot | Xử lý thanh toán           | PostgreSQL |
| **Shipping Service**     | Java Spring Boot | Sắp xếp vận chuyển         | PostgreSQL |
| **Notification Service** | Node.js          | Gửi thông báo cho khách    | —          |

**Đặc điểm:**

- Mỗi service có **database riêng** (Database per Service pattern)
- Giao tiếp qua **Event Bus** (không gọi API trực tiếp)
- **Scale từng service** riêng biệt theo nhu cầu
- Mỗi service có thể **deploy, update, scale** độc lập

### 2.3. CQRS (Command Query Responsibility Segregation)

**Tách biệt** việc ghi và đọc:

| Loại                | Mô tả                        | Ví dụ                                     |
| ------------------- | ---------------------------- | ----------------------------------------- |
| **Command** (Write) | Thay đổi trạng thái hệ thống | Đặt hàng, cập nhật kho, xử lý thanh toán  |
| **Query** (Read)    | Truy vấn dữ liệu             | Xem trạng thái đơn hàng, kiểm tra tồn kho |

- **Event Store** lưu trữ tất cả events → hỗ trợ audit trail và replay
- Write DB và Read DB có thể **scale riêng biệt**
- Read model được cập nhật qua events (eventual consistency)

---

## 3. Design Patterns

![Design Patterns Applied](Images/Design%20Patterns%20Applied.png)

### 3.1. Saga Pattern (Choreography-based)

![Saga Pattern](Images/Saga%20Pattern%20-%20Choreography-based%20Flow.png)

**Choreography-based Saga** — phù hợp nhất với mô hình event-driven:

```
Customer → Order Service → [Order Placed Event]
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
            Inventory Service  Payment Service  Notification Service
                    ↓               ↓               ↓
            [Inventory Updated] [Payment Processed] [Notification Sent]
                    ↓               ↓
                    └───────┬───────┘
                            ↓
                    Order Service (Wait for both)
                            ↓
                    [Order Confirmed]
                            ↓
                    Shipping Service → [Shipping Scheduled]
```

**Đặc điểm:**

- Các service **tự phối hợp** thông qua events
- **Không có điểm trung tâm** điều phối (no orchestrator)
- Payment Service và Inventory Service lắng nghe `Order Placed` **độc lập**
- Order Service đợi **cả hai events** hoàn thành mới confirm

**Xử lý lỗi (Compensating Transactions):**

- Nếu `Payment Failed` → **hoàn lại inventory** (release stock)
- Nếu `Inventory Failed` → **hủy thanh toán** (refund)
- **Retry mechanisms** cho các service tạm thời không khả dụng

### 3.2. Event Sourcing Pattern

- Lưu trữ **tất cả events** trong Event Store (không chỉ trạng thái cuối)
- Có thể **tái tạo trạng thái** hệ thống bất kỳ lúc nào bằng cách replay events
- Hỗ trợ **audit trail** đầy đủ
- Cho phép **debugging** bằng cách replay lại chuỗi events

```
[Order Placed] → [Inventory Updated] → [Payment Processed] → [Order Confirmed] → [Shipping Scheduled]
       ↓                ↓                     ↓                      ↓                     ↓
   Event Store      Event Store           Event Store            Event Store           Event Store
```

### 3.3. Publish-Subscribe Pattern

- **Event Bus** (Kafka/RabbitMQ) làm message broker trung tâm
- Một event có **nhiều consumers** (fan-out)
- Ví dụ: `Order Placed` được lắng nghe bởi **cả 3 services**: Inventory, Payment, Notification

```
Order Service ──publish──→ [order.placed] topic
                                │
                    ┌───────────┼───────────┐
                    ↓           ↓           ↓
                Inventory   Payment   Notification
                Service     Service     Service
```

### 3.4. Idempotency Pattern

- Đảm bảo xử lý event **nhiều lần không gây side effects**
- **Đặc biệt quan trọng** với Payment Service để tránh charge nhiều lần
- Sử dụng `eventId` + **Idempotency Cache** để kiểm tra duplicate

```
Request (eventId: ABC123) → Idempotency Check
    ├── First time → Process → Store in Cache
    └── Duplicate  → Return cached result (skip processing)
```

### 3.5. Dead Letter Queue Pattern

- Xử lý các events **thất bại sau nhiều lần retry** (mặc định 3 lần)
- Message thất bại được chuyển vào **Dead Letter Queue (DLQ)**
- Cho phép **debug và xử lý thủ công**
- Tích hợp **alerting/monitoring** khi có message vào DLQ

```
Message → Retry Logic (max 3) ──success──→ Process
                                ──fail────→ Dead Letter Queue → Alert/Monitor
```

### 3.6. Circuit Breaker Pattern

Bảo vệ hệ thống khỏi **cascade failures** khi gọi external dependencies:

| State         | Mô tả                                                      |
| ------------- | ---------------------------------------------------------- |
| **Closed**    | Hoạt động bình thường, cho phép request                    |
| **Open**      | Khi failures vượt threshold → fail fast, không gọi service |
| **Half-Open** | Sau timeout → thử một vài request để test recovery         |

---

## 4. Luồng Xử Lý Đơn Hàng

![Event Flow - Order Processing Sequence](Images/Event%20Flow%20-%20Order%20Processing%20Sequence.png)

### Happy Path (Luồng thành công):

| Bước | Event                   | Mô tả                                                                                                                |
| ---- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 1    | **Order Placed**        | Customer đặt hàng → Order Service publish event `{orderId, userId, items}`                                           |
| 2    | **Parallel Processing** | 3 services xử lý đồng thời: Inventory (check & update stock), Payment (process payment), Notification (gửi xác nhận) |
| 3    | **Order Confirmed**     | Order Service nhận được cả `Inventory Updated` + `Payment Processed` → publish `Order Confirmed`                     |
| 4    | **Shipping Scheduled**  | Shipping Service nhận `Order Confirmed` → sắp xếp vận chuyển → gửi thông tin cho customer                            |
| 5    | **Process Complete**    | Customer nhận thông báo hoàn tất                                                                                     |

### Chi tiết xử lý song song (Bước 2):

```
                    ┌──→ Inventory Service: Check Stock → Update → [Inventory Updated]
                    │
[Order Placed] ─────┼──→ Payment Service: Validate → Charge → [Payment Processed]
                    │
                    └──→ Notification Service: Send "Order Placed" notification
```

---

## 5. Event Types & Data Flow

![Event Types & Data Flow](Images/Event%20Types%20%26%20Data%20Flow.png)

### Event Categories:

| Category                | Events                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| **Order Events**        | `Order Placed`, `Order Confirmed`, `Order Cancelled`, `Order Completed`         |
| **Inventory Events**    | `Inventory Updated`, `Stock Reserved`, `Stock Released`, `Low Stock Alert`      |
| **Payment Events**      | `Payment Processed`, `Payment Failed`, `Payment Refunded`, `Payment Authorized` |
| **Shipping Events**     | `Shipping Scheduled`, `Order Shipped`, `Order Delivered`, `Delivery Failed`     |
| **Notification Events** | `Notification Sent`, `Email Delivered`, `SMS Delivered`, `Notification Failed`  |

### Event Schema Structure:

```json
{
  "metadata": {
    "eventId": "uuid-v4",
    "timestamp": "2026-03-02T10:30:00Z",
    "version": "1.0",
    "correlationId": "order-12345"
  },
  "payload": {
    "orderId": "ORD-001",
    "userId": "USR-001",
    "items": [...],
    "amount": 599000,
    "status": "PLACED"
  },
  "context": {
    "source": "order-service",
    "traceId": "trace-uuid",
    "spanId": "span-uuid"
  }
}
```

### Event Flow Chain:

```
Order Placed ──→ Inventory Updated ──┐
       │                              ├──→ Order Confirmed ──→ Shipping Scheduled ──→ Order Shipped ──→ Order Delivered ──→ Order Completed
       └──→ Payment Processed ───────┘

(Failure Path)
Payment Failed ──→ Stock Released ──→ Order Cancelled ──→ Payment Refunded
```

---

## 6. Xử Lý Lỗi & Compensating Transactions

![Error Handling](Images/Error%20Handling%20%26%20Compensating%20Transactions.png)

### Các Kịch Bản Lỗi & Xử Lý:

| Kịch bản                  | Compensating Action                                               | Thông báo         |
| ------------------------- | ----------------------------------------------------------------- | ----------------- |
| **Inventory không đủ**    | Release reservations → Cancel Order                               | "Out of Stock"    |
| **Payment thất bại**      | Release inventory → Cancel Order                                  | "Payment Failed"  |
| **Timeout** (chờ quá lâu) | Refund payment + Release inventory → Cancel Order                 | "Order Timeout"   |
| **Shipping thất bại**     | Refund payment + Return inventory → Cancel Order                  | "Shipping Failed" |
| **Delivery thất bại**     | Retry tối đa 3 lần → nếu vẫn fail: Full refund + Return inventory | "Delivery Failed" |

### Retry Strategy:

```
Attempt 1 → Fail → Wait 1s →
Attempt 2 → Fail → Wait 2s →
Attempt 3 → Fail → Move to Dead Letter Queue → Alert Admin
```

---

## 7. Scalability & Load Distribution

![Scalability](Images/Scalability%20%26%20Load%20Distribution.png)

### Chiến lược Scale:

| Thành phần               | Chiến lược                  | Auto-scale trigger |
| ------------------------ | --------------------------- | ------------------ |
| **Order Service**        | 3 instances                 | CPU > 70%          |
| **Inventory Service**    | 2 instances                 | Queue Depth > 100  |
| **Payment Service**      | 4 instances (High Priority) | Response Time > 2s |
| **Shipping Service**     | 2 instances                 | Standard           |
| **Notification Service** | 3 instances                 | Queue Depth > 200  |

### Kafka Partitioning:

| Partition   | Range            | Mục đích     |
| ----------- | ---------------- | ------------ |
| Partition 1 | Orders 0-999     | Phân tải đều |
| Partition 2 | Orders 1000-1999 | Phân tải đều |
| Partition 3 | Orders 2000-2999 | Phân tải đều |
| Partition 4 | Orders 3000+     | Overflow     |

### Database Scaling:

- **Master DB** (Write) — tất cả write operations
- **Replica 1 & 2** (Read) — read operations được phân tải
- **Redis Cache** — hot data caching cho truy vấn nhanh

### Consumer Groups:

Mỗi service có **Consumer Group riêng**, đảm bảo:

- Mỗi event chỉ được xử lý **1 lần** bởi mỗi service
- Nhiều instance trong group **chia sẻ tải** xử lý
- **Fault tolerance** — nếu 1 instance fail, instance khác tiếp quản

---

## 8. Architecture Characteristics

| Characteristic                         | Rating     | Chi tiết                                                                       |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------ |
| **Scalability** (Khả năng mở rộng)     | ⭐⭐⭐⭐⭐ | Scale từng service độc lập, horizontal scaling dễ dàng, xử lý tải cao mùa sale |
| **Performance** (Hiệu năng)            | ⭐⭐⭐⭐⭐ | Xử lý bất đồng bộ, real-time response, các tác vụ chạy song song               |
| **Elasticity** (Đàn hồi)               | ⭐⭐⭐⭐⭐ | Auto-scaling dựa trên event queue depth, tự động scale up/down                 |
| **Evolvability** (Khả năng phát triển) | ⭐⭐⭐⭐⭐ | Thêm service mới không ảnh hưởng hệ thống, chỉ cần subscribe events            |
| **Availability** (Độ khả dụng)         | ⭐⭐⭐⭐   | Service failure không ảnh hưởng toàn hệ thống, eventual delivery               |
| **Fault Tolerance** (Chịu lỗi)         | ⭐⭐⭐⭐   | Loose coupling, circuit breaker, compensating transactions                     |
| **Testability** (Khả năng test)        | ⭐⭐⭐⭐   | Test từng service độc lập, mock events, replay từ Event Store                  |
| **Observability** (Khả năng quan sát)  | ⭐⭐⭐     | Cần monitoring tốt, distributed tracing phức tạp hơn monolith                  |

---

## 9. Trade-offs

### Ưu điểm:

| Aspect          | Benefit                                                                     |
| --------------- | --------------------------------------------------------------------------- |
| **Decoupling**  | Services hoàn toàn độc lập, thay đổi 1 service không ảnh hưởng service khác |
| **Scalability** | Scale từng service theo nhu cầu thực tế                                     |
| **Resilience**  | Một service down không ảnh hưởng toàn hệ thống                              |
| **Flexibility** | Dễ dàng thêm service mới (ví dụ: Discount Service)                          |
| **Audit Trail** | Event Store lưu trữ toàn bộ lịch sử thay đổi                                |

### Nhược điểm:

| Aspect                   | Challenge                        | Giải pháp                           |
| ------------------------ | -------------------------------- | ----------------------------------- |
| **Eventual Consistency** | Không đảm bảo strong consistency | Saga pattern + Idempotency          |
| **Debugging phân tán**   | Khó trace lỗi across services    | Distributed tracing (Jaeger/Zipkin) |
| **Complexity**           | Hệ thống phức tạp hơn monolith   | Documentation + Monitoring mạnh     |
| **Duplicate Events**     | Event có thể nhận nhiều lần      | Idempotency pattern                 |
| **Out-of-order Events**  | Events không đúng thứ tự         | Correlation ID + event ordering     |
| **Latency**              | Độ trễ nhỏ do message broker     | Timeout + retry hợp lý              |

---

## 10. Công Nghệ Sử Dụng

| Layer                    | Công nghệ                                     | Vai trò                             |
| ------------------------ | --------------------------------------------- | ----------------------------------- |
| **Frontend**             | React / Angular                               | Web Application                     |
| **API Gateway**          | Kong / AWS API Gateway                        | Entry point, routing, rate limiting |
| **Backend Services**     | Java Spring Boot                              | Order, Inventory, Payment, Shipping |
| **Notification Service** | Node.js                                       | Xử lý notifications                 |
| **Message Broker**       | Apache Kafka / RabbitMQ                       | Event Bus                           |
| **Event Store**          | EventStoreDB / Kafka                          | Lưu trữ events                      |
| **Database**             | PostgreSQL                                    | Data persistence                    |
| **Cache**                | Redis                                         | Hot data caching                    |
| **Load Balancer**        | NGINX / HAProxy                               | Phân tải request                    |
| **Monitoring**           | Prometheus + Grafana                          | Metrics & dashboards                |
| **Logging**              | ELK Stack                                     | Centralized logging                 |
| **Tracing**              | Jaeger / Zipkin                               | Distributed tracing                 |
| **External**             | Payment Gateway, Shipping Provider, Email/SMS | Third-party integrations            |

---

## 11. Cấu Trúc Dự Án

```
Project/
├── README.md                                          # Tài liệu tổng quan (file này)
├── ecommerce-order-processing.dsl                     # Structurizr DSL - C4 Model
├── Diagram/                                           # Mermaid diagram files (.mmd)
│   ├── Event-Driven Order Processing System - Architecture.mmd
│   ├── Microservices Architecture with Event Bus.mmd
│   ├── Event Flow - Order Processing Sequence.mmd
│   ├── Saga Pattern - Choreography-based Flow.mmd
│   ├── Design Patterns Applied.mmd
│   ├── Event Types & Data Flow.mmd
│   ├── Error Handling & Compensating Transactions.mmd
│   └── Scalability & Load Distribution.mmd
└── Images/                                            # Rendered diagram images (.png)
    ├── Event-Driven Order Processing System - Architecture.png
    ├── Microservices Architecture with Event Bus.png
    ├── Event Flow - Order Processing Sequence.png
    ├── Saga Pattern - Choreography-based Flow.png
    ├── Design Patterns Applied.png
    ├── Event Types & Data Flow.png
    ├── Error Handling & Compensating Transactions.png
    └── Scalability & Load Distribution.png
```

### Mô tả các Diagram:

| #   | Diagram             | Nội dung                                                                             |
| --- | ------------------- | ------------------------------------------------------------------------------------ |
| 1   | **Architecture**    | Tổng quan kiến trúc EDA: producers, consumers, event bus, storage, external systems  |
| 2   | **Microservices**   | Chi tiết từng microservice, database riêng, monitoring & observability stack         |
| 3   | **Event Flow**      | Sequence diagram: luồng xử lý đơn hàng từ đặt hàng → hoàn tất                        |
| 4   | **Saga Pattern**    | State diagram: choreography flow với parallel processing & compensating transactions |
| 5   | **Design Patterns** | 6 patterns: Pub-Sub, Event Sourcing, Idempotency, DLQ, Circuit Breaker, CQRS         |
| 6   | **Event Types**     | Phân loại events (Order, Inventory, Payment, Shipping, Notification) + schema        |
| 7   | **Error Handling**  | Flowchart chi tiết xử lý lỗi & compensating transactions ở từng bước                 |
| 8   | **Scalability**     | Auto-scaling, Kafka partitioning, consumer groups, DB replication, caching           |

### Structurizr DSL (C4 Model):

File `ecommerce-order-processing.dsl` mô tả kiến trúc theo **C4 Model**:

- **Level 1 — System Context**: Tổng quan hệ thống với actors và external systems
- **Level 2 — Container**: Chi tiết các containers (services, databases, event bus)
- **Level 3 — Component**: Chi tiết components bên trong từng service

---

> **Ghi chú:** Dự án này là phần thiết kế kiến trúc phần mềm cho môn Kiến Trúc & Thiết Kế Phần Mềm (KTTKPM) — HK8, Đại học Công nghiệp TP.HCM (IUH).
