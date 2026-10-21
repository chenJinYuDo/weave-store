import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { ChoiceField } from "@/components/choice-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  constructions,
  fabricFormSchema,
  toFabricInput,
  type FabricFormValues,
  type FabricInput,
} from "@/lib/fabrics"

const stretchOptions = [
  { value: "none", label: "不填" },
  { value: "无", label: "无" },
  { value: "低", label: "低" },
  { value: "中", label: "中" },
  { value: "高", label: "高" },
]

const thicknessOptions = [
  { value: "none", label: "不填" },
  { value: "薄", label: "薄" },
  { value: "中", label: "中" },
  { value: "厚", label: "厚" },
]

const opacityOptions = [
  { value: "none", label: "不填" },
  { value: "透明", label: "透明" },
  { value: "半透", label: "半透" },
  { value: "不透", label: "不透" },
]

const sheenOptions = [
  { value: "none", label: "不填" },
  { value: "哑光", label: "哑光" },
  { value: "微光", label: "微光" },
  { value: "有光", label: "有光" },
]

export function FabricForm({
  values,
  submitting,
  onSubmit,
}: {
  values: FabricFormValues
  submitting: boolean
  onSubmit: (values: FabricInput) => void
}) {
  const form = useForm<FabricFormValues>({
    resolver: zodResolver(fabricFormSchema),
    values,
  })

  return (
    <form
      className="surface mt-6 grid max-w-xl gap-5 p-5 lg:p-6"
      onSubmit={form.handleSubmit((formValues) =>
        onSubmit(toFabricInput(formValues)),
      )}
    >
      <TextField
        id="name"
        label="名称"
        register={form.register("name")}
        error={form.formState.errors.name?.message}
      />
      <TextField
        id="composition"
        label="成分"
        register={form.register("composition")}
      />
      <Controller
        control={form.control}
        name="construction"
        render={({ field }) => (
          <ChoiceField
            label="组织"
            value={field.value}
            onChange={field.onChange}
            options={constructions.map((item) => ({
              value: item,
              label: item,
            }))}
          />
        )}
      />
      <TextField
        id="width_cm"
        label="门幅（厘米）"
        register={form.register("width_cm")}
        error={form.formState.errors.width_cm?.message}
      />
      <TextField
        id="gsm"
        label="克重（g/m²）"
        register={form.register("gsm")}
        error={form.formState.errors.gsm?.message}
      />
      <TextField
        id="yarn_count"
        label="支数"
        register={form.register("yarn_count")}
      />
      <TextField id="density" label="密度" register={form.register("density")} />
      <OptionalChoice
        control={form.control}
        name="stretch"
        label="弹性"
        options={stretchOptions}
      />
      <OptionalChoice
        control={form.control}
        name="thickness"
        label="厚度"
        options={thicknessOptions}
      />
      <OptionalChoice
        control={form.control}
        name="opacity"
        label="透明度"
        options={opacityOptions}
      />
      <OptionalChoice
        control={form.control}
        name="sheen"
        label="光泽"
        options={sheenOptions}
      />
      <TextField id="pattern" label="花型" register={form.register("pattern")} />
      <TextField id="color" label="颜色" register={form.register("color")} />
      <TextField
        id="remaining_m"
        label="剩余米数"
        register={form.register("remaining_m")}
        error={form.formState.errors.remaining_m?.message}
      />
      <div>
        <Button type="submit" disabled={submitting}>
          保存
        </Button>
      </div>
    </form>
  )
}

function TextField({
  id,
  label,
  register,
  error,
}: {
  id: string
  label: string
  register: ReturnType<ReturnType<typeof useForm<FabricFormValues>>["register"]>
  error?: string
}) {
  return (
    <div className="grid gap-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...register} />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  )
}

function OptionalChoice({
  control,
  name,
  label,
  options,
}: {
  control: ReturnType<typeof useForm<FabricFormValues>>["control"]
  name: "stretch" | "thickness" | "opacity" | "sheen"
  label: string
  options: { value: string; label: string }[]
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <ChoiceField
          label={label}
          value={field.value || "none"}
          onChange={(value) => field.onChange(value === "none" ? "" : value)}
          options={options}
        />
      )}
    />
  )
}
