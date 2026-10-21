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
  emptyFilters,
  listGarments,
  type GarmentFilters,
} from "@/lib/garments"
import { ClosetFilters } from "@/pages/closet/closet-filters"

export function ClosetPage() {
  const [filters, setFilters] = useState<GarmentFilters>(emptyFilters)
  const all = useQuery({
    queryKey: ["garments"],
    queryFn: () => listGarments(emptyFilters),
  })
  const filtered = useQuery({
    queryKey: ["garments", filters],
    queryFn: () => listGarments(filters),
  })

  return (
    <div className="page-pad">
      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title">衣橱</h1>
        {filtered.isError ? null : (
          <Button asChild>
            <Link to="/closet/new">录入衣服</Link>
          </Button>
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
      <ClosetResults query={filtered} hasAny={(all.data ?? []).length > 0} />
    </div>
  )
}

function ClosetResults({
  query,
  hasAny,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listGarments>>>>
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
        <Link
          key={garment.id}
          to={`/closet/${garment.id}`}
          className="surface overflow-hidden"
        >
          {garment.image ? (
            <div className="bg-muted p-3">
              <img
                src={garment.image}
                alt=""
                className="aspect-square w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-muted text-[17px]">
              {garment.category}
            </div>
          )}
          <div className="grid gap-1 p-4">
            <p className="text-[17px] font-semibold">{garment.name}</p>
            <p className="text-[13px] text-muted-foreground">{garment.color}</p>
            <p className="text-[13px] text-muted-foreground">
              {garment.category}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
