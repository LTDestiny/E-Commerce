// ==========================================
// Inventory Repository - PostgreSQL (Prisma)
// ==========================================

import { InventoryItem, StockReservation } from "@ecommerce/shared";
import { prisma } from "../lib/prisma";
import {
  InventoryItemRow,
  StockReservationRow,
  FailedStockItem,
} from "../types";
import { deleteCachedInventoryProducts } from "../lib/cache";

function toInventoryItem(row: InventoryItemRow): InventoryItem {
  return {
    productId: row.productId,
    productName: row.productName,
    totalStock: row.totalStock,
    reservedStock: row.reservedStock,
    availableStock: row.availableStock,
    lowStockThreshold: row.lowStockThreshold,
    updatedAt: row.updatedAt.toISOString(),
    price: row.price ?? undefined,
    category: row.category ?? undefined,
    shortDescription: row.shortDescription ?? undefined,
    description: row.description ?? undefined,
    specs: row.specs ? (Array.isArray(row.specs) ? row.specs : JSON.parse(JSON.stringify(row.specs))) : undefined,
    accentClass: row.accentClass ?? undefined,
    rating: row.rating ?? undefined,
    sold: row.sold ?? undefined,
    warranty: row.warranty ?? undefined,
    image: row.image ?? undefined,
  };
}

function toStockReservation(row: StockReservationRow): StockReservation {
  return {
    id: row.id,
    orderId: row.orderId,
    items: row.items as Array<{ productId: string; quantity: number }>,
    status: row.status as StockReservation["status"],
    createdAt: row.createdAt.toISOString(),
  };
}

class InventoryRepository {
  /**
   * Seed products if the inventory table is empty.
   * Called once at service startup.
   */
  async seedIfEmpty(): Promise<void> {
    const products = [
      {
        productId: "PROD-001",
        productName: "iPhone 15 Pro Max",
        totalStock: 100,
        availableStock: 100,
        lowStockThreshold: 10,
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
        productId: "PROD-002",
        productName: "Samsung Galaxy S24 Ultra",
        totalStock: 80,
        availableStock: 80,
        lowStockThreshold: 10,
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
        productId: "PROD-003",
        productName: "MacBook Pro M3",
        totalStock: 50,
        availableStock: 50,
        lowStockThreshold: 5,
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
        productId: "PROD-004",
        productName: "AirPods Pro 2",
        totalStock: 200,
        availableStock: 200,
        lowStockThreshold: 20,
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
        productId: "PROD-005",
        productName: "iPad Air M2",
        totalStock: 60,
        availableStock: 60,
        lowStockThreshold: 8,
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
        productId: "PROD-006",
        productName: "Neural Engine Core v2",
        totalStock: 450,
        availableStock: 450,
        lowStockThreshold: 50,
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
        productId: "PROD-007",
        productName: "Quantum Cooling Fan",
        totalStock: 18,
        availableStock: 18,
        lowStockThreshold: 20,
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
        productId: "PROD-008",
        productName: "High-Density SSD 4TB",
        totalStock: 30,
        availableStock: 30,
        lowStockThreshold: 10,
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
        productId: "PROD-009",
        productName: "iPhone 17 Pro Max",
        totalStock: 25,
        availableStock: 25,
        lowStockThreshold: 5,
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
        productId: "PROD-010",
        productName: "Premium Headphones Collection",
        totalStock: 9999,
        availableStock: 9999,
        lowStockThreshold: 1,
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

    for (const p of products) {
      await prisma.inventoryItem.upsert({
        where: { productId: p.productId },
        update: {
          price: p.price,
          category: p.category,
          shortDescription: p.shortDescription,
          description: p.description,
          specs: p.specs,
          accentClass: p.accentClass,
          rating: p.rating,
          sold: p.sold,
          warranty: p.warranty,
          image: p.image,
        },
        create: p,
      });
    }
    console.log(`[Inventory] Seeded/Ensured ${products.length} products in database`);
  }

  async findAll(): Promise<InventoryItem[]> {
    const rows = await prisma.inventoryItem.findMany();
    return rows.map(toInventoryItem);
  }

  async findByProductId(productId: string): Promise<InventoryItem | null> {
    const row = await prisma.inventoryItem.findUnique({
      where: { productId },
    });
    return row ? toInventoryItem(row) : null;
  }

  async reserveStock(
    orderId: string,
    items: Array<{ productId: string; quantity: number }>,
  ): Promise<{
    success: boolean;
    reservation?: StockReservation;
    failedItems?: FailedStockItem[];
  }> {
    // Check availability first
    const failedItems: FailedStockItem[] = [];

    for (const item of items) {
      const inv = await prisma.inventoryItem.findUnique({
        where: { productId: item.productId },
      });
      if (!inv || inv.availableStock < item.quantity) {
        failedItems.push({
          productId: item.productId,
          requestedQuantity: item.quantity,
          availableQuantity: inv?.availableStock || 0,
        });
      }
    }

    if (failedItems.length > 0) {
      return { success: false, failedItems };
    }

    // Use a transaction to reserve atomically
    const reservation = await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.inventoryItem.update({
          where: { productId: item.productId },
          data: {
            reservedStock: { increment: item.quantity },
            availableStock: { decrement: item.quantity },
          },
        });
      }

      return tx.stockReservation.create({
        data: {
          orderId,
          items: items as object[],
          status: "RESERVED",
        },
      });
    });

    await deleteCachedInventoryProducts(items.map((item) => item.productId));

    return { success: true, reservation: toStockReservation(reservation) };
  }

  async releaseStock(orderId: string): Promise<boolean> {
    const reservation = await prisma.stockReservation.findFirst({
      where: { orderId, status: "RESERVED" },
    });

    if (!reservation) return false;

    const items = reservation.items as Array<{
      productId: string;
      quantity: number;
    }>;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.inventoryItem.update({
          where: { productId: item.productId },
          data: {
            reservedStock: { decrement: item.quantity },
            availableStock: { increment: item.quantity },
          },
        });
      }

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: "RELEASED" },
      });
    });

    await deleteCachedInventoryProducts(items.map((item) => item.productId));

    return true;
  }

  async confirmStockDeduction(orderId: string): Promise<boolean> {
    const reservation = await prisma.stockReservation.findFirst({
      where: { orderId, status: "RESERVED" },
    });

    if (!reservation) return false;

    const items = reservation.items as Array<{
      productId: string;
      quantity: number;
    }>;

    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        await tx.inventoryItem.update({
          where: { productId: item.productId },
          data: {
            totalStock: { decrement: item.quantity },
            reservedStock: { decrement: item.quantity },
          },
        });
      }

      await tx.stockReservation.update({
        where: { id: reservation.id },
        data: { status: "COMPLETED" },
      });
    });

    await deleteCachedInventoryProducts(items.map((item) => item.productId));
    return true;
  }

  async getLowStockItems(): Promise<InventoryItem[]> {
    const rows = await prisma.$queryRaw<
      InventoryItemRow[]
    >`SELECT * FROM inventory_items WHERE "availableStock" <= "lowStockThreshold"`;
    return rows.map(toInventoryItem);
  }
}

export const inventoryRepository = new InventoryRepository();
