import { SettingsPanel } from "@/components/SettingsPanel";
import { TeacherShell } from "@/components/TeacherShell";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return (
    <TeacherShell>
      <SettingsPanel />
    </TeacherShell>
  );
}
