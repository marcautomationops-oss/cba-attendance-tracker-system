import ExcelJS from "exceljs";
import { cleanText, jsonError, requireTeacher } from "@/lib/api";
import { slugifySegment } from "@/lib/attendance";
import { getAttendanceSummary, isDateOnly } from "@/lib/attendanceSummary";

function displayDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function GET(request: Request) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { searchParams } = new URL(request.url);
  const sectionId = cleanText(searchParams.get("sectionId"));
  const subjectId = cleanText(searchParams.get("subjectId"));
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!sectionId || !subjectId || !isDateOnly(from) || !isDateOnly(to)) {
    return jsonError("Section, subject, start date, and end date are required.");
  }
  if (from > to) return jsonError("Start date must be before the end date.");

  try {
    const summary = await getAttendanceSummary({ sectionId, subjectId, from, to });
    if (!summary.closed_sessions) return jsonError("No closed sessions were found in the selected date range.");
    if (!summary.students) return jsonError("No active students were found in the selected subject.");

    const rows: (string | number | null)[][] = [
      ["ATTENDANCE SUMMARY"],
      ["Section", summary.section.name, "Subject", summary.subject.name],
      ["Date range", `${displayDate(summary.from)} to ${displayDate(summary.to)}`, "Closed sessions", summary.closed_sessions],
      ["Rules", "Present = 1 | Late = 0.5 | Absent = 0 | Excused = 0 and marked E"],
      [],
      ["Student No.", "Student Name", "Present", "Late", "Absent", "Excused", "Closed Sessions", "Attendance Average"],
      ...summary.rows.map((row) => [
        row.student_number,
        row.full_name,
        row.present,
        row.late,
        row.absent,
        row.excused,
        row.closed_sessions,
        row.attendance_average
      ])
    ];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CBA Attendance Log";
    const sheet = workbook.addWorksheet("Attendance Summary", { views: [{ state: "frozen", xSplit: 2, ySplit: 6 }] });
    sheet.addRows(rows);
    [18, 34, 11, 9, 10, 11, 17, 20].forEach((width, index) => {
      sheet.getColumn(index + 1).width = width;
    });
    sheet.autoFilter = { from: "A6", to: `H${summary.rows.length + 6}` };
    for (let index = 0; index < summary.rows.length; index += 1) {
      sheet.getCell(index + 7, 8).numFmt = "0.00%";
    }
    sheet.getRow(1).font = { bold: true, size: 14 };
    sheet.getRow(6).font = { bold: true };

    const sessionSheet = workbook.addWorksheet("Included Sessions");
    sessionSheet.addRows([
      ["Session", "Date"],
      ...summary.session_dates.map((date, index) => [index + 1, displayDate(date)])
    ]);
    sessionSheet.getColumn(1).width = 12;
    sessionSheet.getColumn(2).width = 18;
    sessionSheet.getRow(1).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `${slugifySegment(summary.section.name)}-${slugifySegment(summary.subject.name)}-attendance-${from}-to-${to}.xlsx`;

    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Excel export failed.", 500);
  }
}
