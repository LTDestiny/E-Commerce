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
  image?: string;
};

export async function fetchCatalogProducts(): Promise<ProductMeta[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/inventory`);
  if (!response.ok) return [];
  const inventory = (await response.json()) as any[];
  return inventory.map((item) => {
    return {
      id: item.productId,
      name: item.productName,
      price: item.price ?? 150000,
      category: item.category ?? "Linh kiện",
      shortDescription: item.shortDescription ?? `Tồn kho còn ${item.availableStock}`,
      description: item.description ?? `Sản phẩm công nghệ cao cấp chính hãng từ đối tác phân phối TechSphere.`,
      specs: Array.isArray(item.specs) ? item.specs : [],
      accentClass: item.accentClass ?? "from-slate-800 to-slate-500",
      rating: item.rating ?? 4.5,
      sold: item.sold ?? 10,
      warranty: item.warranty ?? "12 tháng chính hãng",
      image: item.image ?? undefined,
    };
  });
}

export function getProductMeta(productIdOrName: string): ProductMeta {
  return {
    id: productIdOrName,
    name: "Sản phẩm",
    price: 150000,
    category: "Linh kiện",
    shortDescription: "Sản phẩm công nghệ.",
    description: "Sản phẩm công nghệ cao cấp chính hãng từ đối tác phân phối TechSphere.",
    specs: [],
    accentClass: "from-slate-800 to-slate-500",
    rating: 4.5,
    sold: 10,
    warranty: "12 tháng chính hãng",
  };
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
