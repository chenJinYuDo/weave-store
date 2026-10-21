import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  memberFormSchema,
  toMemberInput,
  type MemberFormValues,
  type MemberInput,
} from "@/lib/members"

export function MemberForm({
  values,
  submitting,
  onSubmit,
}: {
  values: MemberFormValues
  submitting: boolean
  onSubmit: (values: MemberInput) => void
}) {
  const form = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    values,
  })

  return (
    <form
      className="surface mt-6 grid max-w-xl gap-5 p-5 lg:p-6"
      onSubmit={form.handleSubmit((formValues) =>
        onSubmit(toMemberInput(formValues)),
      )}
    >
      <div className="grid gap-1">
        <Label htmlFor="member-name">姓名</Label>
        <Input id="member-name" {...form.register("name")} />
        {form.formState.errors.name ? (
          <p className="text-[13px] text-destructive">
            {form.formState.errors.name.message}
          </p>
        ) : null}
      </div>
      <div className="grid gap-1">
        <Label htmlFor="member-height">身高（厘米）</Label>
        <Input
          id="member-height"
          inputMode="numeric"
          {...form.register("height_cm")}
        />
        {form.formState.errors.height_cm ? (
          <p className="text-[13px] text-destructive">
            {form.formState.errors.height_cm.message}
          </p>
        ) : null}
      </div>
      <GirthField
        control={form.control}
        name="chest_cm"
        label="胸围"
        error={form.formState.errors.chest_cm?.message}
      />
      <GirthField
        control={form.control}
        name="waist_cm"
        label="腰围"
        error={form.formState.errors.waist_cm?.message}
      />
      <GirthField
        control={form.control}
        name="hip_cm"
        label="臀围"
        error={form.formState.errors.hip_cm?.message}
      />
      <div>
        <Button type="submit" disabled={submitting}>
          保存
        </Button>
      </div>
    </form>
  )
}

function GirthField({
  control,
  name,
  label,
  error,
}: {
  control: ReturnType<typeof useForm<MemberFormValues>>["control"]
  name: "chest_cm" | "waist_cm" | "hip_cm"
  label: string
  error?: string
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor={name}>{label}</Label>
            <span className="text-[13px] text-muted-foreground">
              {field.value === "" ? "不填" : `${field.value} 厘米`}
            </span>
          </div>
          <input
            id={name}
            type="range"
            min={40}
            max={160}
            value={field.value === "" ? 40 : field.value}
            onChange={(event) => field.onChange(event.target.value)}
            className="h-11 w-full cursor-pointer accent-[#1d1d1f]"
          />
          {field.value !== "" ? (
            <button
              type="button"
              className="justify-self-start text-[13px] text-muted-foreground"
              onClick={() => field.onChange("")}
            >
              不填
            </button>
          ) : null}
          {error ? <p className="text-[13px] text-destructive">{error}</p> : null}
        </div>
      )}
    />
  )
}
