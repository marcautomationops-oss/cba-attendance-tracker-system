import { NextResponse } from "next/server";
import { cleanText, jsonError, requireTeacher } from "@/lib/api";
import { getAttendanceSummary, isDateOnly } from "@/lib/attendanceSummary";

export async function GET(request: Request) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { searchParams } = new URL(request.url);
  const sectionId = cleanText(searchParams.get("sectionId"));
  const subjectId = cleanText(searchParams.get("subjectId"));
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!sectionId || !subjectId || !isDateOnly(from) || !isDateOnly(to)) {
    return jsonError("Section, subject, start date, and end date are required.");
  }
  if (from > to) return jsonError("Start date must be before the end date.");

  try {
    return NextResponse.json(await getAttendanceSummary({ sectionId, subjectId, from, to }));
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Attendance summary could not be prepared.", 500);
  }
}
