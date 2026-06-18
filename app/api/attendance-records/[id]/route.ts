import { NextResponse } from "next/server";
import type { AttendanceStatus } from "@/lib/types";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const allowedStatuses: AttendanceStatus[] = ["on_time", "late", "absent", "sick", "leave", "excused"];

type Body = {
  status?: AttendanceStatus;
  notes?: string | null;
};

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const body = await parseJson<Body>(request);
  const status = body?.status;

  if (!status || !allowedStatuses.includes(status)) {
    return jsonError("Choose a valid attendance status.");
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_records")
    .update({
      status,
      notes: body?.notes === undefined ? null : cleanText(body.notes) || null,
      manual_override: true,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ record: data });
}
