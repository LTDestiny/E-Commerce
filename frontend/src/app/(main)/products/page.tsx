"use client";

import { Suspense, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import {
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { PRODUCT_CATALOG, formatVND } from "@/lib/commerce";
import { addToCart } from "@/lib/cart";

const allCategories = [
  "Tất cả",
  ...Array.from(new Set(PRODUCT_CATALOG.map((product) => product.category))),
];

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsContent />
    </Suspense>
  );
}

function ProductsContent() {
  const params = useSearchParams();
  const initialCategory = params.get("category") || "Tất cả";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(
    allCategories.includes(initialCategory) ? initialCategory : "Tất cả",
  );
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const products = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return PRODUCT_CATALOG.filter((product) => {
      const matchesCategory =
        category === "Tất cả" || product.category === category;
      const matchesQuery =
        !normalizedQuery ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.description.toLowerCase().includes(normalizedQuery);

      return matchesCategory && matchesQuery;
    });
  }, [category, query]);

  function changeQuantity(productId: string, delta: number) {
    setQuantities((current) => ({
      ...current,
      [productId]: Math.max(1, (current[productId] ?? 1) + delta),
    }));
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Sản phẩm"
        description="Catalog mua sắm với tìm kiếm, lọc danh mục, đánh giá, bảo hành và thêm giỏ hàng."
        icon={<SlidersHorizontal className="h-6 w-6 text-primary" />}
      />

      <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-2 rounded-md border px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm điện thoại, laptop, tai nghe..."
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {allCategories.map((item) => (
            <Button
              key={item}
              variant={category === item ? "default" : "outline"}
              size="sm"
              onClick={() => setCategory(item)}
            >
              {item}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {products.map((product, index) => {
          const quantity = quantities[product.id] ?? 1;

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card className="h-full rounded-lg py-5">
                <CardContent className="space-y-4 px-5">
                  <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md bg-muted">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt={product.name}
                        fill
                        className="object-cover transition-transform duration-300 hover:scale-105"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        unoptimized
                      />
                    ) : (
                      <div
                        className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${product.accentClass}`}
                      >
                        <Package className="h-12 w-12 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{product.category}</Badge>
                      <Badge variant="secondary">★ {product.rating}</Badge>
                      <Badge variant="secondary">Đã bán {product.sold}</Badge>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">{product.name}</h2>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {product.description}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {product.specs.map((spec) => (
                        <Badge key={spec} variant="outline">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {product.warranty}
                        </p>
                        <p className="text-xl font-bold">
                          {formatVND(product.price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => changeQuantity(product.id, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center font-semibold">
                          {quantity}
                        </span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => changeQuantity(product.id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => addToCart(product.id, quantity)}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Thêm vào giỏ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {products.length === 0 && (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Không tìm thấy sản phẩm phù hợp.
        </div>
      )}
    </div>
  );
}
