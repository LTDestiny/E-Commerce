"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authApi, clearAuthSession, getStoredUser, saveAuthSession } from "@/lib/api";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getStoredUser>>(null);

  useEffect(() => {
    setCurrentUser(getStoredUser());
  }, []);

  useEffect(() => {
    if (currentUser) {
      setMessage(`Đã đăng nhập: ${currentUser.email}`);
    } else {
      setMessage(null);
    }
  }, [currentUser]);

  async function onSubmit() {
    try {
      setLoading(true);
      const payload = mode === "register"
        ? await authApi.register({ name, email, password })
        : await authApi.login({ email, password });
      saveAuthSession(payload);
      setCurrentUser(getStoredUser());
      router.push(next);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Auth error");
      console.error("Auth submit failed", error);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await authApi.logout().catch(() => undefined);
    clearAuthSession();
    setCurrentUser(null);
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-5xl items-center px-4 py-10">
      <div className={`grid w-full gap-6 ${currentUser ? "max-w-xl mx-auto grid-cols-1" : "lg:grid-cols-[0.95fr_1.05fr]"}`}>
        <div className="space-y-6 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-8">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" /> JWT Authentication
          </div>
          <div className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight">Đăng ký / Đăng nhập</h1>
            <p className="max-w-xl text-muted-foreground">
              Xác thực bằng access token + refresh token, cookie httpOnly, logout chuẩn production.
            </p>
          </div>
          {currentUser && (
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-medium">Đang đăng nhập bằng</p>
              <p className="text-muted-foreground">{currentUser.email}</p>
              <Button variant="outline" className="mt-4" onClick={logout}>Đăng xuất</Button>
            </div>
          )}
          {message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>

        {!currentUser && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle>{mode === "login" ? "Đăng nhập" : "Đăng ký"}</CardTitle>
              <CardDescription>
                {mode === "login" ? "Dùng email và password để nhận JWT" : "Tạo tài khoản mới và nhận JWT ngay"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "register" && <Input placeholder="Họ tên" value={name} onChange={(e) => setName(e.target.value)} />}
              <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input placeholder="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button className="w-full" onClick={onSubmit} disabled={loading}>
                {mode === "login" ? <LogIn className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                {loading ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Đăng ký"}
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                Chuyển sang {mode === "login" ? "đăng ký" : "đăng nhập"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
