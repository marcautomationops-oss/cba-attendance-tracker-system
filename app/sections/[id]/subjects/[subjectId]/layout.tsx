import { TeacherShell } from "@/components/TeacherShell";

export default function SubjectLayout({ children }: { children: React.ReactNode }) {
  return <TeacherShell>{children}</TeacherShell>;
}
