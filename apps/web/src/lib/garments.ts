import { z } from "zod"

import { ApiError, request } from "@/lib/api"

export { ApiError }

export const categories = [
  "上衣",
  "下装",
  "半裙",
  "连衣裙",
  "外套",
  "鞋",
  "配饰",
] as const

export const seasons = ["", "春", "夏", "秋", "冬", "四季"] as const

export const garmentSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(40),
  category: z.enum(categories, "请选择品类"),
  color: z.string().trim().max(20),
  pattern: z.string().trim().max(20),
  season: z.enum(seasons),
  fiber: z.string().trim().max(40),
  owner: z.string().trim().max(20),
})

export type GarmentInput = z.infer<typeof garmentSchema>

export type Garment = GarmentInput & {
  id: string
  image: string
  created_at: string
  updated_at: string
}

export type CaptureDraft = {
  id: string
  cutout_url: string
  message: string
  draft: GarmentInput
}

export type GarmentFilters = {
  category: string
  color: string
  season: string
  fiber: string
  owner: string
}

export const emptyGarment: GarmentInput = {
  name: "",
  category: "上衣",
  color: "",
  pattern: "",
  season: "",
  fiber: "",
  owner: "",
}

export const emptyFilters: GarmentFilters = {
  category: "",
  color: "",
  season: "",
  fiber: "",
  owner: "",
}

function query(filters: GarmentFilters) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value)
    }
  }
  const search = params.toString()
  return search ? `?${search}` : ""
}

export function listGarments(filters: GarmentFilters) {
  return request<Garment[]>(`/api/garments${query(filters)}`)
}

export function getGarment(id: string) {
  return request<Garment>(`/api/garments/${id}`)
}

export function createGarment(input: GarmentInput, captureId = "") {
  return request<Garment>("/api/garments", {
    method: "POST",
    body: JSON.stringify({ ...input, capture_id: captureId }),
  })
}

export async function createCapture(photo: File, label: File | null) {
  const body = new FormData()
  body.append("photo", photo)
  if (label) {
    body.append("label", label)
  }
  const response = await fetch("/api/captures", { method: "POST", body })
  if (!response.ok) {
    throw new ApiError(response.status)
  }
  return response.json() as Promise<CaptureDraft>
}

export function updateGarment(id: string, input: GarmentInput) {
  return request<Garment>(`/api/garments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteGarment(id: string) {
  return request<void>(`/api/garments/${id}`, { method: "DELETE" })
}
