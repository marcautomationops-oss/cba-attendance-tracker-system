import { NextResponse } from "next/server";
import { jsonError, parseJson, requireTeacher } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ATTENDANCE_BUCKET, parseImageDataUrl, profilePhotoPath, signedStorageUrl } from "@/lib/storage";

type Context = {
  params: Promise<{ id: string }>;
};

type PhotoInput = {
  filename: string;
  data_url?: string;
};

type Body = {
  action?: "review" | "save";
  photos?: PhotoInput[];
  matched?: { student_id: string; student_number: string; filename: string; data_url: string }[];
};

function filenameId(filename: string) {
  return filename.replace(/\.[^.]+$/, "").trim().toLowerCase();
}

async function subjectStudents(subjectId: string) {
  const supabase = getSupabaseAdmin();
  const { data: links, error: linksError } = await supabase.from("subject_students").select("student_id").eq("subject_id", subjectId);
  if (linksError) throw new Error(linksError.message);
  if (!links?.length) return [];
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .in(
      "id",
      links.map((link) => link.student_id)
    )
    .order("full_name");
  if (error) throw new Error(error.message);
  return data || [];
}

export async function POST(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;
  const body = await parseJson<Body>(request);
  if (!body) return jsonError("Photo payload is required.");

  const supabase = getSupabaseAdmin();

  try {
    const students = await subjectStudents(id);
    const byNumber = new Map(students.map((student) => [String(student.student_number).toLowerCase(), student]));

    if (body.action === "save") {
      const matched = body.matched || [];
      const saved = [];

      for (const item of matched) {
        const image = parseImageDataUrl(item.data_url);
        if (!image) continue;
        const path = profilePhotoPath(item.student_number);
        const { error: uploadError } = await supabase.storage.from(ATTENDANCE_BUCKET).upload(path, image.bytes, {
          contentType: "image/jpeg",
          upsert: true
        });
        if (uploadError) return jsonError(uploadError.message, 500);
        const { data: student, error: updateError } = await supabase
          .from("students")
          .update({ profile_photo_path: path, updated_at: new Date().toISOString() })
          .eq("id", item.student_id)
          .select("*")
          .single();
        if (updateError) return jsonError(updateError.message, 500);
        saved.push({ ...student, profile_photo_url: await signedStorageUrl(path) });
      }

      return NextResponse.json({ saved });
    }

    const photos = body.photos || [];
    const matched = [];
    const unmatched = [];
    const matchedStudentIds = new Set<string>();

    for (const photo of photos) {
      const student = byNumber.get(filenameId(photo.filename));
      if (student && photo.data_url) {
        matchedStudentIds.add(student.id);
        matched.push({
          student_id: student.id,
          student_number: student.student_number,
          full_name: student.full_name,
          filename: photo.filename,
          data_url: photo.data_url
        });
      } else {
        unmatched.push({ filename: photo.filename });
      }
    }

    const missing = students
      .filter((student) => !student.profile_photo_path && !matchedStudentIds.has(student.id))
      .map((student) => ({
        student_id: student.id,
        student_number: student.student_number,
        full_name: student.full_name
      }));

    return NextResponse.json({ matched, unmatched, missing });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Photos could not be processed.", 500);
  }
}
