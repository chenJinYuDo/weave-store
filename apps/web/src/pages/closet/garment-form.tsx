import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  categories,
  garmentSchema,
  type GarmentInput,
} from "@/lib/garments"
import { ChoiceField } from "@/components/choice-field"

const seasonOptions = [
  { value: "none", label: "不填" },
  { value: "春", label: "春" },
  { value: "夏", label: "夏" },
  { value: "秋", label: "秋" },
  { value: "冬", label: "冬" },
  { value: "四季", label: "四季" },
]

export function GarmentForm({
  values,
  submitting,
  onSubmit,
}: {
  values: GarmentInput
  submitting: boolean
  onSubmit: (values: GarmentInput) => void
}) {
  const form = useForm<GarmentInput>({
    resolver: zodResolver(garmentSchema),
    values,
  })

  return (
    <form
      className="surface mt-6 grid max-w-xl gap-5 p-5 lg:p-6"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-1">
        <Label htmlFor="name">名称</Label>
        <Input id="name" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-sm text-destructive">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>
      <Controller
        control={form.control}
        name="category"
        render={({ field }) => (
          <ChoiceField
            label="品类"
            value={field.value}
            onChange={field.onChange}
            options={categories.map((item) => ({ value: item, label: item }))}
          />
        )}
      />
      <div className="grid gap-1">
        <Label htmlFor="color">颜色</Label>
        <Input id="color" {...form.register("color")} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="pattern">图案</Label>
        <Input id="pattern" {...form.register("pattern")} />
      </div>
      <Controller
        control={form.control}
        name="season"
        render={({ field }) => (
          <ChoiceField
            label="季节"
            value={field.value || "none"}
            onChange={(value) => field.onChange(value === "none" ? "" : value)}
            options={seasonOptions}
          />
        )}
      />
      <div className="grid gap-1">
        <Label htmlFor="fiber">纤维</Label>
        <Input id="fiber" {...form.register("fiber")} />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="owner">所属成员</Label>
        <Input id="owner" {...form.register("owner")} />
      </div>
      <div>
        <Button type="submit" disabled={submitting}>
          保存
        </Button>
      </div>
    </form>
  )
}
