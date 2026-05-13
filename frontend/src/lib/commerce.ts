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
  specs: string[];
  accentClass: string;
};

export const PRODUCT_CATALOG: ProductMeta[] = [
  {
    id: "PROD-001",
    name: "iPhone 15 Pro Max",
    price: 34990000,
    category: "Điện thoại",
    shortDescription: "Màn hình lớn, camera chuyên nghiệp, hiệu năng cao.",
    specs: ["256GB", "Titanium", "48MP"],
    accentClass: "from-slate-900 to-slate-500",
  },
  {
    id: "PROD-002",
    name: "Samsung Galaxy S24 Ultra",
    price: 31990000,
    category: "Điện thoại",
    shortDescription: "Màn hình Dynamic AMOLED, bút S Pen, AI tích hợp.",
    specs: ["256GB", "S Pen", "AI Camera"],
    accentClass: "from-violet-800 to-blue-500",
  },
  {
    id: "PROD-003",
    name: "MacBook Pro M3",
    price: 49990000,
    category: "Laptop",
    shortDescription: "Laptop hiệu năng cao cho công việc sáng tạo.",
    specs: ["M3", "16GB RAM", "512GB SSD"],
    accentClass: "from-neutral-800 to-zinc-400",
  },
  {
    id: "PROD-004",
    name: "AirPods Pro 2",
    price: 6790000,
    category: "Âm thanh",
    shortDescription: "Tai nghe chống ồn chủ động, nhỏ gọn, pin tốt.",
    specs: ["ANC", "USB-C", "Spatial Audio"],
    accentClass: "from-sky-700 to-cyan-400",
  },
  {
    id: "PROD-005",
    name: "iPad Air M2",
    price: 18990000,
    category: "Máy tính bảng",
    shortDescription: "Mỏng nhẹ, mạnh mẽ cho học tập và thiết kế.",
    specs: ["M2", "11 inch", "Wi-Fi"],
    accentClass: "from-emerald-800 to-teal-400",
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
