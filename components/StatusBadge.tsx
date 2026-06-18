import type { AttendanceStatus } from "@/lib/types";
import { statusLabel } from "@/lib/attendance";

export function StatusBadge({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`inline-flex items-center rounded border px-2.5 py-1 text-xs font-semibold status-${status}`}>
      {statusLabel(status)}
    </span>
  );
}
