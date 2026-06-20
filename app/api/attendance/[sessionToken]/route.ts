import { NextResponse } from "next/server";
import { calculateAttendanceStatus } from "@/lib/attendance";
import { cleanText, jsonError, parseJson } from "@/lib/api";
import { checkSmsAlertAfterAttendance } from "@/lib/sms";
import { consumeDurableRateLimit } from "@/lib/rateLimit";
import { ATTENDANCE_BUCKET, parseImageDataUrl, proofPhotoPath } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { clientAddress, isSameOriginRequest } from "@/lib/security";
import type { AttendanceSession, Student } from "@/lib/types";

type Context = {
  params: Promise<{ sessionToken: string }>;
};

type AttendanceBody = {
  student_id?: string;
  student_number?: string;
  photo_data_url?: string;
};

async function getSessionByToken(sessionToken: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("attendance_sessions")
    .select("*")
    .eq("session_token", sessionToken)
    .single();

  return { supabase, session: data as AttendanceSession | null, error };
}

function isClosed(session: AttendanceSession) {
  return Date.now() > new Date(session.close_time).getTime();
}

export async function GET(request: Request, context: Context) {
  const { sessionToken } = await context.params;
  let rateLimit;
  try {
    rateLimit = await consumeDurableRateLimit(`attendance-read:${clientAddress(request)}:${sessionToken}`, 120, 10 * 60 * 1000);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Attendance protection is unavailable.", 503);
  }
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attendance requests. Try again shortly." }, { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } });
  }

  const { supabase, session, error } = await getSessionByToken(sessionToken);

  if (error || !session) return jsonError("Attendance session was not found.", 404);
  if (isClosed(session)) return jsonError("Attendance is already closed.", 410);

  let students: Pick<Student, "id" | "full_name" | "section">[] = [];

  if (session.subject_id) {
    const { data: links, error: linksError } = await supabase.from("subject_students").select("student_id").eq("subject_id", session.subject_id);
    if (linksError) return jsonError(linksError.message, 500);
    if (links?.length) {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, section")
        .in(
          "id",
          links.map((link) => link.student_id)
        )
        .eq("is_active", true)
        .order("full_name");
      if (error) return jsonError(error.message, 500);
      students = data || [];
    }
  } else {
    let studentsQuery = supabase
      .from("students")
      .select("id, full_name, section")
      .eq("is_active", true)
      .order("full_name");

    if (session.section) studentsQuery = studentsQuery.eq("section", session.section);
    const { data, error: studentsError } = await studentsQuery;
    if (studentsError) return jsonError(studentsError.message, 500);
    students = data || [];
  }

  return NextResponse.json({
    session: {
      class_name: session.class_name,
      subject: session.subject,
      section: session.section,
      session_date: session.session_date,
      start_time: session.start_time,
      cutoff_time: session.cutoff_time,
      close_time: session.close_time
    },
    students
  });
}

export async function POST(request: Request, context: Context) {
  if (!isSameOriginRequest(request)) return jsonError("Cross-site request blocked.", 403);

  const { sessionToken } = await context.params;
  const body = await parseJson<AttendanceBody>(request);
  const studentId = cleanText(body?.student_id);
  const studentNumber = cleanText(body?.student_number);
  const photoDataUrl = cleanText(body?.photo_data_url);
  let rateLimit;
  try {
    rateLimit = await consumeDurableRateLimit(
      `attendance-submit:${clientAddress(request)}:${sessionToken}:${studentId || "unknown"}`,
      5,
      10 * 60 * 1000
    );
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Attendance protection is unavailable.", 503);
  }
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many attendance attempts. Try again shortly." }, { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } });
  }

  if (!studentId || !studentNumber || !photoDataUrl) {
    return jsonError("Choose your name, enter your student ID, then capture a photo.");
  }

  const photo = parseImageDataUrl(photoDataUrl);
  if (!photo || photo.bytes.length === 0) {
    return jsonError("The captured photo could not be read.");
  }

  if (photo.bytes.length > 500_000) {
    return jsonError("The photo is too large. Retake it and submit again.");
  }

  const { supabase, session, error } = await getSessionByToken(sessionToken);
  if (error || !session) return jsonError("Attendance session was not found.", 404);
  if (isClosed(session)) return jsonError("Attendance is already closed.", 410);

  let studentQuery = supabase.from("students").select("*").eq("is_active", true).eq("id", studentId).limit(1);
  if (session.section && !session.subject_id) studentQuery = studentQuery.eq("section", session.section);

  const { data: students, error: studentError } = await studentQuery;
  if (studentError) return jsonError(studentError.message, 500);

  const student = ((students || [])[0] || null) as Student | null;
  if (!student) {
    return jsonError("Student was not found in this class section.", 404);
  }

  if (student.student_number.trim().toLowerCase() !== studentNumber.trim().toLowerCase()) {
    return jsonError("Student ID does not match the selected name.", 400);
  }

  if (session.subject_id) {
    const { data: enrollment, error: enrollmentError } = await supabase
      .from("subject_students")
      .select("student_id")
      .eq("subject_id", session.subject_id)
      .eq("student_id", student.id)
      .maybeSingle();

    if (enrollmentError) return jsonError(enrollmentError.message, 500);
    if (!enrollment) return jsonError("Student is not listed for this subject.", 404);
  }

  const { data: existing, error: duplicateError } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("session_id", session.id)
    .eq("student_id", student.id)
    .maybeSingle();

  if (duplicateError) return jsonError(duplicateError.message, 500);
  if (existing) return jsonError("Attendance has already been submitted for this student.", 409);

  const submittedAt = new Date();
  const status = calculateAttendanceStatus(submittedAt, session.cutoff_time);
  const photoPath = proofPhotoPath(session.id, student.student_number, submittedAt);

  const { error: uploadError } = await supabase.storage.from(ATTENDANCE_BUCKET).upload(photoPath, photo.bytes, {
    contentType: "image/jpeg",
    upsert: false
  });

  if (uploadError) return jsonError(uploadError.message, 500);

  const { data: record, error: insertError } = await supabase
    .from("attendance_records")
    .insert({
      session_id: session.id,
      student_id: student.id,
      submitted_at: submittedAt.toISOString(),
      status,
      photo_path: photoPath
    })
    .select("*")
    .single();

  if (insertError) return jsonError(insertError.message, 500);

  await checkSmsAlertAfterAttendance({ session, student, status });

  return NextResponse.json({
    record,
    student: {
      full_name: student.full_name,
      student_number: student.student_number
    },
    submitted_at: submittedAt.toISOString(),
    status
  });
}
