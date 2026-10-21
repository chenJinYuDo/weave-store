import { ChoiceField } from "@/components/choice-field"
import {
  constructions,
  type Fabric,
  type FabricFilters,
} from "@/lib/fabrics"

function unique(fabrics: Fabric[], key: "composition" | "color" | "pattern") {
  return [...new Set(fabrics.map((item) => item[key]).filter(Boolean))]
}

function options(values: string[]) {
  return [
    { value: "all", label: "全部" },
    ...values.map((value) => ({ value, label: value })),
  ]
}

export function FabricFilters({
  fabrics,
  filters,
  onChange,
}: {
  fabrics: Fabric[]
  filters: FabricFilters
  onChange: (filters: FabricFilters) => void
}) {
  const set = (key: keyof FabricFilters, value: string) => {
    onChange({ ...filters, [key]: value === "all" ? "" : value })
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
      <ChoiceField
        label="成分"
        value={filters.composition || "all"}
        onChange={(value) => set("composition", value)}
        options={options(unique(fabrics, "composition"))}
      />
      <ChoiceField
        label="组织"
        value={filters.construction || "all"}
        onChange={(value) => set("construction", value)}
        options={options([...constructions])}
      />
      <ChoiceField
        label="门幅"
        value={filters.width || "all"}
        onChange={(value) => set("width", value)}
        options={[
          { value: "all", label: "全部" },
          { value: "narrow", label: "110 厘米及以下" },
          { value: "regular", label: "111–150 厘米" },
          { value: "wide", label: "150 厘米以上" },
        ]}
      />
      <ChoiceField
        label="克重"
        value={filters.gsm || "all"}
        onChange={(value) => set("gsm", value)}
        options={[
          { value: "all", label: "全部" },
          { value: "light", label: "150 g/m² 及以下" },
          { value: "medium", label: "151–300 g/m²" },
          { value: "heavy", label: "300 g/m² 以上" },
        ]}
      />
      <ChoiceField
        label="颜色"
        value={filters.color || "all"}
        onChange={(value) => set("color", value)}
        options={options(unique(fabrics, "color"))}
      />
      <ChoiceField
        label="花型"
        value={filters.pattern || "all"}
        onChange={(value) => set("pattern", value)}
        options={options(unique(fabrics, "pattern"))}
      />
      <ChoiceField
        label="剩余"
        value={filters.stock || "all"}
        onChange={(value) => set("stock", value)}
        options={[
          { value: "all", label: "全部" },
          { value: "in", label: "还有剩余" },
          { value: "out", label: "已用完" },
        ]}
      />
    </div>
  )
}
