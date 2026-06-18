export const AUTH_COOKIE = "lecturer_attendance_auth";

function getAccessCode() {
  return process.env.TEACHER_ACCESS_CODE || "";
}

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function teacherCookieValue() {
  const accessCode = getAccessCode();
  if (!accessCode) return "";

  const data = new TextEncoder().encode(`lecturer-attendance:${accessCode}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(digest);
}

export async function validateAccessCode(accessCode: string) {
  const expected = getAccessCode();
  return Boolean(expected) && accessCode === expected;
}
