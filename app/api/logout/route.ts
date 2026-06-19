import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";
import { isSameOriginRequest } from "@/lib/security";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }

  const redirectUrl = new URL("/login", request.url);
  const response = NextResponse.redirect(redirectUrl, { status: 303 });
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/"
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
