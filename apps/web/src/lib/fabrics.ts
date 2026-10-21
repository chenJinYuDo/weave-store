import { z } from "zod"

import { ApiError, request } from "@/lib/api"

export const constructions = ["梭织", "针织", "蕾丝", "无纺"] as const
export const stretches = ["", "无", "低", "中", "高"] as const
export const thicknesses = ["", "薄", "中", "厚"] as const
export const opacities = ["", "透明", "半透", "不透"] as const
export const sheens = ["", "哑光", "微光", "有光"] as const

const optionalDecimal = (maximum: number, message: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^\d+(\.\d)?$/.test(value) &&
          Number(value) > 0 &&
          Number(value) <= maximum),
      message,
    )

export const fabricFormSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(40),
  composition: z.string().trim().max(80),
  construction: z.enum(constructions, "请选择组织"),
  width_cm: optionalDecimal(500, "门幅不正确"),
  gsm: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === "" ||
        (/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 2000),
      "克重不正确",
    ),
  yarn_count: z.string().trim().max(40),
  density: z.string().trim().max(40),
  stretch: z.enum(stretches),
  thickness: z.enum(thicknesses),
  opacity: z.enum(opacities),
  sheen: z.enum(sheens),
  pattern: z.string().trim().max(20),
  color: z.string().trim().max(20),
  remaining_m: z
    .string()
    .trim()
    .min(1, "请填写剩余米数")
    .refine(
      (value) => /^\d+(\.\d)?$/.test(value) && Number(value) <= 10000,
      "剩余米数不正确",
    ),
})

export type FabricFormValues = z.infer<typeof fabricFormSchema>

export type FabricInput = {
  name: string
  composition: string
  construction: (typeof constructions)[number]
  width_cm: number | null
  gsm: number | null
  yarn_count: string
  density: string
  stretch: (typeof stretches)[number]
  thickness: (typeof thicknesses)[number]
  opacity: (typeof opacities)[number]
  sheen: (typeof sheens)[number]
  pattern: string
  color: string
  remaining_m: number
}

export type Fabric = FabricInput & {
  id: string
  image: string
  created_at: string
  updated_at: string
}

export type FabricCapture = {
  id: string
  message: string
  draft: {
    composition: string
    construction: string
    width_cm: number | null
    gsm: number | null
    yarn_count: string
    density: string
    opacity: string
    sheen: string
    pattern: string
    color: string
  }
}

export type FabricFilters = {
  composition: string
  construction: string
  color: string
  pattern: string
  width: string
  gsm: string
  stock: string
}

export const emptyFabricForm: FabricFormValues = {
  name: "",
  composition: "",
  construction: "梭织",
  width_cm: "",
  gsm: "",
  yarn_count: "",
  density: "",
  stretch: "",
  thickness: "",
  opacity: "",
  sheen: "",
  pattern: "",
  color: "",
  remaining_m: "",
}

export const emptyFabricFilters: FabricFilters = {
  composition: "",
  construction: "",
  color: "",
  pattern: "",
  width: "",
  gsm: "",
  stock: "",
}

export function toFabricForm(fabric: Fabric): FabricFormValues {
  return {
    name: fabric.name,
    composition: fabric.composition,
    construction: fabric.construction,
    width_cm: fabric.width_cm == null ? "" : String(fabric.width_cm),
    gsm: fabric.gsm == null ? "" : String(fabric.gsm),
    yarn_count: fabric.yarn_count,
    density: fabric.density,
    stretch: fabric.stretch,
    thickness: fabric.thickness,
    opacity: fabric.opacity,
    sheen: fabric.sheen,
    pattern: fabric.pattern,
    color: fabric.color,
    remaining_m: fabric.remaining_m.toFixed(1),
  }
}

export function toFabricInput(values: FabricFormValues): FabricInput {
  return {
    ...values,
    width_cm: values.width_cm === "" ? null : Number(values.width_cm),
    gsm: values.gsm === "" ? null : Number(values.gsm),
    remaining_m: Number(values.remaining_m),
  }
}

export function formatMeters(value: number) {
  return `${value.toFixed(1)} 米`
}

export function formatWidth(value: number) {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return `${text} 厘米`
}

export function formatGsm(value: number) {
  return `${value} g/m²`
}

export function fabricSummary(fabric: Pick<Fabric, "composition" | "width_cm" | "gsm">) {
  return [
    fabric.composition,
    fabric.width_cm == null ? "" : formatWidth(fabric.width_cm),
    fabric.gsm == null ? "" : formatGsm(fabric.gsm),
  ]
    .filter(Boolean)
    .join(" · ")
}

function query(filters: FabricFilters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value)
    }
  }
  const search = params.toString()
  return search ? `?${search}` : ""
}

export function listFabrics(filters: FabricFilters) {
  return request<Fabric[]>(`/api/fabrics${query(filters)}`)
}

export function getFabric(id: string) {
  return request<Fabric>(`/api/fabrics/${id}`)
}

export function createFabric(input: FabricInput, captureId = "") {
  return request<Fabric>("/api/fabrics", {
    method: "POST",
    body: JSON.stringify({ ...input, capture_id: captureId }),
  })
}

export async function createFabricCapture(face: File, spec: File | null) {
  const body = new FormData()
  body.append("face", face)
  if (spec) {
    body.append("spec", spec)
  }
  const response = await fetch("/api/fabric-captures", { method: "POST", body })
  if (!response.ok) {
    throw new ApiError(response.status)
  }
  return response.json() as Promise<FabricCapture>
}

export function updateFabric(id: string, input: FabricInput) {
  return request<Fabric>(`/api/fabrics/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteFabric(id: string) {
  return request<void>(`/api/fabrics/${id}`, { method: "DELETE" })
}
