import { NextResponse } from "next/server";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type StudentBody = {
  student_number?: string;
  full_name?: string;
  section?: string | null;
  is_active?: boolean;
};

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const body = await parseJson<StudentBody>(request);
  const updates: Partial<StudentBody> & { updated_at: string } = {
    updated_at: new Date().toISOString()
  };

  if (body?.student_number !== undefined) updates.student_number = cleanText(body.student_number);
  if (body?.full_name !== undefined) updates.full_name = cleanText(body.full_name);
  if (body?.section !== undefined) updates.section = cleanText(body.section) || null;
  if (body?.is_active !== undefined) updates.is_active = Boolean(body.is_active);

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("students").update(updates).eq("id", id).select("*").single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ student: data });
}

export async function DELETE(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("students")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ student: data });
}
