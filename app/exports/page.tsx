import { ExportCenter } from "@/components/ExportCenter";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export default async function ExportsPage() {
  const { data } = await getSupabaseAdmin()
    .from("sections")
    .select("id,name")
    .eq("is_active", true)
    .order("name");

  return <ExportCenter sections={data || []} />;
}
