"use client";

import { Camera, CheckCircle2, Loader2, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, FormEvent } from "react";
import { displayDateTime, statusLabel } from "@/lib/attendance";
import type { AttendanceStatus } from "@/lib/types";

type PublicStudent = {
  id: string;
  student_number: string;
  full_name: string;
  section: string | null;
};

type PublicSession = {
  class_name: string;
  subject: string | null;
  section: string | null;
  session_date: string;
  start_time: string;
  cutoff_time: string;
  close_time: string;
};

type SuccessPayload = {
  student: {
    full_name: string;
    student_number: string;
  };
  submitted_at: string;
  status: AttendanceStatus;
};

function exactTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function fileToImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = String(reader.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function compressPhoto(file: File) {
  const image = await fileToImage(file);
  const maxWidth = 900;
  const maxHeight = 900;
  const scale = Math.min(1, maxWidth / image.naturalWidth, maxHeight / image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo could not be prepared.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.72;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > 620_000 && quality > 0.42) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }
  return dataUrl;
}

export function StudentAttendance({ sessionToken }: { sessionToken: string }) {
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [students, setStudents] = useState<PublicStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [photo, setPhoto] = useState("");
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<SuccessPayload | null>(null);

  const selectedStudent = useMemo(
    () => students.find((student) => student.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/attendance/${sessionToken}`, { cache: "no-store" });
      const payload = await response.json();
      setLoading(false);
      if (!response.ok) {
        setError(payload.error || "Attendance link could not be opened.");
        return;
      }
      setSession(payload.session);
      setStudents(payload.students || []);
    }

    load();
  }, [sessionToken]);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setPreparingPhoto(true);
    try {
      setPhoto(await compressPhoto(file));
    } catch {
      setError("The photo could not be prepared. Please take another photo.");
    } finally {
      setPreparingPhoto(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!selectedStudentId || !studentNumber.trim()) {
      setError("Choose your name and enter your student ID.");
      return;
    }
    if (!photo) {
      setError("Capture your photo before submitting attendance.");
      return;
    }

    setSubmitting(true);
    const response = await fetch(`/api/attendance/${sessionToken}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        student_id: selectedStudentId,
        student_number: studentNumber.trim(),
        photo_data_url: photo
      })
    });
    const payload = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      setError(payload.error || "Attendance could not be submitted.");
      return;
    }

    setSuccess(payload);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="rounded border border-line bg-white p-6 shadow-soft">
          <Loader2 className="mr-2 inline animate-spin" size={18} />
          Opening attendance
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="grid min-h-screen place-items-center px-4 py-8">
        <section className="w-full max-w-lg rounded border border-ledger bg-white p-6 text-center shadow-soft">
          <CheckCircle2 className="mx-auto text-ledger" size={54} />
          <h1 className="mt-4 font-display text-4xl font-semibold">Attendance recorded</h1>
          <div className="mt-5 grid gap-2 rounded border border-line bg-paper p-4 text-left">
            <p>
              <span className="font-semibold">Name:</span> {success.student.full_name}
            </p>
            <p>
              <span className="font-semibold">Student ID:</span> {success.student.student_number}
            </p>
            <p>
              <span className="font-semibold">Time:</span> {exactTime(success.submitted_at)}
            </p>
            <p>
              <span className="font-semibold">Status:</span> {statusLabel(success.status)}
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6">
      <section className="mx-auto w-full max-w-2xl">
        <div className="mb-4 rounded border border-line bg-white p-4 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-pool">CBA Attendance Log</p>
          <h1 className="mt-2 font-display text-4xl font-semibold">{session?.class_name || "Class attendance"}</h1>
          <p className="mt-1 text-sm font-semibold text-graphite">{session?.section || "Attendance"}</p>
          <div className="mt-4 grid gap-2 text-sm text-graphite sm:grid-cols-2">
            <p>
              <span className="font-semibold text-ink">Subject:</span> {session?.subject || "-"}
            </p>
            <p>
              <span className="font-semibold text-ink">Late after:</span> {session ? displayDateTime(session.cutoff_time) : "-"}
            </p>
            <p>
              <span className="font-semibold text-ink">Closes:</span> {session ? displayDateTime(session.close_time) : "-"}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="grid gap-4 rounded border border-line bg-white p-4 shadow-soft">
          <label className="grid gap-2 text-sm font-semibold text-graphite">
            Select your name
            <select
              value={selectedStudentId}
              onChange={(event) => {
                setSelectedStudentId(event.target.value);
              }}
              className="focus-ring rounded border border-line bg-white px-3 py-3 text-base text-ink"
            >
              <option value="">Choose from class list</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.full_name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-graphite">
            Enter student ID
            <input
              value={studentNumber}
              onChange={(event) => setStudentNumber(event.target.value)}
              className="focus-ring rounded border border-line bg-white px-3 py-3 text-base text-ink"
              placeholder="STU-001"
            />
          </label>

          {selectedStudent ? (
            <p className="rounded border border-ledger bg-green-50 px-3 py-2 text-sm font-semibold text-ledger">
              Selected: {selectedStudent.full_name}
            </p>
          ) : null}

          <div className="grid gap-3">
            <div className="grid min-h-64 place-items-center overflow-hidden rounded border border-line bg-ink sm:min-h-80">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Captured attendance preview" className="max-h-[60vh] w-full object-contain" />
              ) : (
                <div className="grid gap-3 px-6 py-10 text-center text-white">
                  <Camera className="mx-auto text-white/80" size={44} />
                  <p className="text-lg font-bold">Take a clear face photo</p>
                  <p className="text-sm font-semibold text-white/70">Your phone camera will open so you can frame the photo properly.</p>
                </div>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="user"
              onChange={choosePhoto}
              className="sr-only"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={preparingPhoto}
                className="focus-ring inline-flex items-center justify-center gap-2 rounded border border-line bg-paper px-4 py-3 font-semibold text-ink"
              >
                {preparingPhoto ? <Loader2 className="animate-spin" size={18} /> : photo ? <RefreshCw size={18} /> : <Camera size={18} />}
                {preparingPhoto ? "Preparing" : photo ? "Retake photo" : "Open camera"}
              </button>
              <button
                type="button"
                onClick={() => setPhoto("")}
                disabled={!photo || preparingPhoto}
                className="focus-ring inline-flex items-center justify-center gap-2 rounded bg-ledger px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={18} />
                Clear photo
              </button>
            </div>
          </div>

          {error ? <p className="rounded border border-signal bg-red-50 px-3 py-2 text-sm font-semibold text-signal">{error}</p> : null}

          <button
            disabled={submitting}
            className="focus-ring inline-flex items-center justify-center gap-2 rounded bg-ink px-5 py-4 text-lg font-semibold text-paper transition hover:bg-ledger disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            {submitting ? "Submitting" : "Submit attendance"}
          </button>
        </form>
      </section>
    </main>
  );
}
