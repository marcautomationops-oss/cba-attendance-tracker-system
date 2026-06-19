import { SectionsDashboard } from "@/components/SectionsDashboard";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { data, error } = await getSupabaseAdmin()
    .from("sections")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return <SectionsDashboard initialSections={data || []} initialError={error?.message || ""} />;
}
