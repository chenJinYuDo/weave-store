import { categories, type Garment, type GarmentFilters } from "@/lib/garments"
import { ChoiceField } from "@/components/choice-field"

function unique(garments: Garment[], key: "color" | "fiber" | "owner") {
  return [...new Set(garments.map((item) => item[key]).filter(Boolean))]
}

function options(values: string[]) {
  return [
    { value: "all", label: "全部" },
    ...values.map((value) => ({ value, label: value })),
  ]
}

export function ClosetFilters({
  garments,
  filters,
  onChange,
}: {
  garments: Garment[]
  filters: GarmentFilters
  onChange: (filters: GarmentFilters) => void
}) {
  const set = (key: keyof GarmentFilters, value: string) => {
    onChange({ ...filters, [key]: value === "all" ? "" : value })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
      <ChoiceField
        label="品类"
        value={filters.category || "all"}
        onChange={(value) => set("category", value)}
        options={options([...categories])}
      />
      <ChoiceField
        label="颜色"
        value={filters.color || "all"}
        onChange={(value) => set("color", value)}
        options={options(unique(garments, "color"))}
      />
      <ChoiceField
        label="季节"
        value={filters.season || "all"}
        onChange={(value) => set("season", value)}
        options={options(["春", "夏", "秋", "冬", "四季"])}
      />
      <ChoiceField
        label="纤维"
        value={filters.fiber || "all"}
        onChange={(value) => set("fiber", value)}
        options={options(unique(garments, "fiber"))}
      />
      <ChoiceField
        label="所属成员"
        value={filters.owner || "all"}
        onChange={(value) => set("owner", value)}
        options={options(unique(garments, "owner"))}
      />
    </div>
  )
}
