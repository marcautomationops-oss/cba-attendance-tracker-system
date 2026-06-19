import { NextResponse } from "next/server";
import { AUTH_COOKIE, validateTeacherSession } from "@/lib/auth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function cookieValue(request: Request, name: string) {
  const prefix = `${name}=`;
  const cookie = (request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));
  return cookie ? cookie.slice(prefix.length) : "";
}

export async function requireTeacher(request: Request) {
  return validateTeacherSession(cookieValue(request, AUTH_COOKIE));
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
