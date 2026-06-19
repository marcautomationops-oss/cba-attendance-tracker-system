import ExcelJS from "exceljs";
import { jsonError, requireTeacher } from "@/lib/api";
import { slugifySegment } from "@/lib/attendance";
import { isDateOnly } from "@/lib/attendanceSummary";
import { getSubjectLogbook } from "@/lib/subjectLogbook";
import type { AttendanceStatus } from "@/lib/types";

type Context = {
  params: Promise<{ id: string }>;
};

function statusLetter(status: AttendanceStatus) {
  if (status === "on_time") return "P";
  if (status === "late") return "L";
  if (status === "absent") return "A";
  return "E";
}

function sessionLabel(value: string) {
  return new Date(value).toLocaleString("en-US", {
    timeZone: "Asia/Manila",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!isDateOnly(from) || !isDateOnly(to)) return jsonError("Start and end dates are required.");
  if (from > to) return jsonError("Start date must be before the end date.");

  try {
    const logbook = await getSubjectLogbook(id, from, to);
    if (!logbook.sessions.length) return jsonError("No closed sessions were found in this date range.");

    const rows: (string | number | null)[][] = [
      ["ATTENDANCE LOGBOOK"],
      ["Subject", logbook.subject.name],
      ["Date range", `${from} to ${to}`],
      ["Legend", "P = Present (1) | L = Late (0.5) | A = Absent (0) | E = Excused (0)"],
      [],
      ["Student No.", "Student Name", ...logbook.sessions.map((session) => sessionLabel(session.start_time)), "Present", "Late", "Absent", "Excused", "Attendance Average"],
      ...logbook.rows.map((row) => [
        row.student_number,
        row.full_name,
        ...logbook.sessions.map((session) => statusLetter(row.statuses[session.id])),
        row.present,
        row.late,
        row.absent,
        row.excused,
        row.attendance_average
      ])
    ];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CBA Attendance Log";
    const sheet = workbook.addWorksheet("Logbook", { views: [{ state: "frozen", xSplit: 2, ySplit: 6 }] });
    sheet.addRows(rows);
    const averageColumn = 2 + logbook.sessions.length + 4;
    [18, 34, ...logbook.sessions.map(() => 16), 10, 8, 9, 10, 20].forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
    const averageColumnLetter = sheet.getColumn(averageColumn + 1).letter;
    sheet.autoFilter = { from: "A6", to: `${averageColumnLetter}${logbook.rows.length + 6}` };
    for (let index = 0; index < logbook.rows.length; index += 1) {
      sheet.getCell(index + 7, averageColumn + 1).numFmt = "0.00%";
    }
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(6).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${slugifySegment(logbook.subject.name)}-logbook-${from}-to-${to}.xlsx`;
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Logbook export failed.", 500);
  }
}
