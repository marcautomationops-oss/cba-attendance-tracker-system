import { SectionsDashboard } from "@/components/SectionsDashboard";
import { TeacherShell } from "@/components/TeacherShell";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return (
    <TeacherShell>
      <SectionsDashboard />
    </TeacherShell>
  );
}
