import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  emptyFabricFilters,
  formatMeters,
  listFabrics,
  type FabricFilters,
} from "@/lib/fabrics"
import { FabricFilters as FabricFilterFields } from "@/pages/fabrics/fabric-filters"

export function FabricsPage() {
  const [filters, setFilters] = useState<FabricFilters>(emptyFabricFilters)
  const all = useQuery({
    queryKey: ["fabrics"],
    queryFn: () => listFabrics(emptyFabricFilters),
  })
  const filtered = useQuery({
    queryKey: ["fabrics", filters],
    queryFn: () => listFabrics(filters),
  })

  return (
    <div className="page-pad">
      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title">布料</h1>
        {filtered.isError ? null : (
          <Button asChild>
            <Link to="/fabrics/new">录入布料</Link>
          </Button>
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
      <FabricResults query={filtered} hasAny={(all.data ?? []).length > 0} />
    </div>
  )
}

function FabricResults({
  query,
  hasAny,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listFabrics>>>>
  hasAny: boolean
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
        <Link
          key={fabric.id}
          to={`/fabrics/${fabric.id}`}
          className="surface overflow-hidden"
        >
          {fabric.image ? (
            <div className="bg-muted p-3">
              <img
                src={fabric.image}
                alt=""
                className="aspect-square w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-muted text-[17px]">
              {fabric.construction}
            </div>
          )}
          <div className="grid gap-1 p-4">
            <p className="text-[17px] font-semibold">{fabric.name}</p>
            <p className="text-[13px] text-muted-foreground">{fabric.color}</p>
            <p className="text-[13px] text-muted-foreground">
              {formatMeters(fabric.remaining_m)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
