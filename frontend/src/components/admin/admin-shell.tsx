"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Boxes,
  CreditCard,
  ClipboardList,
  FileClock,
  Gauge,
  Grid3X3,
  HelpCircle,
  LogOut,
  PackageCheck,
  Search,
  Settings,
  ShoppingCart,
  Truck,
  Users,
} from "lucide-react";
import { clearAuthSession, syncClientAuthState, type AuthUser } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/shipments", label: "Shipments", icon: Truck },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/system-monitor", label: "System Monitor", icon: BarChart3 },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileClock },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function isActive(pathname: string, href: string) {
  if (href === "/admin/dashboard") return pathname === "/admin/dashboard" || pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const synced = syncClientAuthState();
    if (!synced || synced.role !== "ADMIN") {
      router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      return;
    }

    setUser(synced);
    setChecked(true);
  }, [pathname, router]);

  const logout = () => {
    clearAuthSession();
    router.replace("/auth?next=/admin");
  };

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f5fb] text-sm text-zinc-600">
        Dang kiem tra quyen admin...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f6fc] text-[#111114]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-zinc-300 bg-[#fbf9ff] lg:flex lg:flex-col">
        <div className="px-6 py-7">
          <Link href="/admin/dashboard" className="block">
            <div className="text-xl font-black tracking-tight">TechSphere</div>
            <div className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
              Operational Truth
            </div>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center gap-4 rounded-md border-l-2 border-transparent px-5 py-3 text-[15px] font-medium transition",
                  active
                    ? "border-blue-600 bg-[#edeaf7] text-blue-700"
                    : "text-zinc-800 hover:bg-white hover:text-blue-700",
                )}
              >
                <Icon className={cn("h-5 w-5", active ? "text-blue-700" : "text-zinc-900")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-300 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-[#f1eef9] p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-cyan-200">
              AD
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold">{user?.name || "Admin User"}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                System Root
              </div>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-md p-2 text-zinc-500 hover:bg-white hover:text-red-600"
              aria-label="Dang xuat"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-zinc-300 bg-[#fbf9ff]/95 px-4 backdrop-blur lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative w-full max-w-xl">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500" />
              <input
                className="h-11 w-full rounded-md border border-zinc-300 bg-[#f2f0fa] pl-11 pr-4 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="Search operational data..."
              />
            </div>
          </div>
          <div className="ml-4 flex items-center gap-4">
            <button className="relative rounded-md p-2 hover:bg-[#edeaf7]" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-600" />
            </button>
            <button className="rounded-md p-2 hover:bg-[#edeaf7]" aria-label="Help">
              <HelpCircle className="h-5 w-5" />
            </button>
            <button className="rounded-md p-2 hover:bg-[#edeaf7]" aria-label="Apps">
              <Grid3X3 className="h-5 w-5" />
            </button>
            <div className="hidden h-8 w-px bg-zinc-300 sm:block" />
            <div className="hidden text-right sm:block">
              <div className="text-sm font-bold">{user?.name || "Admin User"}</div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Super Admin
              </div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-zinc-300 bg-slate-950 text-xs font-black text-cyan-200">
              <PackageCheck className="h-5 w-5" />
            </div>
          </div>
        </header>

        <main className="min-h-[calc(100vh-64px)] overflow-hidden px-4 py-8 lg:px-7">
          {children}
        </main>
      </div>
    </div>
  );
}

