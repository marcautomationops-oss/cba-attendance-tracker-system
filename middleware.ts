import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, validateTeacherSession } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";

const protectedPages = ["/dashboard", "/sections", "/exports", "/settings", "/proof"];
const publicApiRoutes = ["/api/login", "/api/logout"];

function isProtectedPage(path: string) {
  return protectedPages.some((route) => path === route || path.startsWith(`${route}/`));
}

function isPublicApi(path: string) {
  return publicApiRoutes.includes(path) || path.startsWith("/api/attendance/");
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const privateApi = path.startsWith("/api/") && !isPublicApi(path);
  const requiresTeacher = isProtectedPage(path) || privateApi;

  if (!requiresTeacher) return NextResponse.next();

  if (privateApi && !isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const validSession = await validateTeacherSession(request.cookies.get(AUTH_COOKIE)?.value);
  if (validSession) return NextResponse.next();

  if (privateApi) {
    return NextResponse.json({ error: "Teacher login required." }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${path}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*", "/sections/:path*", "/exports/:path*", "/settings/:path*", "/proof", "/api/:path*"]
};
