import { TeacherShell } from "@/components/TeacherShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
