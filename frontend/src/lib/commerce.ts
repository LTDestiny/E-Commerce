export const STORE = {
  name: "TechSphere Commerce",
  customerIdPrefix: "TS-CUST",
  supportEmail: "support@techsphere.local",
} as const;

export type ProductMeta = {
  id: string;
  name: string;
  price: number;
  category: string;
  shortDescription: string;
  description: string;
  specs: string[];
  accentClass: string;
  rating: number;
  sold: number;
  warranty: string;
};

export const PRODUCT_CATALOG: ProductMeta[] = [
  {
    id: "PROD-001",
    name: "iPhone 15 Pro Max",
    price: 34990000,
    category: "Điện thoại",
    shortDescription: "Màn hình lớn, camera chuyên nghiệp, hiệu năng cao.",
    description:
      "Flagship iOS cho quay chụp, làm việc di động và giải trí cao cấp.",
    specs: ["256GB", "Titanium", "48MP"],
    accentClass: "from-slate-900 to-slate-500",
    rating: 4.9,
    sold: 1280,
    warranty: "12 tháng chính hãng",
  },
  {
    id: "PROD-002",
    name: "Samsung Galaxy S24 Ultra",
    price: 31990000,
    category: "Điện thoại",
    shortDescription: "Màn hình Dynamic AMOLED, bút S Pen, AI tích hợp.",
    description:
      "Điện thoại Android cao cấp cho ghi chú, xử lý tài liệu và chụp ảnh zoom xa.",
    specs: ["256GB", "S Pen", "AI Camera"],
    accentClass: "from-violet-800 to-blue-500",
    rating: 4.8,
    sold: 940,
    warranty: "12 tháng chính hãng",
  },
  {
    id: "PROD-003",
    name: "MacBook Pro M3",
    price: 49990000,
    category: "Laptop",
    shortDescription: "Laptop hiệu năng cao cho công việc sáng tạo.",
    description:
      "Máy trạm gọn nhẹ cho lập trình, thiết kế, dựng video và xử lý tác vụ nặng.",
    specs: ["M3", "16GB RAM", "512GB SSD"],
    accentClass: "from-neutral-800 to-zinc-400",
    rating: 4.9,
    sold: 520,
    warranty: "12 tháng Apple",
  },
  {
    id: "PROD-004",
    name: "AirPods Pro 2",
    price: 6790000,
    category: "Âm thanh",
    shortDescription: "Tai nghe chống ồn chủ động, nhỏ gọn, pin tốt.",
    description:
      "Tai nghe true wireless cho làm việc tập trung, gọi video và nghe nhạc hằng ngày.",
    specs: ["ANC", "USB-C", "Spatial Audio"],
    accentClass: "from-sky-700 to-cyan-400",
    rating: 4.7,
    sold: 2130,
    warranty: "12 tháng chính hãng",
  },
  {
    id: "PROD-005",
    name: "iPad Air M2",
    price: 18990000,
    category: "Máy tính bảng",
    shortDescription: "Mỏng nhẹ, mạnh mẽ cho học tập và thiết kế.",
    description:
      "Máy tính bảng cân bằng giữa giải trí, ghi chú, vẽ phác và làm việc linh hoạt.",
    specs: ["M2", "11 inch", "Wi-Fi"],
    accentClass: "from-emerald-800 to-teal-400",
    rating: 4.8,
    sold: 760,
    warranty: "12 tháng Apple",
  },
];

export function getProductMeta(productIdOrName: string): ProductMeta {
  return (
    PRODUCT_CATALOG.find(
      (product) =>
        product.id === productIdOrName || product.name === productIdOrName,
    ) ?? PRODUCT_CATALOG[0]
  );
}

export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function createCustomerId(): string {
  return `${STORE.customerIdPrefix}-${Date.now().toString(36).toUpperCase()}`;
}
