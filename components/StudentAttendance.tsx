"use client";

import { Camera, CheckCircle2, Loader2, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
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

export function StudentAttendance({ sessionToken }: { sessionToken: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [session, setSession] = useState<PublicSession | null>(null);
  const [students, setStudents] = useState<PublicStudent[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [studentNumber, setStudentNumber] = useState("");
  const [photo, setPhoto] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
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
    return () => stopCamera();
  }, [sessionToken]);

  async function startCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setError("Camera permission is required before submitting attendance.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  function capturePhoto() {
    const video = videoRef.current;
    if (!video) return;

    const maxWidth = 640;
    const maxHeight = 480;
    const scale = Math.min(1, maxWidth / video.videoWidth, maxHeight / video.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);

    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    setPhoto(canvas.toDataURL("image/jpeg", 0.5));
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

    stopCamera();
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
            <div className="aspect-[4/3] overflow-hidden rounded border border-line bg-ink">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="Captured attendance preview" className="h-full w-full object-cover" />
              ) : (
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={photo ? () => setPhoto("") : startCamera}
                className="focus-ring inline-flex items-center justify-center gap-2 rounded border border-line bg-paper px-4 py-3 font-semibold text-ink"
              >
                {photo ? <RefreshCw size={18} /> : <Camera size={18} />}
                {photo ? "Retake" : cameraReady ? "Camera ready" : "Start camera"}
              </button>
              <button
                type="button"
                onClick={capturePhoto}
                disabled={!cameraReady || Boolean(photo)}
                className="focus-ring inline-flex items-center justify-center gap-2 rounded bg-ledger px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Camera size={18} />
                Capture
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
