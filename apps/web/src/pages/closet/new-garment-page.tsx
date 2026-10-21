import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useNavigate } from "react-router"

import { PhotoWell } from "@/components/photo-well"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  createCapture,
  createGarment,
  emptyGarment,
  type GarmentInput,
} from "@/lib/garments"
import { GarmentForm } from "@/pages/closet/garment-form"

type Step = "photo" | "label" | "working" | "confirm"

export function NewGarmentPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>("photo")
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState("")
  const [label, setLabel] = useState<File | null>(null)
  const [labelUrl, setLabelUrl] = useState("")
  const [photoError, setPhotoError] = useState("")
  const [captureId, setCaptureId] = useState("")
  const [cutoutUrl, setCutoutUrl] = useState("")
  const [message, setMessage] = useState("")
  const [values, setValues] = useState<GarmentInput>(emptyGarment)
  const save = useMutation({
    mutationFn: (input: GarmentInput) => createGarment(input, captureId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["garments"] })
      navigate("/closet")
    },
  })

  async function recognize(nextLabel: File | null) {
    if (!photo) {
      return
    }
    setStep("working")
    try {
      const capture = await createCapture(photo, nextLabel)
      setCaptureId(capture.id)
      setCutoutUrl(capture.cutout_url)
      setMessage(capture.message)
      setValues({ ...emptyGarment, ...capture.draft, name: "" })
    } catch {
      setCaptureId("")
      setCutoutUrl("")
      setMessage("识别没有完成，请自己填写")
      setValues(emptyGarment)
    }
    setStep("confirm")
  }

  return (
    <div className="page-pad">
      <h1 className="page-title">录入衣服</h1>
      {step === "photo" ? (
        <PhotoStep
          preview={photoUrl}
          error={photoError}
          onPick={(file, url) => {
            setPhoto(file)
            setPhotoUrl(url)
            setPhotoError("")
          }}
          onNext={() => {
            if (!photo) {
              setPhotoError("请先拍照")
              return
            }
            setStep("label")
          }}
        />
      ) : null}
      {step === "label" ? (
        <LabelStep
          preview={labelUrl}
          onPick={(file, url) => {
            setLabel(file)
            setLabelUrl(url)
          }}
          onSkip={() => void recognize(null)}
          onNext={() => void recognize(label)}
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
              src={cutoutUrl || photoUrl}
              alt=""
              className="aspect-square w-full object-contain"
            />
          </div>
          {message ? (
            <p className="mt-4 text-[13px] text-muted-foreground">{message}</p>
          ) : null}
          <GarmentForm
            values={values}
            submitting={save.isPending}
            onSubmit={(input) => save.mutate(input)}
          />
        </div>
      ) : null}
    </div>
  )
}

function PhotoStep({
  preview,
  error,
  onPick,
  onNext,
}: {
  preview: string
  error: string
  onPick: (file: File, url: string) => void
  onNext: () => void
}) {
  return (
    <div className="mt-8 grid max-w-xl gap-5">
      <p className="text-[17px] font-semibold">拍照</p>
      <PhotoWell preview={preview} error={error} onPick={onPick} />
      <div>
        <Button type="button" onClick={onNext}>
          下一步
        </Button>
      </div>
    </div>
  )
}

function LabelStep({
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
      <p className="text-[17px] font-semibold">洗标</p>
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
