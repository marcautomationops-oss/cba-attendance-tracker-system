import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Context = {
  params: Promise<{ id: string }>;
};

type ReviewRow = {
  row_number: number;
  student_number: string;
  full_name: string;
  contact_number: string | null;
  issues: string[];
  save: boolean;
};

type SaveBody = {
  action?: "save";
  rows?: ReviewRow[];
};

function value(row: Record<string, unknown>, aliases: string[]) {
  const entries = Object.entries(row);
  const found = entries.find(([key]) => aliases.some((alias) => key.trim().toLowerCase() === alias));
  return cleanText(found?.[1]);
}

async function subjectContext(subjectId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subjects")
    .select("id,name,section_id,sections(name)")
    .eq("id", subjectId)
    .single();
  if (error || !data) return null;
  const row = data as { name: string; sections?: { name?: string } | { name?: string }[] };
  const sectionName = Array.isArray(row.sections) ? row.sections[0]?.name : row.sections?.name;
  return { subjectName: row.name, sectionName: sectionName || null };
}

export async function POST(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;
  const contentType = request.headers.get("content-type") || "";
  const supabase = getSupabaseAdmin();
  const ctx = await subjectContext(id);
  if (!ctx) return jsonError("Subject was not found.", 404);

  if (contentType.includes("application/json")) {
    const body = await parseJson<SaveBody>(request);
    const rows = (body?.rows || []).filter((row) => row.save && !row.issues.length);
    if (!rows.length) return jsonError("No valid reviewed rows were selected.");

    const saved = [];
    for (const row of rows) {
      const studentPayload: Record<string, string | boolean | null> = {
        student_number: row.student_number,
        full_name: row.full_name,
        section: ctx.sectionName,
        is_active: true,
        updated_at: new Date().toISOString()
      };
      if (row.contact_number) studentPayload.contact_number = row.contact_number;

      const { data: student, error: studentError } = await supabase
        .from("students")
        .upsert(studentPayload, { onConflict: "student_number" })
        .select("*")
        .single();

      if (studentError) {
        if (studentError.message.includes("contact_number")) {
          return jsonError("Run the updated Supabase schema to enable optional contact numbers for SMS alerts.", 500);
        }
        return jsonError(studentError.message, 500);
      }
      const { error: linkError } = await supabase
        .from("subject_students")
        .upsert({ subject_id: id, student_id: student.id }, { onConflict: "subject_id,student_id" });
      if (linkError) return jsonError(linkError.message, 500);
      saved.push(student);
    }

    return NextResponse.json({ saved });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Upload an .xlsx file.");
  if (!file.name.toLowerCase().endsWith(".xlsx")) return jsonError("Excel import accepts .xlsx files only.");

  const bytes = await file.arrayBuffer();
  const workbook = XLSX.read(bytes, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  const seen = new Set<string>();
  const reviewRows: ReviewRow[] = rows.map((row, index) => {
    const student_number = value(row, ["student id", "student number", "student no", "student_number", "id"]);
    const full_name = value(row, ["full name", "name", "student name", "fullname"]);
    const contact_number = value(row, ["contact number", "contact", "phone", "mobile number", "mobile"]) || null;
    const issues: string[] = [];

    if (!student_number) issues.push("Missing student ID");
    if (!full_name) issues.push("Missing full name");
    if (student_number && seen.has(student_number.toLowerCase())) issues.push("Duplicate in file");
    if (student_number) seen.add(student_number.toLowerCase());

    return {
      row_number: index + 2,
      student_number,
      full_name,
      contact_number,
      issues,
      save: issues.length === 0
    };
  });

  const existingNumbers = reviewRows.map((row) => row.student_number).filter(Boolean);
  if (existingNumbers.length) {
    const { data: existing } = await supabase.from("students").select("student_number").in("student_number", existingNumbers);
    const existingSet = new Set((existing || []).map((row) => row.student_number.toLowerCase()));
    reviewRows.forEach((row) => {
      if (existingSet.has(row.student_number.toLowerCase())) row.issues.push("Existing student ID will be updated");
    });
  }

  return NextResponse.json({ rows: reviewRows });
}
