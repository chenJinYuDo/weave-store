import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { ChoiceField } from "@/components/choice-field"
import { DrapeView } from "@/components/drape-view"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { categories, listGarments, type Garment } from "@/lib/garments"
import { listMembers } from "@/lib/members"
import { getOutfit, putOutfit, type Outfit } from "@/lib/outfits"
import { cn } from "cn"

function useDesktop() {
  const query = "(min-width: 1024px)"
  const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setDesktop(media.matches)
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  return desktop
}

export function StudioPage() {
  const desktop = useDesktop()
  if (!desktop) {
    return <PhoneStudio />
  }
  return <StudioBoard />
}

function PhoneStudio() {
  const outfit = useQuery({
    queryKey: ["outfit", ""],
    queryFn: () => getOutfit(""),
  })

  return (
    <section className="page-pad">
      <h1 className="page-title">搭配</h1>
      {outfit.data?.display_url ? (
        <DrapeView url={outfit.data.display_url} className="mt-4 h-[70vh]" />
      ) : outfit.isSuccess ? (
        <p className="mt-3 text-[17px] text-muted-foreground">请在电脑上搭配</p>
      ) : null}
    </section>
  )
}

function StudioBoard() {
  const queryClient = useQueryClient()
  const [memberId, setMemberId] = useState("")
  const garments = useQuery({
    queryKey: ["garments"],
    queryFn: () => listGarments({ category: "", color: "", season: "", fiber: "", owner: "" }),
  })
  const members = useQuery({
    queryKey: ["members"],
    queryFn: listMembers,
  })
  const outfit = useQuery({
    queryKey: ["outfit", memberId],
    queryFn: () => getOutfit(memberId),
  })
  const save = useMutation({
    mutationFn: putOutfit,
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: ["outfit", next.member_id] })
      const previous = queryClient.getQueryData<Outfit>(["outfit", next.member_id])
      queryClient.setQueryData<Outfit>(["outfit", next.member_id], {
        member_id: next.member_id,
        items: next.items,
        display_url: "",
        message: next.items.length ? "正在垂坠" : "",
        height_cm:
          members.data?.find((member) => member.id === next.member_id)?.height_cm ?? 170,
      })
      return { previous }
    },
    onError: (_error, next, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["outfit", next.member_id], context.previous)
      }
    },
    onSettled: (_data, _error, next) => {
      void queryClient.invalidateQueries({ queryKey: ["outfit", next.member_id] })
    },
  })
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: (event, { currentCoordinates }) => {
        const viewport = document.querySelector("[data-drop='viewport']")
        if (event.code === "ArrowRight" && viewport) {
          const rect = viewport.getBoundingClientRect()
          return { x: rect.left + 24, y: rect.top + 80 }
        }
        if (event.code === "ArrowLeft") {
          return { ...currentCoordinates, x: currentCoordinates.x - 80 }
        }
        if (event.code === "ArrowDown") {
          return { ...currentCoordinates, y: currentCoordinates.y + 80 }
        }
        if (event.code === "ArrowUp") {
          return { ...currentCoordinates, y: currentCoordinates.y - 80 }
        }
        return currentCoordinates
      },
    }),
  )

  function onDragEnd(event: DragEndEvent) {
    if (event.over?.id !== "viewport" || !garments.data || !outfit.data) {
      return
    }
    const garment = garments.data.find((item) => item.id === event.active.id)
    if (!garment) {
      return
    }
    const items = [
      ...outfit.data.items.filter((item) => item.slot !== garment.category),
      { slot: garment.category, garment_id: garment.id },
    ]
    save.mutate({ member_id: memberId, items })
  }

  if (garments.isPending || members.isPending || outfit.isPending) {
    return (
      <section className="hidden h-svh grid-cols-[240px_minmax(0,1fr)_240px] gap-5 p-8 lg:grid">
        <Skeleton className="h-full rounded-[20px]" />
        <Skeleton className="h-full rounded-[20px]" />
        <Skeleton className="h-full rounded-[20px]" />
      </section>
    )
  }

  if (garments.isError || members.isError || outfit.isError || !garments.data || !outfit.data) {
    return (
      <section className="hidden p-8 lg:block">
        <p className="text-[17px] text-muted-foreground">加载失败</p>
        <div className="mt-6">
          <Button
            onClick={() => {
              void garments.refetch()
              void members.refetch()
              void outfit.refetch()
            }}
          >
            重试
          </Button>
        </div>
      </section>
    )
  }

  const layers = categories.flatMap((slot) => {
    const item = outfit.data.items.find((entry) => entry.slot === slot)
    const garment = garments.data.find((entry) => entry.id === item?.garment_id)
    return garment ? [{ slot, garment }] : []
  })

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <section className="hidden h-svh grid-cols-[240px_minmax(0,1fr)_240px] gap-5 p-8 lg:grid">
        <section className="surface flex min-h-0 flex-col p-5">
          <h2 className="text-[17px] font-semibold">衣橱</h2>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {garments.data.length === 0 ? (
              <p className="text-[17px] text-muted-foreground">还没有衣服</p>
            ) : (
              <div className="grid gap-3">
                {garments.data.map((garment) => (
                  <GarmentChip key={garment.id} garment={garment} />
                ))}
              </div>
            )}
          </div>
        </section>
        <Viewport
          layers={layers}
          memberId={memberId}
          members={(members.data ?? []).map((member) => ({
            value: member.id,
            label: member.name,
          }))}
          onMember={setMemberId}
          displayUrl={outfit.data.display_url}
          message={outfit.data.message}
          pending={save.isPending}
          heightCm={memberId ? outfit.data.height_cm : 0}
        />
        <section className="surface flex min-h-0 flex-col p-5">
          <h2 className="text-[17px] font-semibold">叠穿</h2>
          <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
            {layers.length === 0 ? (
              <p className="text-[17px] text-muted-foreground">还没有叠穿</p>
            ) : (
              <div className="grid gap-4">
                {layers.map(({ slot, garment }) => (
                  <div key={slot} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-muted-foreground">{slot}</p>
                      <p className="truncate text-[17px]">{garment.name}</p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-[13px] text-muted-foreground"
                      onClick={() =>
                        save.mutate({
                          member_id: memberId,
                          items: outfit.data.items.filter((item) => item.slot !== slot),
                        })
                      }
                    >
                      取下
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </section>
    </DndContext>
  )
}

function GarmentChip({ garment }: { garment: Garment }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: garment.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex cursor-grab items-center gap-3 rounded-[12px] bg-muted p-2 active:cursor-grabbing",
        isDragging && "opacity-60",
      )}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      {...listeners}
      {...attributes}
    >
      {garment.image ? (
        <img src={garment.image} alt="" className="size-14 rounded-[8px] object-contain" />
      ) : (
        <span className="flex size-14 items-center justify-center rounded-[8px] bg-background text-[13px]">
          {garment.category}
        </span>
      )}
      <span className="min-w-0 truncate text-[17px]">{garment.name}</span>
    </div>
  )
}

function Viewport({
  layers,
  memberId,
  members,
  onMember,
  displayUrl,
  message,
  pending,
  heightCm,
}: {
  layers: { slot: string; garment: Garment }[]
  memberId: string
  members: { value: string; label: string }[]
  onMember: (memberId: string) => void
  displayUrl: string
  message: string
  pending: boolean
  heightCm: number
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "viewport" })

  return (
    <section
      ref={setNodeRef}
      data-drop="viewport"
      className={cn(
        "surface flex min-h-0 flex-col p-5",
        isOver && "bg-[#007AFF]/10 ring-2 ring-[#007AFF]",
      )}
    >
      <h2 className="text-[17px] font-semibold">视口</h2>
      <div className="mt-4">
        <ChoiceField
          label="成员"
          value={memberId || "none"}
          onChange={(value) => onMember(value === "none" ? "" : value)}
          options={[{ value: "none", label: "未选择" }, ...members]}
        />
      </div>
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto">
        <p className="text-[17px] text-muted-foreground">还不能生成人体</p>
        {heightCm > 0 ? (
          <p className="mt-2 text-[17px] text-muted-foreground">按 {heightCm} 厘米</p>
        ) : null}
        {layers.length > 0 && (pending || message === "正在垂坠") ? (
          <p className="mt-4 text-[17px] text-muted-foreground">正在垂坠</p>
        ) : displayUrl ? (
          <DrapeView url={displayUrl} className="mt-4 min-h-80 flex-1" />
        ) : (
          <>
            {message ? <p className="mt-4 text-[17px] text-muted-foreground">{message}</p> : null}
            <div className="mt-4 grid gap-4">
              {layers.map(({ slot, garment }) => (
                <div key={slot} className="rounded-[16px] bg-muted p-3">
                  {garment.image ? (
                    <img
                      src={garment.image}
                      alt=""
                      className="aspect-square w-full object-contain"
                    />
                  ) : (
                    <div className="flex aspect-square items-center justify-center text-[17px]">
                      {garment.category}
                    </div>
                  )}
                  <p className="mt-2 text-[17px] font-semibold">{garment.name}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
