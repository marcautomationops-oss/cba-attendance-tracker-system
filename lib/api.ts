import { NextResponse } from "next/server";
import { AUTH_COOKIE, teacherCookieValue } from "@/lib/auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireTeacher(request: Request) {
  const cookieHeader = request.headers.get("cookie") || "";
  const expected = await teacherCookieValue();
  const hasCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${AUTH_COOKIE}=${expected}`);

  return Boolean(expected && hasCookie);
}

export function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
