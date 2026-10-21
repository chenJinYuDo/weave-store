import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router"

import { PhotoWell } from "@/components/photo-well"
import { Button } from "@/components/ui/button"
import {
  createMember,
  emptyMemberForm,
  type MemberFormValues,
  type MemberInput,
} from "@/lib/members"
import { MemberForm } from "@/pages/members/member-form"

type Step = "front" | "side" | "measure"

export function NewMemberPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>("front")
  const [front, setFront] = useState<File | null>(null)
  const [frontUrl, setFrontUrl] = useState("")
  const [side, setSide] = useState<File | null>(null)
  const [sideUrl, setSideUrl] = useState("")
  const [frontError, setFrontError] = useState("")
  const [values] = useState<MemberFormValues>(emptyMemberForm)
  const save = useMutation({
    mutationFn: (input: MemberInput) => createMember(input, front as File, side),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["members"] })
      navigate("/members")
    },
  })

  return (
    <div className="page-pad">
      <h1 className="page-title">添加成员</h1>
      {step === "front" ? (
        <PhotoStep
          title="正面"
          preview={frontUrl}
          error={frontError}
          onPick={(file, url) => {
            setFront(file)
            setFrontUrl(url)
            setFrontError("")
          }}
          onNext={() => {
            if (!front) {
              setFrontError("请先拍照")
              return
            }
            setStep("side")
          }}
        />
      ) : null}
      {step === "side" ? (
        <div className="mt-8 grid max-w-xl gap-5">
          <p className="text-[17px] font-semibold">侧面</p>
          <PhotoWell
            preview={sideUrl}
            onPick={(file, url) => {
              setSide(file)
              setSideUrl(url)
            }}
          />
          <div className="flex gap-3">
            <Button type="button" onClick={() => setStep("measure")}>
              下一步
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSide(null)
                setSideUrl("")
                setStep("measure")
              }}
            >
              跳过
            </Button>
          </div>
        </div>
      ) : null}
      {step === "measure" ? (
        <div>
          <p className="mt-8 text-[17px] font-semibold">尺寸</p>
          <MemberForm
            values={values}
            submitting={save.isPending}
            onSubmit={(input) => {
              if (!front) {
                return
              }
              save.mutate(input)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}

function PhotoStep({
  title,
  preview,
  error,
  onPick,
  onNext,
}: {
  title: string
  preview: string
  error?: string
  onPick: (file: File, url: string) => void
  onNext: () => void
}) {
  return (
    <div className="mt-8 grid max-w-xl gap-5">
      <p className="text-[17px] font-semibold">{title}</p>
      <PhotoWell preview={preview} error={error} onPick={onPick} />
      <div>
        <Button type="button" onClick={onNext}>
          下一步
        </Button>
      </div>
    </div>
  )
}
