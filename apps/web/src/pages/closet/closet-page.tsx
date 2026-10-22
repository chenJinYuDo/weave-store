import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  deleteGarment,
  emptyFilters,
  listGarments,
  type Garment,
  type GarmentFilters,
} from "@/lib/garments"
import { ClosetFilters } from "@/pages/closet/closet-filters"

export function ClosetPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<GarmentFilters>(emptyFilters)
  const [choosing, setChoosing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const all = useQuery({
    queryKey: ["garments"],
    queryFn: () => listGarments(emptyFilters),
  })
  const filtered = useQuery({
    queryKey: ["garments", filters],
    queryFn: () => listGarments(filters),
  })
  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await deleteGarment(id)
      }
    },
    onSuccess: async () => {
      setConfirming(false)
      setSelected([])
      setChoosing(false)
      await queryClient.invalidateQueries({ queryKey: ["garments"] })
      await queryClient.invalidateQueries({ queryKey: ["outfit"] })
    },
  })

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function toggleAll(garments: Garment[]) {
    const ids = garments.map((garment) => garment.id)
    const allSelected = ids.every((id) => selected.includes(id))
    setSelected(
      allSelected
        ? selected.filter((id) => !ids.includes(id))
        : [...new Set([...selected, ...ids])],
    )
  }

  const visible = filtered.data ?? []
  const allVisibleSelected = visible.length > 0 && visible.every((garment) => selected.includes(garment.id))

  return (
    <div className="page-pad">
      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title">衣橱</h1>
        {filtered.isError ? null : (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {choosing ? (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setChoosing(false)
                  setSelected([])
                }}
              >
                完成
              </Button>
            ) : (
              <Button
                variant="outline"
                type="button"
                disabled={(all.data ?? []).length === 0}
                onClick={() => setChoosing(true)}
              >
                选择
              </Button>
            )}
            {choosing ? (
              <Button variant="outline" type="button" onClick={() => toggleAll(visible)}>
                {allVisibleSelected ? "取消全选" : "全选"}
              </Button>
            ) : null}
            {choosing && selected.length > 0 ? (
              <Button variant="destructive" type="button" onClick={() => setConfirming(true)}>
                删除
              </Button>
            ) : null}
            <Button asChild>
              <Link to="/closet/new">录入衣服</Link>
            </Button>
          </div>
        )}
      </div>
      <div className="mt-4 hidden lg:block">
        <ClosetFilters
          garments={all.data ?? []}
          filters={filters}
          onChange={setFilters}
        />
      </div>
      <div className="mt-4 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">筛选</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>筛选</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <ClosetFilters
                garments={all.data ?? []}
                filters={filters}
                onChange={setFilters}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <ClosetResults
        query={filtered}
        hasAny={(all.data ?? []).length > 0}
        choosing={choosing}
        selected={selected}
        onToggle={toggle}
      />
      {confirming ? (
        <Dialog open onOpenChange={(open) => setConfirming(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>删除这 {selected.length} 件衣服</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                取消
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(selected)}
              >
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}

function ClosetResults({
  query,
  hasAny,
  choosing,
  selected,
  onToggle,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listGarments>>>>
  hasAny: boolean
  choosing: boolean
  selected: string[]
  onToggle: (id: string) => void
}) {
  if (query.isPending) {
    return (
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
        <Skeleton className="aspect-square" />
        <Skeleton className="aspect-square" />
      </div>
    )
  }

  if (query.isError) {
    return (
      <div className="mt-6">
        <p className="text-[17px] text-muted-foreground">加载失败</p>
        <div className="mt-6">
          <Button onClick={() => query.refetch()}>重试</Button>
        </div>
      </div>
    )
  }

  if (!hasAny) {
    return <p className="mt-8 text-[17px] text-muted-foreground">还没有衣服</p>
  }

  if (query.data.length === 0) {
    return (
      <p className="mt-8 text-[17px] text-muted-foreground">没有符合的衣服</p>
    )
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      {query.data.map((garment) => (
        <GarmentCard
          key={garment.id}
          garment={garment}
          choosing={choosing}
          selected={selected.includes(garment.id)}
          onToggle={() => onToggle(garment.id)}
        />
      ))}
    </div>
  )
}

function GarmentCard({
  garment,
  choosing,
  selected,
  onToggle,
}: {
  garment: Garment
  choosing: boolean
  selected: boolean
  onToggle: () => void
}) {
  const body = (
    <>
      {garment.image ? (
        <div className="bg-muted p-3">
          <img src={garment.image} alt="" className="aspect-square w-full object-contain" />
        </div>
      ) : (
        <div className="flex aspect-square items-center justify-center bg-muted text-[17px]">
          {garment.category}
        </div>
      )}
      <div className="grid gap-1 p-4">
        <p className="text-[17px] font-semibold">{garment.name}</p>
        <p className="text-[13px] text-muted-foreground">{garment.color}</p>
        <p className="text-[13px] text-muted-foreground">{garment.category}</p>
      </div>
    </>
  )
  const className = cn("surface overflow-hidden text-left", selected && "ring-2 ring-[#007AFF]")
  if (choosing) {
    return (
      <button type="button" className={className} aria-pressed={selected} onClick={onToggle}>
        {body}
      </button>
    )
  }
  return (
    <Link to={`/closet/${garment.id}`} className={className}>
      {body}
    </Link>
  )
}
