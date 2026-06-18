import { NextResponse } from "next/server";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { deleteSectionCascade } from "@/lib/deleteCleanup";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Context = {
  params: Promise<{ id: string }>;
};

type SectionBody = {
  name?: string;
  is_active?: boolean;
};

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("sections").select("*").eq("id", id).single();

  if (error) return jsonError(error.message, 404);
  return NextResponse.json({ section: data });
}

export async function PATCH(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const body = await parseJson<SectionBody>(request);
  const updates: Record<string, string | boolean> = {};

  if (body?.name !== undefined) updates.name = cleanText(body.name);
  if (body?.is_active !== undefined) updates.is_active = Boolean(body.is_active);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("sections").update(updates).eq("id", id).select("*").single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ section: data });
}

export async function DELETE(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;

  try {
    const summary = await deleteSectionCascade(id);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Section could not be deleted.", 500);
  }
}
