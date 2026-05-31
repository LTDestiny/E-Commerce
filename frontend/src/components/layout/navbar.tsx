"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import {
  Activity,
  LogIn,
  LogOut,
  Menu,
  Package,
  PackageSearch,
  ReceiptText,
  ShoppingCart,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/constants";
import { authApi, clearAuthSession, getStoredUser, syncClientAuthState } from "@/lib/api";
import { CART_UPDATED_EVENT, getCartCount, readCart } from "@/lib/cart";

const iconMap = {
  Store,
  PackageSearch,
  Activity,
  ShoppingCart,
  ReceiptText,
  UserRound,
};

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [cartCount, setCartCount] = useState(0);

  // ✅ FIX Hydration CLS: chờ client mount xong mới render nội dung
  // phụ thuộc localStorage (user, cartCount) — tránh layout shift
  const [mounted, setMounted] = useState(false);

  const dynamicNavItems = mounted && user?.role === "ADMIN"
    ? [...NAV_ITEMS, { label: "Quản trị", href: "/admin", icon: "PackageSearch" as const }]
    : NAV_ITEMS;

  useEffect(() => {
    const syncSession = () => {
      setUser(syncClientAuthState() ?? getStoredUser());
      setCartCount(getCartCount(readCart()));
    };

    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setMounted(true);
      syncSession();
    });

    window.addEventListener(CART_UPDATED_EVENT, syncSession);
    window.addEventListener("storage", syncSession);
    window.addEventListener("auth-changed", syncSession);
    window.addEventListener("focus", syncSession);
    window.addEventListener("pageshow", syncSession);
    document.addEventListener("visibilitychange", syncSession);

    return () => {
      active = false;
      window.removeEventListener(CART_UPDATED_EVENT, syncSession);
      window.removeEventListener("storage", syncSession);
      window.removeEventListener("auth-changed", syncSession);
      window.removeEventListener("focus", syncSession);
      window.removeEventListener("pageshow", syncSession);
      document.removeEventListener("visibilitychange", syncSession);
    };
  }, [pathname]);

  async function logout() {
    clearAuthSession();
    setUser(null);
    setCartCount(0);
    setMobileOpen(false);
    void authApi.logout().catch(() => undefined);
    window.location.href = "/";
  }

  // Placeholder vô hình cùng kích thước auth button
  // → giữ navbar width cố định trước khi mount
  const authPlaceholder = (
    <div className="h-8 w-[100px] shrink-0" aria-hidden />
  );

  return (
    <nav className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <motion.div
              whileHover={{ rotate: 10 }}
              className="flex items-center justify-center rounded-md bg-primary p-2"
            >
              <Package className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <span className="hidden text-lg font-bold sm:inline-block">TechSphere</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden flex-1 items-center justify-end gap-1 overflow-hidden md:flex">
            {dynamicNavItems.map((item) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap];
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className="shrink-0">
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className={cn("gap-2 text-sm", isActive && "pointer-events-none")}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                      {/* Badge giỏ hàng — chỉ hiện sau mount */}
                      {mounted && item.href === "/cart" && cartCount > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                          {cartCount}
                        </Badge>
                      )}
                    </Button>
                  </motion.div>
                </Link>
              );
            })}

            {/* Auth buttons — placeholder trước mount để giữ layout ổn định */}
            {!mounted ? (
              authPlaceholder
            ) : !user ? (
              <Link href="/auth" className="shrink-0">
                <Button
                  variant={pathname === "/auth" ? "default" : "outline"}
                  size="sm"
                  className="gap-2 text-sm"
                >
                  <LogIn className="h-4 w-4" />
                  Đăng nhập
                </Button>
              </Link>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 text-sm"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </Button>
            )}
          </div>

          {/* Hamburger mobile */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="border-t md:hidden"
        >
          <div className="space-y-1 px-4 py-3">
            {dynamicNavItems.map((item) => {
              const Icon = iconMap[item.icon as keyof typeof iconMap];
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className="w-full justify-start gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                    {mounted && item.href === "/cart" && cartCount > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {cartCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              );
            })}

            {mounted && !user && (
              <Link href="/auth" onClick={() => setMobileOpen(false)}>
                <Button
                  variant={pathname === "/auth" ? "default" : "ghost"}
                  className="w-full justify-start gap-2"
                >
                  <LogIn className="h-4 w-4" />
                  Đăng nhập
                </Button>
              </Link>
            )}
            {mounted && user && (
              <Button
                variant="ghost"
                className="w-full justify-start gap-2"
                onClick={logout}
              >
                <LogOut className="h-4 w-4" />
                Đăng xuất
              </Button>
            )}
          </div>
        </motion.div>
      )}
    </nav>
  );
}
