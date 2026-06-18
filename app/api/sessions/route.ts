import { NextResponse } from "next/server";
import { attendanceLink, generateSessionToken } from "@/lib/attendance";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type SessionBody = {
  section_id?: string;
  subject_id?: string;
  class_name?: string;
  subject?: string;
  section?: string;
  session_date?: string;
  start_time?: string;
  cutoff_time?: string;
  close_time?: string;
};

export async function GET(request: Request) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const supabase = getSupabaseAdmin();

  const { searchParams } = new URL(request.url);
  const sectionId = cleanText(searchParams.get("sectionId"));
  const subjectId = cleanText(searchParams.get("subjectId"));

  let query = supabase
    .from("attendance_sessions")
    .select("*")
    .order("session_date", { ascending: false })
    .order("start_time", { ascending: false });

  if (sectionId) query = query.eq("section_id", sectionId);
  if (subjectId) query = query.eq("subject_id", subjectId);

  const { data, error } = await query;

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ sessions: data });
}

export async function POST(request: Request) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const body = await parseJson<SessionBody>(request);
  const section_id = cleanText(body?.section_id) || null;
  const subject_id = cleanText(body?.subject_id) || null;
  let class_name = cleanText(body?.class_name);
  let subject = cleanText(body?.subject) || null;
  let section = cleanText(body?.section) || null;
  const session_date = cleanText(body?.session_date);
  const start_time = cleanText(body?.start_time);
  const cutoff_time = cleanText(body?.cutoff_time);
  const close_time = cleanText(body?.close_time);

  const supabase = getSupabaseAdmin();

  if (section_id) {
    const { data: sectionRow, error: sectionError } = await supabase.from("sections").select("name").eq("id", section_id).single();
    if (sectionError) return jsonError("Section was not found.", 404);
    section = sectionRow.name;
  }

  if (subject_id) {
    const { data: subjectRow, error: subjectError } = await supabase.from("subjects").select("name").eq("id", subject_id).single();
    if (subjectError) return jsonError("Subject was not found.", 404);
    subject = subjectRow.name;
    if (!class_name) class_name = subjectRow.name;
  }

  if (!class_name || !session_date || !start_time || !cutoff_time || !close_time) {
    return jsonError("Class name, session date, start time, late cutoff, and close time are required.");
  }

  if (new Date(close_time).getTime() < new Date(cutoff_time).getTime()) {
    return jsonError("Close time must be after the late cutoff.");
  }

  if (subject_id) {
    const { data: existing, error: existingError } = await supabase
      .from("attendance_sessions")
      .select("*")
      .eq("subject_id", subject_id)
      .gte("close_time", new Date().toISOString())
      .order("start_time", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      if (existingError.message.includes("close_time")) {
        return jsonError("Run the updated Supabase schema to enable attendance close times.", 500);
      }
      return jsonError(existingError.message, 500);
    }

    if (existing) {
      return NextResponse.json({ session: existing, attendanceLink: attendanceLink(existing.session_token) });
    }
  }

  const token = generateSessionToken();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .insert({
      session_token: token,
      section_id,
      subject_id,
      class_name,
      subject,
      section,
      session_date,
      start_time: new Date(start_time).toISOString(),
      cutoff_time: new Date(cutoff_time).toISOString(),
      close_time: new Date(close_time).toISOString()
    })
    .select("*")
    .single();

  if (error) return jsonError(error.message, 500);
  return NextResponse.json({ session: data, attendanceLink: attendanceLink(token) }, { status: 201 });
}
