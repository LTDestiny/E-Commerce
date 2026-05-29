"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authApi, clearAuthSession, getStoredToken, saveAuthSession } from "@/lib/api";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      return;
    }

    authApi.me().catch(async () => {
      try {
        const refreshed = await authApi.refresh();
        saveAuthSession(refreshed);
      } catch {
        clearAuthSession();
        router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
      }
    });
  }, [pathname, router]);

  return <>{children}</>;
}
