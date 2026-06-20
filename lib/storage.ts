import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const ATTENDANCE_BUCKET = "attendance-photos";

export function parseImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
  if (!match) return null;

  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  return {
    mimeType,
    extension: mimeType.split("/")[1].replace("jpeg", "jpg"),
    bytes: Buffer.from(match[2], "base64")
  };
}

export async function signedStorageUrl(path: string | null, expiresIn = 60 * 10) {
  if (!path) return null;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(ATTENDANCE_BUCKET).createSignedUrl(path, expiresIn);
    if (error) return null;
    return data?.signedUrl || null;
  } catch {
    return null;
  }
}

export function profilePhotoPath(studentNumber: string) {
  return `profile-photos/${studentNumber}.jpg`;
}

export function proofPhotoPath(sessionId: string, studentNumber: string, submittedAt: Date) {
  return `attendance-proofs/${sessionId}/${studentNumber}-${submittedAt.getTime()}.jpg`;
}
