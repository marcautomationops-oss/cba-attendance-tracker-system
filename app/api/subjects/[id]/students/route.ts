import { NextResponse } from "next/server";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { ATTENDANCE_BUCKET, parseImageDataUrl, profilePhotoPath, signedStorageUrl } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Context = {
  params: Promise<{ id: string }>;
};

type Body = {
  student_number?: string;
  full_name?: string;
  contact_number?: string;
  profile_photo_data_url?: string;
};

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const supabase = getSupabaseAdmin();

  const { data: links, error: linksError } = await supabase
    .from("subject_students")
    .select("student_id")
    .eq("subject_id", id);

  if (linksError) {
    if (linksError.message.includes("subject_students")) {
      return NextResponse.json({ students: [] });
    }
    return jsonError(linksError.message, 500);
  }

  const studentIds = (links || []).map((link) => link.student_id);
  if (!studentIds.length) return NextResponse.json({ students: [] });

  const { data: rows, error: studentsError } = await supabase
    .from("students")
    .select("*")
    .in("id", studentIds)
    .eq("is_active", true)
    .order("full_name");

  if (studentsError) return jsonError(studentsError.message, 500);
  const students = await Promise.all(
    (rows || []).map(async (student) => ({
      ...student,
      profile_photo_url: await signedStorageUrl(student.profile_photo_path)
    }))
  );
  return NextResponse.json({ students });
}

export async function POST(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id } = await context.params;
  const body = await parseJson<Body>(request);
  const student_number = cleanText(body?.student_number);
  const full_name = cleanText(body?.full_name);
  const contact_number = cleanText(body?.contact_number) || null;

  if (!student_number || !full_name) {
    return jsonError("Student number and full name are required.");
  }

  const supabase = getSupabaseAdmin();
  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("section_id, sections(name)")
    .eq("id", id)
    .single();

  if (subjectError) return jsonError("Subject was not found.", 404);

  const subjectWithSection = subject as { sections?: { name?: string } | { name?: string }[] };
  const sectionName = Array.isArray(subjectWithSection.sections)
    ? subjectWithSection.sections[0]?.name
    : subjectWithSection.sections?.name;

  const studentPayload: Record<string, string | boolean | null> = {
    student_number,
    full_name,
    section: sectionName || null,
    is_active: true,
    updated_at: new Date().toISOString()
  };
  if (contact_number) studentPayload.contact_number = contact_number;

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

  let savedStudent = student;
  const photoDataUrl = cleanText(body?.profile_photo_data_url);
  if (photoDataUrl) {
    const image = parseImageDataUrl(photoDataUrl);
    if (!image) return jsonError("Profile photo could not be read.");
    if (image.bytes.length > 600_000) return jsonError("Profile photo is too large. Choose a smaller image.");

    const path = profilePhotoPath(student.student_number);
    const { error: uploadError } = await supabase.storage.from(ATTENDANCE_BUCKET).upload(path, image.bytes, {
      contentType: "image/jpeg",
      upsert: true
    });
    if (uploadError) return jsonError(uploadError.message, 500);

    const { data: updatedStudent, error: updateError } = await supabase
      .from("students")
      .update({ profile_photo_path: path, updated_at: new Date().toISOString() })
      .eq("id", student.id)
      .select("*")
      .single();
    if (updateError) return jsonError(updateError.message, 500);
    savedStudent = updatedStudent;
  }

  const { error: linkError } = await supabase
    .from("subject_students")
    .upsert({ subject_id: id, student_id: student.id }, { onConflict: "subject_id,student_id" });

  if (linkError) {
    if (linkError.message.includes("subject_students")) {
      return jsonError("Run the updated supabase/schema.sql to enable subject student lists.", 500);
    }
    return jsonError(linkError.message, 500);
  }
  return NextResponse.json(
    { student: { ...savedStudent, profile_photo_url: await signedStorageUrl(savedStudent.profile_photo_path) } },
    { status: 201 }
  );
}
