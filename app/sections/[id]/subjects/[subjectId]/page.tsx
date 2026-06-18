import { SubjectWorkspace } from "@/components/SubjectWorkspace";
import { TeacherShell } from "@/components/TeacherShell";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; subjectId: string }>;
};

export default async function SubjectPage({ params }: Props) {
  const { id, subjectId } = await params;

  return (
    <TeacherShell>
      <Suspense fallback={<div className="rounded border border-line bg-white p-5 shadow-soft">Loading workspace</div>}>
        <SubjectWorkspace sectionId={id} subjectId={subjectId} />
      </Suspense>
    </TeacherShell>
  );
}
