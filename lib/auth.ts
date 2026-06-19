export const AUTH_COOKIE = "lecturer_attendance_auth";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

type SessionPayload = {
  version: 1;
  expiresAt: number;
  nonce: string;
};

const encoder = new TextEncoder();

function getAccessCode() {
  return process.env.TEACHER_ACCESS_CODE || "";
}

function getAuthSecret() {
  const configured = process.env.AUTH_SECRET || "";
  if (configured) return configured;

  // Keep local development usable while requiring a separate secret in production.
  return process.env.NODE_ENV === "production" ? "" : getAccessCode();
}

function getSessionSigningKey() {
  const accessCode = getAccessCode();
  const authSecret = getAuthSecret();
  return accessCode && authSecret ? `${authSecret}:${accessCode}` : "";
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function secureEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function createTeacherSession() {
  const signingKey = getSessionSigningKey();
  if (!signingKey) return "";

  const payload: SessionPayload = {
    version: 1,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
    nonce: crypto.randomUUID()
  };
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = encodeBase64Url(await hmac(encodedPayload, signingKey));
  return `${encodedPayload}.${signature}`;
}

export async function validateTeacherSession(session: string | undefined | null) {
  const signingKey = getSessionSigningKey();
  if (!session || !signingKey) return false;

  const [encodedPayload, encodedSignature, extra] = session.split(".");
  if (!encodedPayload || !encodedSignature || extra) return false;

  try {
    const providedSignature = decodeBase64Url(encodedSignature);
    const expectedSignature = await hmac(encodedPayload, signingKey);
    if (!secureEqual(providedSignature, expectedSignature)) return false;

    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(encodedPayload))) as Partial<SessionPayload>;
    return (
      payload.version === 1 &&
      typeof payload.expiresAt === "number" &&
      payload.expiresAt > Math.floor(Date.now() / 1000) &&
      typeof payload.nonce === "string" &&
      payload.nonce.length >= 16
    );
  } catch {
    return false;
  }
}

export async function validateAccessCode(accessCode: string) {
  const expected = getAccessCode();
  if (!expected || !accessCode) return false;
  return secureEqual(await sha256(accessCode), await sha256(expected));
}
