"use client";

import { useEffect, useMemo, useState } from "react";
import { Mail, MapPin, ReceiptText, ShieldCheck, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { authApi, getStoredUser, ordersApi, saveAuthSession, type Order } from "@/lib/api";
import { formatVND } from "@/lib/commerce";

const PROFILE_KEY = "techsphere_profile";

type ProfileForm = {
  phone: string;
  address: string;
  city: string;
  note: string;
};

const defaultProfile: ProfileForm = {
  phone: "0901234567",
  address: "12 Nguyễn Văn Bảo",
  city: "TP. Hồ Chí Minh",
  note: "Giao giờ hành chính",
};

function readProfile(): ProfileForm {
  if (typeof window === "undefined") return defaultProfile;
  try {
    return { ...defaultProfile, ...JSON.parse(window.localStorage.getItem(PROFILE_KEY) || "{}") };
  } catch {
    return defaultProfile;
  }
}

export default function ProfilePage() {
  const [user, setUser] = useState<ReturnType<typeof getStoredUser>>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState(defaultProfile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUser(getStoredUser());
    setProfile(readProfile());
    authApi
      .me()
      .then((response) => {
        const currentToken = window.localStorage.getItem("techsphere_auth_token");
        if (currentToken) {
          saveAuthSession({ user: response.user, accessToken: currentToken });
          setUser(response.user);
        }
      })
      .catch(() => undefined);
    ordersApi.list().then(setOrders).catch(() => setOrders([]));
  }, []);

  const totalSpent = useMemo(
    () => orders.reduce((sum, order) => sum + order.totalAmount, 0),
    [orders],
  );

  function saveProfile() {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Hồ sơ khách hàng"
        description="Quản lý tài khoản, địa chỉ giao hàng mặc định và tổng quan mua sắm."
        icon={<UserRound className="h-6 w-6 text-primary" />}
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>Tài khoản</CardTitle>
            <CardDescription>Thông tin xác thực JWT hiện tại.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-md bg-primary text-2xl font-bold text-primary-foreground">
              {user?.name?.slice(0, 1).toUpperCase() ?? "U"}
            </div>
            <div>
              <p className="text-lg font-semibold">{user?.name ?? "Khách hàng"}</p>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {user?.email ?? "Chưa có email"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {user?.role ?? "CUSTOMER"}
              </Badge>
              <Badge variant="outline">JWT protected</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-3">
          <Summary label="Đơn hàng" value={orders.length.toString()} />
          <Summary label="Tổng chi tiêu" value={formatVND(totalSpent)} />
          <Summary
            label="Đơn mới nhất"
            value={orders[orders.length - 1]?.status ?? "Chưa có"}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Địa chỉ mặc định
            </CardTitle>
            <CardDescription>
              Dùng làm thông tin tham khảo khi checkout các đơn sau.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {[
              ["phone", "Số điện thoại"],
              ["city", "Tỉnh/thành"],
              ["address", "Địa chỉ"],
              ["note", "Ghi chú giao hàng"],
            ].map(([field, label]) => (
              <input
                key={field}
                value={profile[field as keyof ProfileForm]}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    [field]: event.target.value,
                  }))
                }
                className="h-10 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                placeholder={label}
              />
            ))}
            <div className="sm:col-span-2">
              <Button onClick={saveProfile}>
                {saved ? "Đã lưu" : "Lưu hồ sơ"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" />
              Mua gần đây
            </CardTitle>
            <CardDescription>Ba đơn mới nhất trong hệ thống.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...orders].reverse().slice(0, 3).map((order) => (
              <div key={order.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">#{order.id.slice(0, 10)}</span>
                  <Badge variant="outline">{order.status}</Badge>
                </div>
                <p className="mt-1 text-muted-foreground">
                  {formatVND(order.totalAmount)} ·{" "}
                  {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                Chưa có lịch sử mua hàng.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-lg py-5">
      <CardContent className="px-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
