import { SectionWorkspace } from "@/components/SectionWorkspace";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function SectionPage({ params }: Props) {
  const { id } = await params;
  return <SectionWorkspace sectionId={id} />;
}
