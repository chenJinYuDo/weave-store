import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { ChoiceField } from "@/components/choice-field"
import { Collage, type CollagePiece } from "@/components/collage"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { categories, listGarments, type Garment } from "@/lib/garments"
import { listMembers } from "@/lib/members"
import { getOutfit, putOutfit, suggestOutfit, type Outfit, type OutfitItem } from "@/lib/outfits"
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
  return <StudioBoard />
}

function StudioBoard() {
  const desktop = useDesktop()
  const queryClient = useQueryClient()
  const [memberId, setMemberId] = useState("")
  const [note, setNote] = useState("")
  const [draggingId, setDraggingId] = useState<string | null>(null)
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
        message: "",
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
  const suggest = useMutation({
    mutationFn: () => suggestOutfit(memberId),
    onSuccess: (result) => {
      if (!result.items.length) {
        setNote(result.message || "还不能凑成一套")
        return
      }
      setNote("")
      save.mutate({ member_id: memberId, items: result.items })
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

  function onDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id))
  }

  function onDragEnd(event: DragEndEvent) {
    setDraggingId(null)
    if (event.over?.id !== "viewport" || !garments.data || !outfit.data) {
      return
    }
    const garment = garments.data.find((item) => item.id === event.active.id)
    if (!garment) {
      return
    }
    save.mutate({ member_id: memberId, items: placeInOutfit(outfit.data.items, garment) })
  }

  function onDragCancel() {
    setDraggingId(null)
  }

  function onSuggest() {
    setNote("")
    suggest.mutate()
  }

  if (garments.isPending || members.isPending || outfit.isPending) {
    if (!desktop) {
      return (
        <section className="page-pad">
          <h1 className="page-title">搭配</h1>
          <Skeleton className="mt-4 aspect-[3/4] w-full max-w-sm rounded-[24px]" />
        </section>
      )
    }
    return (
      <section className="grid h-svh grid-cols-[240px_minmax(0,1fr)_240px] gap-5 p-8">
        <Skeleton className="h-full rounded-[20px]" />
        <Skeleton className="h-full rounded-[20px]" />
        <Skeleton className="h-full rounded-[20px]" />
      </section>
    )
  }

  if (garments.isError || members.isError || outfit.isError || !garments.data || !outfit.data) {
    return (
      <section className={desktop ? "p-8" : "page-pad"}>
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

  const saved = outfit.data
  const closet = garments.data
  const layers = categories.flatMap((slot) => {
    const item = saved.items.find((entry) => entry.slot === slot)
    const garment = closet.find((entry) => entry.id === item?.garment_id)
    return garment ? [{ slot, garment }] : []
  })

  const memberOptions = (members.data ?? []).map((member) => ({
    value: member.id,
    label: member.name,
  }))
  const dragging = closet.find((garment) => garment.id === draggingId) ?? null

  function removeSlot(slot: string) {
    save.mutate({
      member_id: memberId,
      items: saved.items.filter((item) => item.slot !== slot),
    })
  }

  const viewport = (
    <Viewport
      layers={layers}
      memberId={memberId}
      members={memberOptions}
      showHeading={desktop}
      onMember={(next) => {
        setNote("")
        setMemberId(next)
      }}
      onSuggest={onSuggest}
      suggesting={suggest.isPending || save.isPending}
      note={note}
    />
  )

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {desktop ? (
        <section className="grid h-svh grid-cols-[240px_minmax(0,1fr)_240px] gap-5 p-8">
          <ClosetColumn garments={closet} />
          {viewport}
          <LayersColumn layers={layers} onRemove={removeSlot} />
        </section>
      ) : (
        <section className="page-pad">
          <h1 className="page-title">搭配</h1>
          <div className="mt-4">{viewport}</div>
          <div className="mt-4">
            <ClosetColumn garments={closet} />
          </div>
          <div className="mt-4">
            <LayersColumn layers={layers} onRemove={removeSlot} />
          </div>
        </section>
      )}
      <DragOverlay>
        {dragging ? <GarmentPreview garment={dragging} /> : null}
      </DragOverlay>
    </DndContext>
  )
}

function ClosetColumn({ garments }: { garments: Garment[] }) {
  return (
    <section className="surface flex min-h-0 flex-col p-5">
      <h2 className="text-[17px] font-semibold">衣橱</h2>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {garments.length === 0 ? (
          <p className="text-[17px] text-muted-foreground">还没有衣服</p>
        ) : (
          <div className="grid gap-3">
            {garments.map((garment) => (
              <GarmentChip key={garment.id} garment={garment} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function LayersColumn({
  layers,
  onRemove,
}: {
  layers: { slot: string; garment: Garment }[]
  onRemove: (slot: string) => void
}) {
  return (
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
                  onClick={() => onRemove(slot)}
                >
                  取下
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function GarmentPreview({ garment }: { garment: Garment }) {
  return (
    <div className="flex cursor-grabbing items-center gap-3 rounded-[12px] bg-muted p-2 shadow-[0_8px_24px_rgba(0,0,0,0.12)]">
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

function GarmentChip({ garment }: { garment: Garment }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: garment.id,
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex cursor-grab touch-none items-center gap-3 rounded-[12px] bg-muted p-2 active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
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
  showHeading,
  onMember,
  onSuggest,
  suggesting,
  note,
}: {
  layers: { slot: string; garment: Garment }[]
  memberId: string
  members: { value: string; label: string }[]
  showHeading: boolean
  onMember: (memberId: string) => void
  onSuggest: () => void
  suggesting: boolean
  note: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "viewport" })
  const pieces: CollagePiece[] = layers.map(({ slot, garment }) => ({
    slot,
    name: garment.name,
    image: garment.image,
    category: garment.category,
  }))

  return (
    <section
      ref={setNodeRef}
      data-drop="viewport"
      className={cn(
        "surface flex min-h-0 flex-col p-5",
        isOver && "bg-[#007AFF]/10 ring-2 ring-[#007AFF]",
      )}
    >
      {showHeading ? <h2 className="text-[17px] font-semibold">视口</h2> : null}
      <div className={cn("grid gap-3", showHeading && "mt-4")}>
        <ChoiceField
          label="成员"
          value={memberId || "none"}
          onChange={(value) => onMember(value === "none" ? "" : value)}
          options={[{ value: "none", label: "未选择" }, ...members]}
        />
        <div>
          <Button type="button" variant="outline" disabled={suggesting} onClick={onSuggest}>
            推荐一套
          </Button>
        </div>
        {note ? <p className="text-[17px] text-muted-foreground">{note}</p> : null}
      </div>
      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        <Collage pieces={pieces} />
      </div>
    </section>
  )
}

function placeInOutfit(items: OutfitItem[], garment: Garment) {
  const drop = new Set<string>([garment.category])
  if (garment.category === "套装") {
    for (const slot of ["上衣", "外套", "下装", "半裙", "连衣裙"]) {
      drop.add(slot)
    }
  } else if (garment.category === "连衣裙") {
    for (const slot of ["上衣", "下装", "半裙", "套装"]) {
      drop.add(slot)
    }
  } else if (garment.category === "上衣" || garment.category === "下装" || garment.category === "半裙") {
    drop.add("套装")
    drop.add("连衣裙")
  } else if (garment.category === "外套") {
    drop.add("套装")
  }
  return [
    ...items.filter((item) => !drop.has(item.slot)),
    { slot: garment.category, garment_id: garment.id },
  ]
}
