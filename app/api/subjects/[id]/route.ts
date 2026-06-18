import { NextResponse } from "next/server";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { deleteSubjectCascade } from "@/lib/deleteCleanup";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Context = {
  params: Promise<{ id: string }>;
};

type SubjectBody = {
  name?: string;
  is_active?: boolean;
};

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const [{ data, error }, sessionsResult] = await Promise.all([
    supabase.from("subjects").select("*").eq("id", id).single(),
    supabase
      .from("attendance_sessions")
      .select("*")
      .eq("subject_id", id)
      .order("session_date", { ascending: false })
      .order("start_time", { ascending: false })
  ]);

  if (error) return jsonError(error.message, 404);
  if (sessionsResult.error) return jsonError(sessionsResult.error.message, 500);
  return NextResponse.json({ subject: data, sessions: sessionsResult.data || [] });
}

export async function PATCH(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const body = await parseJson<SubjectBody>(request);
  const updates: Record<string, string | boolean> = {};

  if (body?.name !== undefined) updates.name = cleanText(body.name);
  if (body?.is_active !== undefined) updates.is_active = Boolean(body.is_active);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("subjects").update(updates).eq("id", id).select("*").single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ subject: data });
}

export async function DELETE(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;

  try {
    const summary = await deleteSubjectCascade(id);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Subject could not be deleted.", 500);
  }
}
