import { NextResponse } from "next/server";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Context = {
  params: Promise<{ id: string }>;
};

type SubjectBody = {
  name?: string;
};

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("section_id", id)
    .eq("is_active", true)
    .order("name");

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ subjects: data });
}

export async function POST(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const body = await parseJson<SubjectBody>(request);
  const name = cleanText(body?.name);
  if (!name) return jsonError("Subject name is required.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subjects")
    .insert({ section_id: id, name })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ subject: data }, { status: 201 });
}
