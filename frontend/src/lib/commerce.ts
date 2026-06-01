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

export const PRODUCT_CATALOG: ProductMeta[] = [];

export async function fetchCatalogProducts(): Promise<ProductMeta[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/inventory`);
  if (!response.ok) return [];
  const inventory = (await response.json()) as Array<{ productId: string; productName: string; availableStock: number; lowStockThreshold: number; updatedAt: string }>;
  return inventory.map((item) => ({
    id: item.productId,
    name: item.productName,
    price: 0,
    category: "Sản phẩm thật",
    shortDescription: `Tồn kho còn ${item.availableStock}`,
    description: `Dữ liệu đồng bộ từ PostgreSQL, cập nhật lúc ${new Date(item.updatedAt).toLocaleString("vi-VN")}`,
    specs: [
      `Available: ${item.availableStock}`,
      `Low stock threshold: ${item.lowStockThreshold}`,
    ],
    accentClass: "from-slate-800 to-slate-500",
    rating: 0,
    sold: 0,
    warranty: "Theo cấu hình hệ thống",
  }));
}

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
