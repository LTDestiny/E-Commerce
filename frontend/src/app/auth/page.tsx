"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldCheck, LogIn, UserPlus, Mail, KeyRound } from "lucide-react";
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
  
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  // Check query params for reset password mode
  useEffect(() => {
    const modeParam = params.get("mode");
    const tokenParam = params.get("token");
    if (modeParam === "reset" && tokenParam) {
      setMode("reset");
    }
  }, [params]);

  async function onSubmit() {
    try {
      setLoading(true);
      setMessage(null);

      if (mode === "register") {
        const payload = await authApi.register({ name, email, password });
        saveAuthSession(payload, { mergeGuestCart: true });
        setCurrentUser(getStoredUser());
        router.push(next);
        router.refresh();
      } else if (mode === "login") {
        const payload = await authApi.login({ email, password });
        saveAuthSession(payload, { mergeGuestCart: true });
        setCurrentUser(getStoredUser());
        router.push(next);
        router.refresh();
      } else if (mode === "forgot") {
        const response = await authApi.forgotPassword(email);
        setMessage(response.message || "Yêu cầu khôi phục mật khẩu đã được gửi. Vui lòng kiểm tra email.");
      } else if (mode === "reset") {
        const token = params.get("token") || "";
        if (password !== confirmPassword) {
          setMessage("Mật khẩu nhập lại không khớp!");
          setLoading(false);
          return;
        }
        const response = await authApi.resetPassword({ token, password });
        setMessage(response.message || "Đổi mật khẩu thành công. Đang chuyển hướng...");
        setTimeout(() => {
          setMode("login");
          setMessage(null);
          router.push("/auth");
        }, 3000);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Auth error");
      console.error("Auth action failed", error);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    clearAuthSession();
    setCurrentUser(null);
    void authApi.logout().catch(() => undefined);
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
            <h1 className="text-4xl font-bold tracking-tight">Xác thực hệ thống</h1>
            <p className="max-w-xl text-muted-foreground">
              Bảo mật đa lớp: API Gateway chặn lọc JWT, Identity Forwarding xuống các Microservices hạ nguồn, phiên làm việc an toàn với Whitelist Redis.
            </p>
          </div>
          {currentUser && (
            <div className="rounded-xl border bg-card p-4 text-sm">
              <p className="font-medium">Đang đăng nhập bằng</p>
              <p className="text-muted-foreground">{currentUser.email}</p>
              <p className="text-xs bg-primary/20 text-primary-foreground font-semibold inline-block px-2 py-0.5 rounded mt-2 uppercase">Role: {currentUser.role}</p>
              <Button variant="outline" className="mt-4 block" onClick={logout}>Đăng xuất</Button>
            </div>
          )}
          {message && <p className="text-sm text-primary font-medium border border-primary/20 bg-primary/5 rounded-lg p-3">{message}</p>}
        </div>

        {!currentUser && (
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle>
                {mode === "login" && "Đăng nhập"}
                {mode === "register" && "Đăng ký"}
                {mode === "forgot" && "Quên mật khẩu"}
                {mode === "reset" && "Đặt lại mật khẩu"}
              </CardTitle>
              <CardDescription>
                {mode === "login" && "Dùng email và mật khẩu của bạn để nhận phiên làm việc"}
                {mode === "register" && "Tạo tài khoản mới và nhận JWT ngay"}
                {mode === "forgot" && "Nhập email của bạn. Chúng tôi sẽ gửi sự kiện khôi phục qua Mail"}
                {mode === "reset" && "Thiết lập mật khẩu mới cho tài khoản của bạn"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mode === "register" && (
                <Input placeholder="Họ tên" value={name} onChange={(e) => setName(e.target.value)} />
              )}
              {(mode !== "reset") && (
                <Input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              )}
              {(mode === "login" || mode === "register" || mode === "reset") && (
                <Input placeholder="Mật khẩu" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              )}
              {mode === "reset" && (
                <Input placeholder="Nhập lại mật khẩu" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              )}
              
              <Button className="w-full" onClick={onSubmit} disabled={loading}>
                {mode === "login" && <LogIn className="h-4 w-4" />}
                {mode === "register" && <UserPlus className="h-4 w-4" />}
                {mode === "forgot" && <Mail className="h-4 w-4" />}
                {mode === "reset" && <KeyRound className="h-4 w-4" />}
                {loading ? "Đang xử lý..." : (
                  <>
                    {mode === "login" && "Đăng nhập"}
                    {mode === "register" && "Đăng ký"}
                    {mode === "forgot" && "Gửi yêu cầu khôi phục"}
                    {mode === "reset" && "Cập nhật mật khẩu"}
                  </>
                )}
              </Button>

              {mode === "login" && (
                <div className="flex flex-col gap-2 pt-2">
                  <Button variant="ghost" className="w-full text-xs" onClick={() => setMode("forgot")}>
                    Quên mật khẩu?
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => setMode("register")}>
                    Tạo tài khoản mới
                  </Button>
                </div>
              )}

              {mode === "register" && (
                <Button variant="ghost" className="w-full" onClick={() => setMode("login")}>
                  Quay lại đăng nhập
                </Button>
              )}

              {(mode === "forgot" || mode === "reset") && (
                <Button variant="ghost" className="w-full" onClick={() => { setMode("login"); setMessage(null); }}>
                  Quay lại đăng nhập
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
