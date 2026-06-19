import { NextResponse } from "next/server";
import { signedStorageUrl } from "@/lib/storage";

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path")?.trim();
  if (!path || !path.startsWith("attendance-proofs/") || path.includes("..")) {
    return new Response("Proof photo was not found.", { status: 404 });
  }

  const signedUrl = await signedStorageUrl(path, 60);
  if (!signedUrl) return new Response("Proof photo was not found.", { status: 404 });
  return NextResponse.redirect(signedUrl, { headers: { "cache-control": "private, no-store" } });
}
