export const NAV_ITEMS = [
  { label: "Cửa hàng", href: "/", icon: "LayoutDashboard" },
  { label: "Mua hàng", href: "/orders", icon: "ShoppingCart" },
  { label: "Dashboard", href: "/dashboard", icon: "Activity" },
  { label: "Kiến trúc", href: "/architecture", icon: "Network" },
  { label: "Patterns", href: "/patterns", icon: "Blocks" },
  { label: "Event Flow", href: "/event-flow", icon: "Workflow" },
  { label: "Xử lý lỗi", href: "/error-handling", icon: "ShieldAlert" },
  { label: "Scale", href: "/scalability", icon: "TrendingUp" },
] as const;

export const SERVICES = [
  {
    name: "Order Service",
    tech: "Node.js / Express",
    description: "Quản lý đơn hàng và phát ORDER_PLACED để bắt đầu Saga.",
    color: "bg-blue-500",
    textColor: "text-blue-500",
    borderColor: "border-blue-500",
  },
  {
    name: "Payment Service",
    tech: "Node.js / Express",
    description: "Xử lý thanh toán, idempotency và phát PAYMENT_PROCESSED.",
    color: "bg-orange-500",
    textColor: "text-orange-500",
    borderColor: "border-orange-500",
  },
  {
    name: "Inventory Service",
    tech: "Node.js / Express",
    description: "Reserve/release tồn kho bằng transaction.",
    color: "bg-green-500",
    textColor: "text-green-500",
    borderColor: "border-green-500",
  },
  {
    name: "Shipping Service",
    tech: "Node.js / Express",
    description: "Lập lịch giao hàng và tracking vận chuyển.",
    color: "bg-purple-500",
    textColor: "text-purple-500",
    borderColor: "border-purple-500",
  },
  {
    name: "Notification Service",
    tech: "Node.js / Express",
    description: "Gửi thông báo mô phỏng theo từng trạng thái đơn.",
    color: "bg-red-500",
    textColor: "text-red-500",
    borderColor: "border-red-500",
  },
] as const;

export const CHARACTERISTICS = [
  {
    name: "Scalability",
    rating: 5,
    description: "Scale từng service độc lập theo tải thực tế.",
  },
  {
    name: "Performance",
    rating: 5,
    description: "Xử lý bất đồng bộ, song song, cập nhật real-time.",
  },
  {
    name: "Elasticity",
    rating: 5,
    description: "Có thể mở rộng theo độ sâu queue/event stream.",
  },
  { name: "Evolvability", rating: 5, description: "Dễ thêm service mới." },
  {
    name: "Availability",
    rating: 4,
    description: "Một service lỗi không kéo sập toàn hệ thống.",
  },
  {
    name: "Fault Tolerance",
    rating: 4,
    description: "Loose coupling, retry và bù trừ giao dịch.",
  },
  {
    name: "Testability",
    rating: 4,
    description: "Test từng service qua API và mock events.",
  },
  {
    name: "Observability",
    rating: 3,
    description: "Theo dõi bằng health check, SSE và event timeline.",
  },
] as const;

export const EVENT_CATEGORIES = [
  {
    category: "Order Events",
    color: "bg-blue-500",
    events: [
      "Order Placed",
      "Order Confirmed",
      "Order Cancelled",
      "Order Completed",
    ],
  },
  {
    category: "Inventory Events",
    color: "bg-green-500",
    events: ["Stock Reserved", "Stock Released", "Low Stock Alert"],
  },
  {
    category: "Payment Events",
    color: "bg-orange-500",
    events: ["Payment Processed", "Payment Failed", "Payment Refunded"],
  },
  {
    category: "Shipping Events",
    color: "bg-purple-500",
    events: ["Shipping Scheduled", "Order Shipped", "Order Delivered"],
  },
  {
    category: "Notification Events",
    color: "bg-red-500",
    events: ["Notification Sent", "Notification Failed"],
  },
] as const;

export const PATTERNS = [
  {
    name: "Saga Pattern",
    subtitle: "Choreography-based",
    description:
      "Các service tự phối hợp qua event, không cần coordinator trung tâm.",
    icon: "GitBranch",
  },
  {
    name: "Event Sourcing",
    subtitle: "Event Store",
    description:
      "Lưu mọi event để audit, truy vết và dựng lại timeline đơn hàng.",
    icon: "Database",
  },
  {
    name: "Publish-Subscribe",
    subtitle: "Fan-out Pattern",
    description: "Redis Pub/Sub phát một event cho nhiều consumers độc lập.",
    icon: "Radio",
  },
  {
    name: "Idempotency",
    subtitle: "Duplicate Prevention",
    description: "Xử lý lại event không gây trừ tiền hoặc trừ kho lặp.",
    icon: "Shield",
  },
  {
    name: "Dead Letter Queue",
    subtitle: "Failed Event Handling",
    description: "Tách event lỗi để điều tra sau nhiều lần retry.",
    icon: "MailX",
  },
  {
    name: "Circuit Breaker",
    subtitle: "Cascade Failure Prevention",
    description: "Giới hạn lỗi dây chuyền khi gọi external dependencies.",
    icon: "Zap",
  },
] as const;

export const TECH_STACK = [
  { category: "Frontend", tech: "Next.js 16", role: "Storefront + dashboard" },
  {
    category: "API Gateway",
    tech: "Express Gateway",
    role: "Routing, proxy, SSE",
  },
  { category: "Backend", tech: "Node.js / Prisma", role: "Microservices" },
  { category: "Event Bus", tech: "Redis Pub/Sub", role: "Fan-out events" },
  { category: "Database", tech: "PostgreSQL", role: "Service storage" },
  { category: "Container", tech: "Docker Compose", role: "Local workflow" },
  { category: "UI", tech: "Tailwind + shadcn", role: "Responsive design" },
  { category: "Realtime", tech: "Server-Sent Events", role: "Live tracking" },
] as const;
