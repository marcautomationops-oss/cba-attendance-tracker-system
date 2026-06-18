import { NextResponse } from "next/server";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import type { Section, Subject } from "@/lib/types";

type SectionBody = {
  name?: string;
};

export async function GET(request: Request) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const supabase = getSupabaseAdmin();
  const { data: sections, error } = await supabase
    .from("sections")
    .select("*")
    .eq("is_active", true)
    .order("name");

  if (error) return jsonError(error.message, 500);

  const [studentsResult, subjectsResult] = await Promise.all([
    supabase.from("students").select("section").eq("is_active", true),
    supabase.from("subjects").select("section_id").eq("is_active", true)
  ]);

  if (studentsResult.error) return jsonError(studentsResult.error.message, 500);
  if (subjectsResult.error) return jsonError(subjectsResult.error.message, 500);

  const studentCounts = new Map<string, number>();
  for (const row of (studentsResult.data || []) as Pick<{ section: string | null }, "section">[]) {
    if (row.section) studentCounts.set(row.section, (studentCounts.get(row.section) || 0) + 1);
  }

  const subjectCounts = new Map<string, number>();
  for (const row of (subjectsResult.data || []) as Pick<Subject, "section_id">[]) {
    subjectCounts.set(row.section_id, (subjectCounts.get(row.section_id) || 0) + 1);
  }

  return NextResponse.json({
    sections: ((sections || []) as Section[]).map((section) => ({
      ...section,
      student_count: studentCounts.get(section.name) || 0,
      subject_count: subjectCounts.get(section.id) || 0
    }))
  });
}

export async function POST(request: Request) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const body = await parseJson<SectionBody>(request);
  const name = cleanText(body?.name);
  if (!name) return jsonError("Section name is required.");

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("sections").insert({ name }).select("*").single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ section: data }, { status: 201 });
}
