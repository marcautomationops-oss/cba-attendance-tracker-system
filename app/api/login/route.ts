import { NextResponse } from "next/server";
import { AUTH_COOKIE, createTeacherSession, SESSION_MAX_AGE_SECONDS } from "@/lib/auth";
import { validateAccessCode } from "@/lib/accessCode";
import { cleanText, jsonError, parseJson } from "@/lib/api";
import { clearDurableRateLimit, consumeDurableRateLimit } from "@/lib/rateLimit";
import { clientAddress, isSameOriginRequest } from "@/lib/security";

type LoginBody = {
  accessCode?: string;
  next?: string;
};

function safeNextPath(value: string, request: Request) {
  if (!value.startsWith("/")) return "/dashboard";

  try {
    const candidate = new URL(value, request.url);
    const current = new URL(request.url);
    return candidate.origin === current.origin ? `${candidate.pathname}${candidate.search}${candidate.hash}` : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

function rateLimitedResponse(request: Request, isJson: boolean, nextPath: string, retryAfterSeconds: number) {
  if (isJson) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429, headers: { "retry-after": String(retryAfterSeconds), "cache-control": "no-store" } }
    );
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", "rate");
  loginUrl.searchParams.set("next", nextPath);
  const response = NextResponse.redirect(loginUrl, { status: 303 });
  response.headers.set("retry-after", String(retryAfterSeconds));
  return response;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return jsonError("Cross-site request blocked.", 403);

  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  let accessCode = "";
  let requestedNext = "/dashboard";

  if (isJson) {
    const body = await parseJson<LoginBody>(request);
    accessCode = cleanText(body?.accessCode);
    requestedNext = cleanText(body?.next) || requestedNext;
  } else {
    const form = await request.formData();
    accessCode = cleanText(form.get("accessCode"));
    requestedNext = cleanText(form.get("next")) || requestedNext;
  }

  const nextPath = safeNextPath(requestedNext, request);
  const rateLimitKey = `teacher-login:${clientAddress(request)}`;
  let rateLimit;
  try {
    rateLimit = await consumeDurableRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Login protection is unavailable.", 503);
  }
  if (!rateLimit.allowed) return rateLimitedResponse(request, isJson, nextPath, rateLimit.retryAfterSeconds);

  let accessCodeValid = false;
  try {
    accessCodeValid = await validateAccessCode(accessCode);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Teacher authentication is unavailable.", 503);
  }
  if (!accessCodeValid) {
    if (!isJson) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("error", "invalid");
      loginUrl.searchParams.set("next", nextPath);
      return NextResponse.redirect(loginUrl, { status: 303 });
    }
    return jsonError("The access code is not correct.", 401);
  }

  const session = await createTeacherSession();
  if (!session) return jsonError("Teacher authentication is not configured.", 503);
  await clearDurableRateLimit(rateLimitKey);

  const response = isJson ? NextResponse.json({ ok: true, redirectTo: nextPath }) : NextResponse.redirect(new URL(nextPath, request.url), { status: 303 });
  response.cookies.set(AUTH_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    priority: "high"
  });
  response.headers.set("cache-control", "no-store");
  return response;
}
