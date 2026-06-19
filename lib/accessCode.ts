import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const ITERATIONS = 210_000;
const encoder = new TextEncoder();

function encode(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function decode(value: string) {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function secureEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function derive(code: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(code), "PBKDF2", false, ["deriveBits"]);
  const saltBuffer = new Uint8Array(salt).buffer;
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBuffer, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashAccessCode(code: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(code, salt, ITERATIONS);
  return `pbkdf2_sha256$${ITERATIONS}$${encode(salt)}$${encode(hash)}`;
}

async function verifyHash(code: string, stored: string) {
  const [algorithm, iterationText, saltText, hashText, extra] = stored.split("$");
  const iterations = Number(iterationText);
  if (algorithm !== "pbkdf2_sha256" || extra || !Number.isInteger(iterations) || iterations < 100_000) return false;

  try {
    return secureEqual(await derive(code, decode(saltText), iterations), decode(hashText));
  } catch {
    return false;
  }
}

export async function validateAccessCode(code: string) {
  if (!code || code.length > 128) return false;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("app_settings").select("access_code_hash").eq("id", 1).maybeSingle();
  if (error) throw new Error("Apply the latest Supabase schema before logging in.");

  if (data?.access_code_hash) return verifyHash(code, data.access_code_hash);
  const configured = process.env.TEACHER_ACCESS_CODE || "";
  if (!configured) return false;
  const left = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(code)));
  const right = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(configured)));
  return secureEqual(left, right);
}

export async function changeAccessCode(currentCode: string, newCode: string) {
  if (!(await validateAccessCode(currentCode))) throw new Error("Current access code is incorrect.");
  if (newCode.length < 8 || newCode.length > 128) throw new Error("New access code must contain 8 to 128 characters.");
  if (newCode === currentCode) throw new Error("New access code must be different from the current code.");

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("app_settings")
    .update({ access_code_hash: await hashAccessCode(newCode), updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) throw new Error(error.message);
}
