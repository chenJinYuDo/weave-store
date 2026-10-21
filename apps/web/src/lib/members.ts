import { z } from "zod"

import { ApiError, request } from "@/lib/api"

const girth = (message: string) =>
  z
    .string()
    .refine(
      (value) =>
        value === "" ||
        (/^\d+$/.test(value) && Number(value) >= 40 && Number(value) <= 160),
      message,
    )

export const memberFormSchema = z.object({
  name: z.string().trim().min(1, "请填写姓名").max(20, "请填写姓名"),
  height_cm: z
    .string()
    .trim()
    .min(1, "请填写身高")
    .refine(
      (value) =>
        /^\d+$/.test(value) && Number(value) >= 50 && Number(value) <= 230,
      "身高不正确",
    ),
  chest_cm: girth("胸围不正确"),
  waist_cm: girth("腰围不正确"),
  hip_cm: girth("臀围不正确"),
})

export type MemberFormValues = z.infer<typeof memberFormSchema>

export type MemberInput = {
  name: string
  height_cm: number
  chest_cm: number | null
  waist_cm: number | null
  hip_cm: number | null
}

export type Member = MemberInput & {
  id: string
  front: string
  side: string
  created_at: string
  updated_at: string
}

export const emptyMemberForm: MemberFormValues = {
  name: "",
  height_cm: "",
  chest_cm: "",
  waist_cm: "",
  hip_cm: "",
}

export function toMemberForm(member: Member): MemberFormValues {
  return {
    name: member.name,
    height_cm: String(member.height_cm),
    chest_cm: member.chest_cm == null ? "" : String(member.chest_cm),
    waist_cm: member.waist_cm == null ? "" : String(member.waist_cm),
    hip_cm: member.hip_cm == null ? "" : String(member.hip_cm),
  }
}

export function toMemberInput(values: MemberFormValues): MemberInput {
  const girthValue = (value: string) => (value === "" ? null : Number(value))
  return {
    name: values.name.trim(),
    height_cm: Number(values.height_cm),
    chest_cm: girthValue(values.chest_cm),
    waist_cm: girthValue(values.waist_cm),
    hip_cm: girthValue(values.hip_cm),
  }
}

export function formatHeight(value: number) {
  return `${value} 厘米`
}

export function listMembers() {
  return request<Member[]>("/api/members")
}

export function getMember(id: string) {
  return request<Member>(`/api/members/${id}`)
}

export async function createMember(
  input: MemberInput,
  front: File,
  side: File | null,
) {
  const body = new FormData()
  body.append("name", input.name)
  body.append("height_cm", String(input.height_cm))
  if (input.chest_cm != null) {
    body.append("chest_cm", String(input.chest_cm))
  }
  if (input.waist_cm != null) {
    body.append("waist_cm", String(input.waist_cm))
  }
  if (input.hip_cm != null) {
    body.append("hip_cm", String(input.hip_cm))
  }
  body.append("front", front)
  if (side) {
    body.append("side", side)
  }
  const response = await fetch("/api/members", { method: "POST", body })
  if (!response.ok) {
    throw new ApiError(response.status)
  }
  return response.json() as Promise<Member>
}

export function updateMember(id: string, input: MemberInput) {
  return request<Member>(`/api/members/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function deleteMember(id: string) {
  return request<void>(`/api/members/${id}`, { method: "DELETE" })
}
