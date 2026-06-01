"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight,
  Headphones,
  Laptop,
  Package,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchCatalogProducts, STORE, formatVND, type ProductMeta } from "@/lib/commerce";
import { addToCart } from "@/lib/cart";
import { useEffect, useState } from "react";

const categories = [
  { label: "Điện thoại", icon: Smartphone },
  { label: "Laptop", icon: Laptop },
  { label: "Âm thanh", icon: Headphones },
];

export default function HomePage() {
  const [featured, setFeatured] = useState<ProductMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCatalogProducts().then((res) => {
      setFeatured(res.slice(0, 4));
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-12">
      <section className="relative -mx-4 min-h-[620px] overflow-hidden sm:-mx-6 lg:-mx-8 rounded-xl">
        <Image
          src="/commerce-hero.png"
          alt="Cửa hàng công nghệ TechSphere"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/10" />
        <div className="relative mx-auto flex min-h-[620px] max-w-7xl items-center px-4 py-12 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl space-y-6 text-white"
          >
            <Badge className="w-fit bg-white/15 text-white hover:bg-white/20">
              Công nghệ chính hãng
            </Badge>
            <div className="space-y-4">
              <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
                {STORE.name}
              </h1>
              <p className="text-lg leading-8 text-white/80">
                Cửa hàng điện tử với catalog, giỏ hàng, thanh toán, theo dõi
                vận chuyển, lịch sử đơn hàng và hồ sơ khách hàng trong một trải
                nghiệm mua sắm hoàn chỉnh.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/products">
                  Mua ngay <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <Link href="/orders">Tra cứu đơn hàng</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Bảo hành rõ ràng", "Thông tin bảo hành và tồn kho hiển thị trước khi mua.", ShieldCheck],
          ["Giao hàng theo dõi được", "Mỗi đơn có vận đơn, trạng thái và timeline xử lý.", Truck],
          ["JWT + Redis", "Đăng nhập JWT, rate limiter Redis và cache inventory.", Package],
        ].map(([title, description, Icon]) => (
          <div key={title as string} className="rounded-lg border p-5">
            <Icon className="mb-3 h-6 w-6" />
            <h2 className="font-semibold">{title as string}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {description as string}
            </p>
          </div>
        ))}
      </section>

      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold">Danh mục nổi bật</h2>
            <p className="text-muted-foreground">
              Tìm nhanh nhóm sản phẩm bạn cần.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/products">Xem tất cả</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {categories.map(({ label, icon: Icon }) => (
            <Link
              key={label}
              href={`/products?category=${encodeURIComponent(label)}`}
              className="rounded-lg border p-5 transition-colors hover:bg-muted/50"
            >
              <Icon className="mb-4 h-8 w-8" />
              <p className="font-semibold">{label}</p>
              <p className="text-sm text-muted-foreground">
                Sản phẩm chính hãng, giá niêm yết rõ ràng.
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-2xl font-bold">Sản phẩm bán chạy</h2>
            <p className="text-muted-foreground">
              Có thể thêm vào giỏ và checkout ngay.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/cart">Mở giỏ hàng</Link>
          </Button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <Card key={i} className="h-full rounded-lg py-4 animate-pulse">
                <CardContent className="space-y-4 px-4">
                  <div className="aspect-[4/3] w-full rounded-md bg-muted" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-5 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-8 bg-muted rounded w-full" />
                </CardContent>
              </Card>
            ))
          ) : (
            featured.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className="h-full rounded-lg py-4">
                  <CardContent className="space-y-4 px-4">
                    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
                      {product.image ? (
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover transition-transform duration-300 hover:scale-105"
                          sizes="(max-width: 768px) 100vw, 25vw"
                          unoptimized
                        />
                      ) : (
                        <div
                          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${product.accentClass}`}
                        >
                          <Package className="h-10 w-10 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="outline">{product.category}</Badge>
                        <span className="text-xs text-muted-foreground">
                          ★ {product.rating}
                        </span>
                      </div>
                      <h3 className="min-h-10 text-sm font-semibold leading-5">
                        {product.name}
                      </h3>
                      <p className="font-bold">{formatVND(product.price)}</p>
                      <p className="line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {product.shortDescription}
                      </p>
                    </div>
                    <Button className="w-full" onClick={() => addToCart(product.id)}>
                      <ShoppingCart className="h-4 w-4" />
                      Thêm vào giỏ
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
