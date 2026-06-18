import { NextResponse } from "next/server";
import { AUTH_COOKIE, teacherCookieValue, validateAccessCode } from "@/lib/auth";
import { cleanText, jsonError, parseJson } from "@/lib/api";

type LoginBody = {
  accessCode?: string;
  next?: string;
};

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  let accessCode = "";
  let nextPath = "/dashboard";

  if (isJson) {
    const body = await parseJson<LoginBody>(request);
    accessCode = cleanText(body?.accessCode);
    nextPath = cleanText(body?.next) || nextPath;
  } else {
    const form = await request.formData();
    accessCode = cleanText(form.get("accessCode"));
    nextPath = cleanText(form.get("next")) || nextPath;
  }

  if (!(await validateAccessCode(accessCode))) {
    if (!isJson) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "1");
      if (nextPath.startsWith("/")) loginUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(loginUrl, { status: 303 });
    }
    return jsonError("The access code is not correct.", 401);
  }

  const response = isJson
    ? NextResponse.json({ ok: true, redirectTo: nextPath })
    : NextResponse.redirect(new URL(nextPath.startsWith("/") ? nextPath : "/dashboard", request.url), { status: 303 });
  response.cookies.set(AUTH_COOKIE, await teacherCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 12,
    path: "/"
  });

  return response;
}
