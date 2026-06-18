import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, teacherCookieValue } from "@/lib/auth";

const protectedRoutes = ["/dashboard", "/sections", "/settings"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requiresTeacher = protectedRoutes.some((route) => path === route || path.startsWith(`${route}/`));

  if (!requiresTeacher) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(AUTH_COOKIE)?.value;
  const expected = await teacherCookieValue();

  if (cookie && expected && cookie === expected) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", path);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/sections/:path*", "/settings/:path*"]
};
