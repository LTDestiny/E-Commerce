// Navigation items
export const NAV_ITEMS = [
  { label: "Tổng Quan", href: "/", icon: "LayoutDashboard" },
  { label: "Dashboard", href: "/dashboard", icon: "Activity" },
  { label: "Đặt Hàng", href: "/orders", icon: "ShoppingCart" },
  { label: "Kiến Trúc", href: "/architecture", icon: "Network" },
  { label: "Design Patterns", href: "/patterns", icon: "Blocks" },
  { label: "Event Flow", href: "/event-flow", icon: "Workflow" },
  { label: "Xử Lý Lỗi", href: "/error-handling", icon: "ShieldAlert" },
  { label: "Scalability", href: "/scalability", icon: "TrendingUp" },
] as const;

// Services info
export const SERVICES = [
  {
    name: "Order Service",
    tech: "Java Spring Boot",
    description: "Quản lý vòng đời đơn hàng, điều phối xử lý",
    color: "bg-blue-500",
    textColor: "text-blue-500",
    borderColor: "border-blue-500",
  },
  {
    name: "Payment Service",
    tech: "Java Spring Boot",
    description: "Xử lý thanh toán qua third-party gateway",
    color: "bg-orange-500",
    textColor: "text-orange-500",
    borderColor: "border-orange-500",
  },
  {
    name: "Inventory Service",
    tech: "Java Spring Boot",
    description: "Quản lý kho hàng & tồn kho",
    color: "bg-green-500",
    textColor: "text-green-500",
    borderColor: "border-green-500",
  },
  {
    name: "Shipping Service",
    tech: "Java Spring Boot",
    description: "Sắp xếp vận chuyển & tracking",
    color: "bg-purple-500",
    textColor: "text-purple-500",
    borderColor: "border-purple-500",
  },
  {
    name: "Notification Service",
    tech: "Node.js",
    description: "Gửi thông báo cho khách hàng",
    color: "bg-red-500",
    textColor: "text-red-500",
    borderColor: "border-red-500",
  },
] as const;

// Architecture characteristics
export const CHARACTERISTICS = [
  {
    name: "Scalability",
    rating: 5,
    description: "Scale từng service độc lập, horizontal scaling",
  },
  {
    name: "Performance",
    rating: 5,
    description: "Bất đồng bộ, real-time, song song",
  },
  {
    name: "Elasticity",
    rating: 5,
    description: "Auto-scaling theo event queue depth",
  },
  { name: "Evolvability", rating: 5, description: "Thêm service mới dễ dàng" },
  {
    name: "Availability",
    rating: 4,
    description: "Service failure không ảnh hưởng toàn hệ thống",
  },
  {
    name: "Fault Tolerance",
    rating: 4,
    description: "Loose coupling, circuit breaker",
  },
  {
    name: "Testability",
    rating: 4,
    description: "Test từng service, mock events",
  },
  {
    name: "Observability",
    rating: 3,
    description: "Distributed tracing phức tạp",
  },
] as const;

// Event types
export const EVENT_CATEGORIES = [
  {
    category: "Order Events",
    color: "bg-green-500",
    events: [
      "Order Placed",
      "Order Confirmed",
      "Order Cancelled",
      "Order Completed",
    ],
  },
  {
    category: "Inventory Events",
    color: "bg-blue-500",
    events: [
      "Inventory Updated",
      "Stock Reserved",
      "Stock Released",
      "Low Stock Alert",
    ],
  },
  {
    category: "Payment Events",
    color: "bg-orange-500",
    events: [
      "Payment Processed",
      "Payment Failed",
      "Payment Refunded",
      "Payment Authorized",
    ],
  },
  {
    category: "Shipping Events",
    color: "bg-purple-500",
    events: [
      "Shipping Scheduled",
      "Order Shipped",
      "Order Delivered",
      "Delivery Failed",
    ],
  },
  {
    category: "Notification Events",
    color: "bg-red-500",
    events: [
      "Notification Sent",
      "Email Delivered",
      "SMS Delivered",
      "Notification Failed",
    ],
  },
] as const;

// Design patterns
export const PATTERNS = [
  {
    name: "Saga Pattern",
    subtitle: "Choreography-based",
    description:
      "Các service tự phối hợp thông qua events, không có điểm trung tâm điều phối",
    icon: "GitBranch",
  },
  {
    name: "Event Sourcing",
    subtitle: "Event Store",
    description:
      "Lưu trữ tất cả events, có thể tái tạo trạng thái bất kỳ lúc nào",
    icon: "Database",
  },
  {
    name: "Publish-Subscribe",
    subtitle: "Fan-out Pattern",
    description: "Event Bus làm message broker, một event có nhiều consumers",
    icon: "Radio",
  },
  {
    name: "Idempotency",
    subtitle: "Duplicate Prevention",
    description: "Xử lý event nhiều lần không gây side effects",
    icon: "Shield",
  },
  {
    name: "Dead Letter Queue",
    subtitle: "Failed Event Handling",
    description: "Xử lý events thất bại sau nhiều lần retry",
    icon: "MailX",
  },
  {
    name: "Circuit Breaker",
    subtitle: "Cascade Failure Prevention",
    description:
      "Bảo vệ hệ thống khỏi cascade failures khi gọi external dependencies",
    icon: "Zap",
  },
] as const;

// Tech stack
export const TECH_STACK = [
  { category: "Frontend", tech: "React / Angular", role: "Web Application" },
  {
    category: "API Gateway",
    tech: "Kong / AWS API Gateway",
    role: "Entry point, routing",
  },
  { category: "Backend", tech: "Java Spring Boot", role: "Microservices" },
  { category: "Notification", tech: "Node.js", role: "Notification service" },
  {
    category: "Message Broker",
    tech: "Apache Kafka / RabbitMQ",
    role: "Event Bus",
  },
  {
    category: "Event Store",
    tech: "EventStoreDB / Kafka",
    role: "Event persistence",
  },
  { category: "Database", tech: "PostgreSQL", role: "Data storage" },
  { category: "Cache", tech: "Redis", role: "Hot data caching" },
  {
    category: "Monitoring",
    tech: "Prometheus + Grafana",
    role: "Metrics & dashboards",
  },
  { category: "Tracing", tech: "Jaeger / Zipkin", role: "Distributed tracing" },
] as const;
