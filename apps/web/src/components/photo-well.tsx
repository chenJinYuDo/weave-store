import { Camera } from "lucide-react"
import { useRef, useState } from "react"

import { cn } from "cn"

export function PhotoWell({
  preview,
  error,
  onPick,
}: {
  preview: string
  error?: string
  onPick: (file: File, url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function take(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) {
      return
    }
    onPick(file, URL.createObjectURL(file))
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          take(event.dataTransfer.files?.[0])
        }}
        className={cn(
          "relative flex min-h-80 w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border border-border bg-muted px-6 text-center shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)] transition-colors",
          dragging && "bg-[#007AFF]/10 ring-2 ring-[#007AFF]",
        )}
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            className="absolute inset-0 size-full object-contain"
          />
        ) : (
          <>
            <span className="flex size-16 items-center justify-center rounded-full bg-card shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.08)]">
              <Camera aria-hidden="true" className="size-7" />
            </span>
            <span className="mt-4 text-[17px] font-semibold text-foreground">
              添加照片
            </span>
            <span className="mt-1 text-[13px] font-normal text-muted-foreground">
              拍照或从相册选择
            </span>
          </>
        )}
        {preview ? (
          <span className="absolute right-4 bottom-4 rounded-full bg-white/80 px-3 py-1.5 text-[13px] font-medium text-foreground backdrop-blur-xl">
            更换
          </span>
        ) : null}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => take(event.target.files?.[0])}
      />
      {error ? (
        <p className="mt-3 text-[13px] text-destructive">{error}</p>
      ) : null}
    </div>
  )
}
