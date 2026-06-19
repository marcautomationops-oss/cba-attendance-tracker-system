import * as XLSX from "xlsx";
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
    const rows = payload.records.map((record) => ({
      "Student ID": record.student_number,
      "Student name": record.full_name,
      Date: payload.session.session_date,
      "Time submitted": record.submitted_at ? displayDateTime(record.submitted_at) : "",
      Status: statusLabel(record.status),
      Remarks: record.notes || "",
      Proof: record.photo_deleted_at || record.notes?.toLowerCase().includes("proof photo deleted") ? "Proof deleted" : record.photo_url ? "View proof" : "No proof"
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    payload.records.forEach((record, index) => {
      if (!record.photo_url || record.photo_deleted_at || record.notes?.toLowerCase().includes("proof photo deleted")) return;
      const proofCell = sheet[`G${index + 2}`];
      if (proofCell) proofCell.l = { Target: record.photo_url, Tooltip: `View proof for ${record.full_name}` };
    });
    sheet["!cols"] = [{ wch: 18 }, { wch: 32 }, { wch: 12 }, { wch: 24 }, { wch: 12 }, { wch: 36 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

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
