import { TeacherShell } from "@/components/TeacherShell";

export default function ExportsLayout({ children }: { children: React.ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
