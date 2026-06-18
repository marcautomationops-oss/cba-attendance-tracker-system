# CBA Attendance Log

Production-ready QR attendance for one lecturer, built around:

```text
Login -> Sections -> Subjects -> Subject workspace
```

The app uses a private teacher access code, Supabase Postgres, Supabase Storage, tokenized QR attendance links, live camera proof capture, Excel import, PDF/Excel export, and optional Semaphore SMS alerts.

## Teacher Workflow

- `/login` - teacher access code login
- `/dashboard` - section cards
- `/sections/[id]` - subject cards for one section
- `/sections/[id]/subjects/[subjectId]` - subject workspace
- `/settings` - minimal global settings

The subject workspace contains:

- Current attendance
- History
- Analytics
- Alerts

Old teacher-facing `/sessions/[id]`, `/sessions/new`, and global `/students` screens are not part of the product flow.

## Environment Variables

Create `.env.local`:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
TEACHER_ACCESS_CODE=
SEMAPHORE_API_KEY=
SEMAPHORE_SENDER_NAME=
```

`SUPABASE_SECRET_KEY` is server-only. Do not expose it in client code.

Semaphore credentials are stored in environment variables.

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Create a private Storage bucket named `attendance-photos`.
5. Add these folders through normal uploads or let the app create paths:
   - `profile-photos/`
   - `attendance-proofs/`
6. Copy Supabase credentials into `.env.local`.
7. Set `TEACHER_ACCESS_CODE`.

## Storage Paths

```text
profile-photos/{student_id}.jpg
attendance-proofs/{session_id}/{student_id}-{timestamp}.jpg
```

Profile photos are uploaded by the teacher. Attendance proof photos are captured live by the student during QR attendance.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/login`.

## Deploy To Vercel

1. Push the repo to GitHub.
2. Import the repo in Vercel.
3. Add:
   - `NEXT_PUBLIC_APP_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `TEACHER_ACCESS_CODE`
   - `SEMAPHORE_API_KEY`
   - `SEMAPHORE_SENDER_NAME`
4. Set `NEXT_PUBLIC_APP_URL` to the final Vercel URL.
5. Deploy after `npm run build` passes locally.

## Production Checks

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Manual smoke test:

- Login works even before client JavaScript hydrates.
- Add section and subject.
- Add student manually with optional profile photo.
- Import `.xlsx`, review extracted rows, then save.
- Upload profile photos and review matched/unmatched/missing groups.
- Start attendance and confirm QR/link appears.
- Student scans QR, captures proof photo, submits attendance.
- Confirmation shows status and exact time.
- Live records update.
- Clicking a status badge saves a correction.
- History opens session records inside the subject workspace.
- Export Excel and PDF from the selected history session.
- Analytics and Alerts tabs load.
- Settings save.

## Notes

- Camera capture requires HTTPS in production. It works on `localhost` during development.
- Student attendance pages are public but require the hard-to-guess session token.
- Attendance proof photos are compressed to low-size JPEG before upload.
- Proof-photo cleanup keeps attendance records and marks deleted proof photos after retention.
- CSV export and PDF import are intentionally not included.
