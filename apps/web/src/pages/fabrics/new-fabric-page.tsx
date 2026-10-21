import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router"

import { PhotoWell } from "@/components/photo-well"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  createFabric,
  createFabricCapture,
  emptyFabricForm,
  opacities,
  sheens,
  type FabricCapture,
  type FabricFormValues,
  type FabricInput,
} from "@/lib/fabrics"
import { FabricForm } from "@/pages/fabrics/fabric-form"

type Step = "face" | "spec" | "working" | "confirm"

export function NewFabricPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>("face")
  const [face, setFace] = useState<File | null>(null)
  const [faceUrl, setFaceUrl] = useState("")
  const [spec, setSpec] = useState<File | null>(null)
  const [specUrl, setSpecUrl] = useState("")
  const [faceError, setFaceError] = useState("")
  const [captureId, setCaptureId] = useState("")
  const [message, setMessage] = useState("")
  const [values, setValues] = useState<FabricFormValues>(emptyFabricForm)
  const save = useMutation({
    mutationFn: (input: FabricInput) => createFabric(input, captureId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fabrics"] })
      navigate("/fabrics")
    },
  })

  async function recognize(nextSpec: File | null) {
    if (!face) {
      return
    }
    setStep("working")
    try {
      const capture = await createFabricCapture(face, nextSpec)
      setCaptureId(capture.id)
      setMessage(capture.message)
      setValues(draftValues(capture))
    } catch {
      setCaptureId("")
      setMessage("识别没有完成，请自己填写")
      setValues(emptyFabricForm)
    }
    setStep("confirm")
  }

  return (
    <div className="page-pad">
      <h1 className="page-title">录入布料</h1>
      {step === "face" ? (
        <PhotoStep
          title="布面"
          preview={faceUrl}
          error={faceError}
          onPick={(file, url) => {
            setFace(file)
            setFaceUrl(url)
            setFaceError("")
          }}
          onNext={() => {
            if (!face) {
              setFaceError("请先拍照")
              return
            }
            setStep("spec")
          }}
        />
      ) : null}
      {step === "spec" ? (
        <SpecStep
          preview={specUrl}
          onPick={(file, url) => {
            setSpec(file)
            setSpecUrl(url)
          }}
          onSkip={() => void recognize(null)}
          onNext={() => void recognize(spec)}
        />
      ) : null}
      {step === "working" ? (
        <div className="mt-8 grid max-w-xl gap-4">
          <p className="text-[17px] font-semibold">正在识别</p>
          <Skeleton className="min-h-80 rounded-[24px]" />
        </div>
      ) : null}
      {step === "confirm" ? (
        <div>
          <p className="mt-8 text-[17px] font-semibold">确认</p>
          <div className="mt-4 max-w-xl rounded-[24px] border border-border bg-muted p-4">
            <img
              src={faceUrl}
              alt=""
              className="aspect-square w-full object-contain"
            />
          </div>
          {message ? (
            <p className="mt-4 text-[13px] text-muted-foreground">{message}</p>
          ) : null}
          <FabricForm
            values={values}
            submitting={save.isPending}
            onSubmit={(input) => save.mutate(input)}
          />
        </div>
      ) : null}
    </div>
  )
}

function draftValues(capture: FabricCapture): FabricFormValues {
  const draft = capture.draft
  return {
    ...emptyFabricForm,
    composition: draft.composition,
    construction:
      draft.construction === "梭织" ||
      draft.construction === "针织" ||
      draft.construction === "蕾丝" ||
      draft.construction === "无纺"
        ? draft.construction
        : "梭织",
    width_cm: draft.width_cm == null ? "" : String(draft.width_cm),
    gsm: draft.gsm == null ? "" : String(draft.gsm),
    yarn_count: draft.yarn_count,
    density: draft.density,
    opacity: opacities.includes(draft.opacity as (typeof opacities)[number])
      ? (draft.opacity as (typeof opacities)[number])
      : "",
    sheen: sheens.includes(draft.sheen as (typeof sheens)[number])
      ? (draft.sheen as (typeof sheens)[number])
      : "",
    pattern: draft.pattern,
    color: draft.color,
  }
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

function SpecStep({
  preview,
  onPick,
  onSkip,
  onNext,
}: {
  preview: string
  onPick: (file: File, url: string) => void
  onSkip: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-8 grid max-w-xl gap-5">
      <p className="text-[17px] font-semibold">规格</p>
      <PhotoWell preview={preview} onPick={onPick} />
      <div className="flex gap-3">
        <Button type="button" onClick={onNext}>
          下一步
        </Button>
        <Button type="button" variant="outline" onClick={onSkip}>
          跳过
        </Button>
      </div>
    </div>
  )
}
