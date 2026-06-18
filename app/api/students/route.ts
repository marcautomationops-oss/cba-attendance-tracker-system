import { NextResponse } from "next/server";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type StudentBody = {
  student_number?: string;
  full_name?: string;
  section?: string;
  is_active?: boolean;
};

export async function GET(request: Request) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const section = cleanText(searchParams.get("section"));
  const supabase = getSupabaseAdmin();

  let query = supabase.from("students").select("*").order("full_name");
  if (!includeInactive) query = query.eq("is_active", true);
  if (section) query = query.eq("section", section);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  return NextResponse.json({ students: data });
}

export async function POST(request: Request) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const body = await parseJson<StudentBody>(request);
  const student_number = cleanText(body?.student_number);
  const full_name = cleanText(body?.full_name);
  const section = cleanText(body?.section) || null;

  if (!student_number || !full_name) {
    return jsonError("Student number and full name are required.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("students")
    .insert({ student_number, full_name, section, is_active: body?.is_active ?? true })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ student: data }, { status: 201 });
}
