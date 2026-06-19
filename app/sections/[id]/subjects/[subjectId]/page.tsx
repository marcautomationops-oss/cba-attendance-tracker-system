import { SubjectWorkspace } from "@/components/SubjectWorkspace";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string; subjectId: string }>;
};

export default async function SubjectPage({ params }: Props) {
  const { id, subjectId } = await params;
  return <SubjectWorkspace sectionId={id} subjectId={subjectId} />;
}
