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

export const PRODUCT_CATALOG: ProductMeta[] = [
  {
    id: "PROD-001",
    name: "iPhone 15 Pro Max",
    price: 34990000,
    category: "Điện thoại",
    shortDescription: "Màn hình lớn, camera chuyên nghiệp, hiệu năng cao.",
    description: "Flagship iOS cho quay chụp, làm việc di động và giải trí cao cấp.",
    specs: ["256GB", "Titanium", "48MP"],
    accentClass: "from-slate-900 to-slate-500",
    rating: 4.9,
    sold: 1280,
    warranty: "12 tháng chính hãng",
    image: "https://i.pinimg.com/736x/13/b6/10/13b610a807293ca62d170ca0a1c34486.jpg",
  },
  {
    id: "PROD-002",
    name: "Samsung Galaxy S24 Ultra",
    price: 31990000,
    category: "Điện thoại",
    shortDescription: "Màn hình Dynamic AMOLED, bút S Pen, AI tích hợp.",
    description: "Điện thoại Android cao cấp cho ghi chú, xử lý tài liệu và chụp ảnh zoom xa.",
    specs: ["256GB", "S Pen", "AI Camera"],
    accentClass: "from-violet-800 to-blue-500",
    rating: 4.8,
    sold: 940,
    warranty: "12 tháng chính hãng",
    image: "https://i.pinimg.com/736x/24/22/32/24223258deb2711a6cfb6ffe2ba3b5e9.jpg",
  },
  {
    id: "PROD-003",
    name: "MacBook Pro M3",
    price: 49990000,
    category: "Laptop",
    shortDescription: "Laptop hiệu năng cao cho công việc sáng tạo.",
    description: "Máy trạm gọn nhẹ cho lập trình, thiết kế, dựng video và xử lý tác vụ nặng.",
    specs: ["M3", "16GB RAM", "512GB SSD"],
    accentClass: "from-neutral-800 to-zinc-400",
    rating: 4.9,
    sold: 520,
    warranty: "12 tháng Apple",
    image: "https://i.pinimg.com/736x/18/30/7d/18307dfde0f655618d822607bda8c931.jpg",
  },
  {
    id: "PROD-004",
    name: "AirPods Pro 2",
    price: 6790000,
    category: "Âm thanh",
    shortDescription: "Tai nghe chống ồn chủ động, nhỏ gọn, pin tốt.",
    description: "Tai nghe true wireless cho làm việc tập trung, gọi video và nghe nhạc hằng ngày.",
    specs: ["ANC", "USB-C", "Spatial Audio"],
    accentClass: "from-sky-700 to-cyan-400",
    rating: 4.7,
    sold: 2130,
    warranty: "12 tháng chính hãng",
    image: "https://i.pinimg.com/736x/88/12/28/88122855d4faa222a3c0ebb2c33e6726.jpg",
  },
  {
    id: "PROD-005",
    name: "iPad Air M2",
    price: 18990000,
    category: "Máy tính bảng",
    shortDescription: "Mỏng nhẹ, mạnh mẽ cho học tập và thiết kế.",
    description: "Máy tính bảng cân bằng giữa giải trí, ghi chú, vẽ phác và làm việc linh hoạt.",
    specs: ["M2", "11 inch", "Wi-Fi"],
    accentClass: "from-emerald-800 to-teal-400",
    rating: 4.8,
    sold: 760,
    warranty: "12 tháng Apple",
    image: "https://i.pinimg.com/1200x/78/c4/5c/78c45c49f269519c2259092d6e07b519.jpg",
  },
  {
    id: "PROD-006",
    name: "Neural Engine Core v2",
    price: 15500000,
    category: "Linh kiện",
    shortDescription: "Bộ xử lý tăng tốc AI phần cứng chuyên dụng.",
    description: "Card tăng tốc xử lý AI chuyên dụng cho máy chủ và ứng dụng Deep Learning.",
    specs: ["Tensor Core", "PCIe 4.0", "Active Cooling"],
    accentClass: "from-purple-900 to-indigo-600",
    rating: 4.8,
    sold: 85,
    warranty: "36 tháng chính hãng",
    image: "https://i.pinimg.com/736x/fa/27/bc/fa27bc819b0f914ad3cca859a238d727.jpg",
  },
  {
    id: "PROD-007",
    name: "Quantum Cooling Fan",
    price: 1250000,
    category: "Phụ kiện",
    shortDescription: "Quạt tản nhiệt lượng tử thông minh.",
    description: "Quạt tản nhiệt lượng tử thông minh làm mát siêu êm cho dàn PC cao cấp.",
    specs: ["120mm", "RGB LED", "Silent Bearings"],
    accentClass: "from-blue-800 to-teal-500",
    rating: 4.7,
    sold: 340,
    warranty: "12 tháng chính hãng",
    image: "https://i.pinimg.com/736x/09/bb/4b/09bb4b9dc71193d01520a5bc5dba4fd8.jpg",
  },
  {
    id: "PROD-008",
    name: "High-Density SSD 4TB",
    price: 8990000,
    category: "Linh kiện",
    shortDescription: "SSD NVMe 4TB tốc độ đọc ghi siêu tốc.",
    description: "Ổ cứng lưu trữ SSD dung lượng cực cao 4TB tốc độ đọc ghi lên tới 7300MB/s.",
    specs: ["4TB NVMe", "Gen 4x4", "7300MB/s"],
    accentClass: "from-zinc-800 to-stone-500",
    rating: 4.9,
    sold: 190,
    warranty: "60 tháng chính hãng",
    image: "https://i.pinimg.com/1200x/30/0f/ec/300fec278b67becaa3c4bde62fdd04b5.jpg",
  },
  {
    id: "PROD-009",
    name: "iPhone 17 Pro Max",
    price: 42990000,
    category: "Điện thoại",
    shortDescription: "Siêu phẩm điện thoại thế hệ mới của tương lai.",
    description: "Siêu phẩm điện thoại ý tưởng thế hệ mới với hiệu năng tối thượng và cụm camera đột phá.",
    specs: ["Concept", "OLED 144Hz", "Under-display Camera"],
    accentClass: "from-red-900 to-rose-600",
    rating: 4.9,
    sold: 150,
    warranty: "24 tháng chính hãng",
    image: "https://i.pinimg.com/736x/90/4f/9d/904f9d8850db6e1cfa514481b43c8eea.jpg",
  },
  {
    id: "PROD-010",
    name: "Premium Headphones Collection",
    price: 10000,
    category: "Âm thanh",
    shortDescription: "Bộ sưu tập tai nghe cao cấp với giá siêu ưu đãi.",
    description: "Bộ sưu tập tai nghe chụp tai cao cấp cho kiểm thử thanh toán SePay 10,000 VND.",
    specs: ["Hi-Res", "30h battery", "Ultra Cheap"],
    accentClass: "from-rose-500 to-orange-400",
    rating: 5.0,
    sold: 999,
    warranty: "12 tháng chính hãng",
    image: "https://i.pinimg.com/736x/c5/4f/2e/c54f2ec1a1c5d0dbdb88c3a111a8b056.jpg",
  },
];

export async function fetchCatalogProducts(): Promise<ProductMeta[]> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"}/api/inventory`);
  if (!response.ok) return [];
  const inventory = (await response.json()) as Array<{ productId: string; productName: string; availableStock: number; lowStockThreshold: number; updatedAt: string }>;
  return inventory.map((item) => {
    const meta = PRODUCT_CATALOG.find((p) => p.id === item.productId);
    return {
      id: item.productId,
      name: item.productName,
      price: meta?.price ?? 150000,
      category: meta?.category ?? "Linh kiện",
      shortDescription: meta?.shortDescription ?? `Tồn kho còn ${item.availableStock}`,
      description: meta?.description ?? `Sản phẩm công nghệ cao cấp chính hãng từ đối tác phân phối TechSphere.`,
      specs: meta?.specs ?? [
        `Available: ${item.availableStock}`,
        `Low stock threshold: ${item.lowStockThreshold}`,
      ],
      accentClass: meta?.accentClass ?? "from-slate-800 to-slate-500",
      rating: meta?.rating ?? 4.5,
      sold: meta?.sold ?? 100,
      warranty: meta?.warranty ?? "Theo cấu hình hệ thống",
      image: meta?.image,
    };
  });
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
