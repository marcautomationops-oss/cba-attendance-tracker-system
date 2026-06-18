import { ATTENDANCE_BUCKET } from "@/lib/storage";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

type DeleteSummary = {
  deletedStorageFiles: number;
  deletedSessions: number;
  deletedStudents?: number;
};

function uniquePaths(paths: Array<string | null | undefined>) {
  return Array.from(new Set(paths.filter(Boolean) as string[]));
}

async function removeStorageFiles(paths: string[]) {
  if (!paths.length) return;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(ATTENDANCE_BUCKET).remove(paths);
  if (error) throw new Error(error.message);
}

async function proofPathsForSessions(sessionIds: string[]) {
  if (!sessionIds.length) return [];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("attendance_records").select("photo_path").in("session_id", sessionIds);
  if (error) throw new Error(error.message);
  return uniquePaths((data || []).map((record) => record.photo_path));
}

export async function deleteSubjectCascade(subjectId: string): Promise<DeleteSummary> {
  const supabase = getSupabaseAdmin();

  const { data: subject, error: subjectError } = await supabase.from("subjects").select("id").eq("id", subjectId).single();
  if (subjectError || !subject) throw new Error("Subject was not found.");

  const { data: sessions, error: sessionsError } = await supabase.from("attendance_sessions").select("id").eq("subject_id", subjectId);
  if (sessionsError) throw new Error(sessionsError.message);

  const sessionIds = (sessions || []).map((session) => session.id);
  const proofPaths = await proofPathsForSessions(sessionIds);
  await removeStorageFiles(proofPaths);

  if (sessionIds.length) {
    const { error: sessionDeleteError } = await supabase.from("attendance_sessions").delete().in("id", sessionIds);
    if (sessionDeleteError) throw new Error(sessionDeleteError.message);
  }

  const { error: subjectDeleteError } = await supabase.from("subjects").delete().eq("id", subjectId);
  if (subjectDeleteError) throw new Error(subjectDeleteError.message);

  return {
    deletedStorageFiles: proofPaths.length,
    deletedSessions: sessionIds.length
  };
}

export async function deleteSectionCascade(sectionId: string): Promise<DeleteSummary> {
  const supabase = getSupabaseAdmin();

  const { data: section, error: sectionError } = await supabase.from("sections").select("id,name").eq("id", sectionId).single();
  if (sectionError || !section) throw new Error("Section was not found.");

  const { data: subjects, error: subjectsError } = await supabase.from("subjects").select("id").eq("section_id", sectionId);
  if (subjectsError) throw new Error(subjectsError.message);
  const subjectIds = (subjects || []).map((subject) => subject.id);

  const { data: sectionSessions, error: sectionSessionsError } = await supabase.from("attendance_sessions").select("id").eq("section_id", sectionId);
  if (sectionSessionsError) throw new Error(sectionSessionsError.message);

  let subjectSessions: { id: string }[] = [];
  if (subjectIds.length) {
    const { data, error } = await supabase.from("attendance_sessions").select("id").in("subject_id", subjectIds);
    if (error) throw new Error(error.message);
    subjectSessions = data || [];
  }

  const sessionIds = Array.from(new Set([...(sectionSessions || []), ...subjectSessions].map((session) => session.id)));
  const proofPaths = await proofPathsForSessions(sessionIds);

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("id,profile_photo_path")
    .eq("section", section.name)
    .eq("is_active", true);
  if (studentsError) throw new Error(studentsError.message);

  const studentIds = (students || []).map((student) => student.id);
  const profilePaths = uniquePaths((students || []).map((student) => student.profile_photo_path));
  const storagePaths = uniquePaths([...proofPaths, ...profilePaths]);
  await removeStorageFiles(storagePaths);

  if (sessionIds.length) {
    const { error: sessionDeleteError } = await supabase.from("attendance_sessions").delete().in("id", sessionIds);
    if (sessionDeleteError) throw new Error(sessionDeleteError.message);
  }

  if (studentIds.length) {
    const { error: studentDeleteError } = await supabase.from("students").delete().in("id", studentIds);
    if (studentDeleteError) throw new Error(studentDeleteError.message);
  }

  const { error: sectionDeleteError } = await supabase.from("sections").delete().eq("id", sectionId);
  if (sectionDeleteError) throw new Error(sectionDeleteError.message);

  return {
    deletedStorageFiles: storagePaths.length,
    deletedSessions: sessionIds.length,
    deletedStudents: studentIds.length
  };
}
