import { NextResponse } from "next/server";
import { cleanText, jsonError, parseJson, requireTeacher } from "@/lib/api";
import { ATTENDANCE_BUCKET, parseImageDataUrl, profilePhotoPath, signedStorageUrl } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type Context = {
  params: Promise<{ id: string; studentId: string }>;
};

type Body = {
  student_number?: string;
  full_name?: string;
  contact_number?: string;
  profile_photo_data_url?: string;
};

async function requireSubjectStudent(subjectId: string, studentId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subject_students")
    .select("student_id")
    .eq("subject_id", subjectId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Student is not in this subject list." };
  return { ok: true, error: "" };
}

export async function PATCH(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id, studentId } = await context.params;
  const link = await requireSubjectStudent(id, studentId);
  if (!link.ok) {
    if (link.error.includes("subject_students")) return jsonError("Run the updated supabase/schema.sql to enable subject student lists.", 500);
    return jsonError(link.error, 404);
  }

  const body = await parseJson<Body>(request);
  const student_number = cleanText(body?.student_number);
  const full_name = cleanText(body?.full_name);
  const contact_number = cleanText(body?.contact_number) || null;

  if (!student_number || !full_name) {
    return jsonError("Student number and full name are required.");
  }

  const supabase = getSupabaseAdmin();
  const studentPayload: Record<string, string | null> = {
    student_number,
    full_name,
    contact_number,
    updated_at: new Date().toISOString()
  };

  const { data: student, error: updateError } = await supabase
    .from("students")
    .update(studentPayload)
    .eq("id", studentId)
    .select("*")
    .single();

  if (updateError) {
    if (updateError.message.includes("contact_number")) {
      return jsonError("Run the updated Supabase schema to enable optional contact numbers for SMS alerts.", 500);
    }
    return jsonError(updateError.message, 500);
  }

  let savedStudent = student;
  const photoDataUrl = cleanText(body?.profile_photo_data_url);
  if (photoDataUrl) {
    const image = parseImageDataUrl(photoDataUrl);
    if (!image) return jsonError("Profile photo could not be read.");
    if (image.bytes.length > 600_000) return jsonError("Profile photo is too large. Choose a smaller image.");

    const path = profilePhotoPath(savedStudent.student_number);
    const { error: uploadError } = await supabase.storage.from(ATTENDANCE_BUCKET).upload(path, image.bytes, {
      contentType: "image/jpeg",
      upsert: true
    });
    if (uploadError) return jsonError(uploadError.message, 500);

    const { data: updatedStudent, error: photoUpdateError } = await supabase
      .from("students")
      .update({ profile_photo_path: path, updated_at: new Date().toISOString() })
      .eq("id", studentId)
      .select("*")
      .single();
    if (photoUpdateError) return jsonError(photoUpdateError.message, 500);
    savedStudent = updatedStudent;
  }

  return NextResponse.json({ student: { ...savedStudent, profile_photo_url: await signedStorageUrl(savedStudent.profile_photo_path) } });
}

export async function DELETE(request: Request, context: Context) {
  if (!(await requireTeacher(request))) {
    return jsonError("Teacher login required.", 401);
  }

  const { id, studentId } = await context.params;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("subject_students").delete().eq("subject_id", id).eq("student_id", studentId);

  if (error) {
    if (error.message.includes("subject_students")) {
      return jsonError("Run the updated supabase/schema.sql to enable subject student lists.", 500);
    }
    return jsonError(error.message, 500);
  }

  return NextResponse.json({ removed: true });
}
