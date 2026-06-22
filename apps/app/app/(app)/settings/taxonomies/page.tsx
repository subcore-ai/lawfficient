import { TaxonomySection } from "@/components/settings/taxonomies-editor"
import { getCurrentUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { groupTaxonomies, type FirmTaxonomies } from "@/lib/taxonomies/queries"

export const metadata = { title: "Settings · Case taxonomies" }

type Loaded = { taxonomies: FirmTaxonomies; canManage: boolean }

async function load(): Promise<Loaded> {
  const me = await getCurrentUser()
  const supabase = await createClient()
  // RLS scopes to the firm; include inactive rows so the editor can show + reactivate them.
  const { data, error } = await supabase.from("firm_taxonomies").select("*").order("position")
  if (error) throw error

  return {
    taxonomies: groupTaxonomies(data ?? []),
    canManage: me?.permissions?.includes("settings.manage") ?? false,
  }
}

export default async function SettingsTaxonomiesPage() {
  const { taxonomies, canManage } = await load()

  return (
    <div className="flex flex-col gap-6">
      <TaxonomySection
        category="case_type"
        title="Case types"
        description="The matters your firm handles — shown when creating or editing a lead."
        noun="Case type"
        options={taxonomies.case_type}
        canManage={canManage}
      />
      <TaxonomySection
        category="case_hierarchy"
        title="Case hierarchy"
        description="Your firm's risk / priority tiers."
        noun="Hierarchy"
        options={taxonomies.case_hierarchy}
        canManage={canManage}
      />
      <TaxonomySection
        category="qualification"
        title="Qualification"
        description="Lead qualification outcomes."
        noun="Qualification"
        options={taxonomies.qualification}
        canManage={canManage}
      />
    </div>
  )
}
