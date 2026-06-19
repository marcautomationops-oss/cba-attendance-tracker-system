import ExcelJS from "exceljs";
import { jsonError, requireTeacher } from "@/lib/api";
import { displayDateTime, statusLabel } from "@/lib/attendance";
import { getSessionRecords } from "@/lib/sessionRecords";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  if (!(await requireTeacher(request))) return jsonError("Teacher login required.", 401);

  const { id } = await context.params;

  try {
    const payload = await getSessionRecords(id);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CBA Attendance Log";
    const sheet = workbook.addWorksheet("Attendance", { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.columns = [
      { header: "Student ID", key: "studentId", width: 18 },
      { header: "Student name", key: "studentName", width: 32 },
      { header: "Date", key: "date", width: 12 },
      { header: "Time submitted", key: "submittedAt", width: 24 },
      { header: "Status", key: "status", width: 12 },
      { header: "Remarks", key: "remarks", width: 36 },
      { header: "Proof", key: "proof", width: 14 }
    ];
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    payload.records.forEach((record) => {
      const proofDeleted = Boolean(record.photo_deleted_at || record.notes?.toLowerCase().includes("proof photo deleted"));
      const row = sheet.addRow({
        studentId: record.student_number,
        studentName: record.full_name,
        date: payload.session.session_date,
        submittedAt: record.submitted_at ? displayDateTime(record.submitted_at) : "",
        status: statusLabel(record.status),
        remarks: record.notes || "",
        proof: proofDeleted ? "Proof deleted" : record.photo_path ? "View proof" : "No proof"
      });
      if (!proofDeleted && record.photo_path) {
        const proofUrl = new URL("/proof", appUrl);
        proofUrl.searchParams.set("path", record.photo_path);
        row.getCell("proof").value = { text: "View proof", hyperlink: proofUrl.toString(), tooltip: `View proof for ${record.full_name}` };
      }
    });
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: "A1", to: `G${Math.max(1, payload.records.length + 1)}` };
    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="attendance-${payload.session.session_date}.xlsx"`
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Excel export failed.", 500);
  }
}
