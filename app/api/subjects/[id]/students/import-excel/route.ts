import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

const blockingIssues = new Set(["Missing student ID", "Missing full name", "Duplicate in file"]);
const existingStudentNotice = "Existing student ID will be updated";
const requiredHeaders = ["student number", "full name"];
const optionalHeaders = ["contact number"];

function normalizeHeader(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function value(row: Record<string, unknown>, header: string) {
  return cleanText(row[header]);
}

function hasBlockingIssue(row: ReviewRow) {
  return row.issues.some((issue) => blockingIssues.has(issue));
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

  try {
    const { id } = await context.params;
    const contentType = request.headers.get("content-type") || "";
    const supabase = getSupabaseAdmin();
    const ctx = await subjectContext(id);
    if (!ctx) return jsonError("Subject was not found.", 404);

    if (contentType.includes("application/json")) {
      const body = await parseJson<SaveBody>(request);
      const rows = (body?.rows || []).filter((row) => row.save && !hasBlockingIssue(row));
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
    if (file.size > 2_000_000) return jsonError("Excel file must be 2 MB or smaller.");

    const bytes = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    const workbookBytes = Buffer.from(bytes) as unknown as Parameters<typeof workbook.xlsx.load>[0];
    try {
      await workbook.xlsx.load(workbookBytes);
    } catch {
      return jsonError("Excel file could not be read. Re-save it as a valid .xlsx file and try again.", 400);
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) return jsonError("The workbook does not contain a worksheet.");
    if (sheet.actualRowCount > 2_001) return jsonError("Excel import supports up to 2,000 students at a time.");

    const headers = sheet.getRow(1).values as ExcelJS.CellValue[];
    const headerSet = new Set(headers.map(normalizeHeader).filter(Boolean));
    const missingHeaders = requiredHeaders.filter((header) => !headerSet.has(header));
    if (missingHeaders.length) {
      return jsonError(`Excel row 1 must contain these exact headers: ${requiredHeaders.join(", ")}. Optional: ${optionalHeaders.join(", ")}. Column order does not matter.`, 400);
    }

    const rows: Record<string, unknown>[] = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      const record: Record<string, unknown> = {};
      for (let column = 1; column < headers.length; column += 1) {
        const header = normalizeHeader(headers[column]);
        if (header) record[header] = row.getCell(column).text;
      }
      rows.push(record);
    });

    const seen = new Set<string>();
    const reviewRows: ReviewRow[] = rows.map((row, index) => {
      const student_number = value(row, "student number");
      const full_name = value(row, "full name");
      const contact_number = value(row, "contact number") || null;
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
      const { data: existing, error: existingError } = await supabase.from("students").select("student_number").in("student_number", existingNumbers);
      if (existingError) return jsonError(existingError.message, 500);
      const existingSet = new Set((existing || []).map((row) => row.student_number.toLowerCase()));
      reviewRows.forEach((row) => {
        if (existingSet.has(row.student_number.toLowerCase()) && !hasBlockingIssue(row)) row.issues.push(existingStudentNotice);
      });
    }

    return NextResponse.json({ rows: reviewRows });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Excel import failed.", 500);
  }
}
