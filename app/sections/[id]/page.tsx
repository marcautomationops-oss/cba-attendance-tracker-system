import { SectionWorkspace } from "@/components/SectionWorkspace";
import { TeacherShell } from "@/components/TeacherShell";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SectionPage({ params }: Props) {
  const { id } = await params;

  return (
    <TeacherShell>
      <SectionWorkspace sectionId={id} />
    </TeacherShell>
  );
}
