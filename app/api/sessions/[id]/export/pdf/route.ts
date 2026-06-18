import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { CellHookData } from "jspdf-autotable";
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
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const generatedAt = new Date().toLocaleString();

    doc.setTextColor("#0b1f3a");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("CBA Attendance Log", 40, 46);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Subject: ${payload.session.subject || payload.session.class_name}`, 40, 76);
    doc.text(`Section: ${payload.session.section || "-"}`, 40, 96);
    doc.text(`Date: ${payload.session.session_date}`, 40, 116);
    doc.text(`Start time: ${displayDateTime(payload.session.start_time)}`, 300, 76);
    doc.text(`Late after: ${displayDateTime(payload.session.cutoff_time)}`, 300, 96);
    doc.text(`Closes: ${displayDateTime(payload.session.close_time)}`, 300, 116);
    doc.text(`Generated: ${generatedAt}`, 300, 136);

    doc.setFont("helvetica", "bold");
    doc.text(
      `On time: ${payload.counts.on_time}    Late: ${payload.counts.late}    Absent: ${payload.counts.absent}    Excused: ${
        payload.counts.excused + payload.counts.sick + payload.counts.leave
      }`,
      40,
      166
    );

    const proofLinks = payload.records.map((record) => record.photo_url || "");

    autoTable(doc, {
      startY: 192,
      head: [["Student ID", "Student name", "Time submitted", "Status", "Remarks", "Proof link"]],
      body: payload.records.map((record) => [
        record.student_number,
        record.full_name,
        record.submitted_at ? displayDateTime(record.submitted_at) : "",
        statusLabel(record.status),
        record.notes || "",
        record.photo_deleted_at || record.notes?.toLowerCase().includes("proof photo deleted") ? "Proof deleted" : record.photo_url ? "View proof" : "No proof"
      ]),
      styles: { fontSize: 8, cellPadding: 5, overflow: "linebreak" },
      headStyles: { fillColor: "#102a56", textColor: "#ffffff" },
      alternateRowStyles: { fillColor: "#f8fafc" },
      columnStyles: {
        5: { cellWidth: 70, textColor: "#1d4ed8" }
      },
      didDrawCell: (data: CellHookData) => {
        if (data.section !== "body" || data.column.index !== 5) return;
        const link = proofLinks[data.row.index];
        if (!link) return;
        doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url: link });
      }
    });

    const buffer = Buffer.from(doc.output("arraybuffer"));
    return new Response(buffer, {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="attendance-${payload.session.session_date}.pdf"`
      }
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "PDF export failed.", 500);
  }
}
