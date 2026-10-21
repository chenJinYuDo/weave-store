import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { Link, useNavigate, useParams } from "react-router"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  ApiError,
  deleteGarment,
  getGarment,
  updateGarment,
  type GarmentInput,
} from "@/lib/garments"
import { GarmentForm } from "@/pages/closet/garment-form"

export function GarmentPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const garment = useQuery({
    queryKey: ["garments", id],
    queryFn: () => getGarment(id),
    retry: false,
  })
  const save = useMutation({
    mutationFn: (values: GarmentInput) => updateGarment(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["garments"] })
      navigate("/closet")
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteGarment(id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["garments", id] })
      await queryClient.invalidateQueries({ queryKey: ["garments"] })
      navigate("/closet")
    },
  })

  if (garment.isPending) {
    return (
      <div className="page-pad">
        <Skeleton className="h-8 w-40" />
      </div>
    )
  }

  if (garment.error instanceof ApiError && garment.error.status === 404) {
    return (
      <div className="page-pad">
        <h1 className="page-title">没有这件衣服</h1>
        <div className="mt-6">
          <Button asChild>
            <Link to="/closet">回到衣橱</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (garment.isError || !garment.data) {
    return (
      <div className="page-pad">
        <p className="text-[17px] text-muted-foreground">加载失败</p>
        <div className="mt-6">
          <Button onClick={() => garment.refetch()}>重试</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-pad">
      <h1 className="page-title">{garment.data.name}</h1>
      {garment.data.image ? (
        <div className="mt-6 max-w-xl rounded-[24px] border border-border bg-muted p-4">
          <img
            src={garment.data.image}
            alt=""
            className="aspect-square w-full object-contain"
          />
        </div>
      ) : null}
      <GarmentForm
        values={garment.data}
        submitting={save.isPending}
        onSubmit={(values) => save.mutate(values)}
      />
      <div className="mt-8">
        <Dialog open={confirming} onOpenChange={setConfirming}>
          <DialogTrigger asChild>
            <Button variant="destructive" type="button">
              删除
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>删除这件衣服</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirming(false)}>
                取消
              </Button>
              <Button
                variant="destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate()}
              >
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
