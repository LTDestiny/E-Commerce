import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  const role = request.cookies.get("auth_role")?.value;
  const { pathname } = request.nextUrl;
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");

  // Paths requiring authorization
  const protectedPaths = ["/dashboard", "/orders", "/profile"];
  const isProtected = protectedPaths.some((path) => pathname.startsWith(path));

  if ((isProtected || isAdminPath) && !token) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminPath && token && !role) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminPath && role && role !== "ADMIN") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Prevent authenticated users from returning to /auth
  if (pathname.startsWith("/auth") && token && role) {
    const url = request.nextUrl.clone();
    url.pathname = role === "ADMIN" ? "/admin" : "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/orders/:path*",
    "/profile/:path*",
    "/admin",
    "/admin/:path*",
    "/auth",
  ],
};
