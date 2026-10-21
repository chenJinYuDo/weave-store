import { request } from "@/lib/api"

export type OutfitItem = {
  slot: string
  garment_id: string
}

export type Outfit = {
  member_id: string
  items: OutfitItem[]
  display_url: string
  message: string
  height_cm: number
}

export function getOutfit(memberId: string) {
  const search = memberId ? `?member_id=${encodeURIComponent(memberId)}` : ""
  return request<Outfit>(`/api/outfits${search}`)
}

export function putOutfit(outfit: { member_id: string; items: OutfitItem[] }) {
  return request<Outfit>("/api/outfits", {
    method: "PUT",
    body: JSON.stringify(outfit),
  })
}
