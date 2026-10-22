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
  deleteFabric,
  emptyFabricFilters,
  formatMeters,
  listFabrics,
  type Fabric,
  type FabricFilters,
} from "@/lib/fabrics"
import { FabricFilters as FabricFilterFields } from "@/pages/fabrics/fabric-filters"

export function FabricsPage() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<FabricFilters>(emptyFabricFilters)
  const [choosing, setChoosing] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const all = useQuery({
    queryKey: ["fabrics"],
    queryFn: () => listFabrics(emptyFabricFilters),
  })
  const filtered = useQuery({
    queryKey: ["fabrics", filters],
    queryFn: () => listFabrics(filters),
  })
  const remove = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await deleteFabric(id)
      }
    },
    onSuccess: async () => {
      setConfirming(false)
      setSelected([])
      setChoosing(false)
      await queryClient.invalidateQueries({ queryKey: ["fabrics"] })
    },
  })

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function toggleAll(fabrics: Fabric[]) {
    const ids = fabrics.map((fabric) => fabric.id)
    const allSelected = ids.every((id) => selected.includes(id))
    setSelected(
      allSelected
        ? selected.filter((id) => !ids.includes(id))
        : [...new Set([...selected, ...ids])],
    )
  }

  const visible = filtered.data ?? []
  const allVisibleSelected =
    visible.length > 0 && visible.every((fabric) => selected.includes(fabric.id))

  return (
    <div className="page-pad">
      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title">布料</h1>
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
              <Link to="/fabrics/new">录入布料</Link>
            </Button>
          </div>
        )}
      </div>
      <div className="mt-4 hidden lg:block">
        <FabricFilterFields
          fabrics={all.data ?? []}
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
              <FabricFilterFields
                fabrics={all.data ?? []}
                filters={filters}
                onChange={setFilters}
              />
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <FabricResults
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
              <DialogTitle>删除这 {selected.length} 块布料</DialogTitle>
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

function FabricResults({
  query,
  hasAny,
  choosing,
  selected,
  onToggle,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listFabrics>>>>
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
    return <p className="mt-8 text-[17px] text-muted-foreground">还没有布料</p>
  }

  if (query.data.length === 0) {
    return (
      <p className="mt-8 text-[17px] text-muted-foreground">没有符合的布料</p>
    )
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      {query.data.map((fabric) => (
        <FabricCard
          key={fabric.id}
          fabric={fabric}
          choosing={choosing}
          selected={selected.includes(fabric.id)}
          onToggle={() => onToggle(fabric.id)}
        />
      ))}
    </div>
  )
}

function FabricCard({
  fabric,
  choosing,
  selected,
  onToggle,
}: {
  fabric: Fabric
  choosing: boolean
  selected: boolean
  onToggle: () => void
}) {
  const body = (
    <>
      {fabric.image ? (
        <div className="bg-muted p-3">
          <img src={fabric.image} alt="" className="aspect-square w-full object-contain" />
        </div>
      ) : (
        <div className="flex aspect-square items-center justify-center bg-muted text-[17px]">
          {fabric.construction}
        </div>
      )}
      <div className="grid gap-1 p-4">
        <p className="text-[17px] font-semibold">{fabric.name}</p>
        <p className="text-[13px] text-muted-foreground">{fabric.color}</p>
        <p className="text-[13px] text-muted-foreground">{formatMeters(fabric.remaining_m)}</p>
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
    <Link to={`/fabrics/${fabric.id}`} className={className}>
      {body}
    </Link>
  )
}
