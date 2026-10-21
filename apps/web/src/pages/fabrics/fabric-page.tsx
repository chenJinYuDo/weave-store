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
import { ApiError } from "@/lib/api"
import {
  deleteFabric,
  fabricSummary,
  getFabric,
  toFabricForm,
  updateFabric,
  type FabricInput,
} from "@/lib/fabrics"
import { FabricForm } from "@/pages/fabrics/fabric-form"

export function FabricPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const fabric = useQuery({
    queryKey: ["fabrics", id],
    queryFn: () => getFabric(id),
    retry: false,
  })
  const save = useMutation({
    mutationFn: (values: FabricInput) => updateFabric(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["fabrics"] })
      navigate("/fabrics")
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteFabric(id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["fabrics", id] })
      await queryClient.invalidateQueries({ queryKey: ["fabrics"] })
      navigate("/fabrics")
    },
  })

  if (fabric.isPending) {
    return (
      <div className="page-pad">
        <Skeleton className="h-8 w-40" />
      </div>
    )
  }

  if (fabric.error instanceof ApiError && fabric.error.status === 404) {
    return (
      <div className="page-pad">
        <h1 className="page-title">没有这块布料</h1>
        <div className="mt-6">
          <Button asChild>
            <Link to="/fabrics">回到布料库</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (fabric.isError || !fabric.data) {
    return (
      <div className="page-pad">
        <p className="text-sm text-muted-foreground">加载失败</p>
        <div className="mt-6">
          <Button onClick={() => fabric.refetch()}>重试</Button>
        </div>
      </div>
    )
  }

  const summary = fabricSummary(fabric.data)

  return (
    <div className="page-pad">
      <h1 className="page-title">{fabric.data.name}</h1>
      {fabric.data.image ? (
        <div className="mt-6 max-w-xl rounded-[24px] border border-border bg-muted p-4">
          <img
            src={fabric.data.image}
            alt=""
            className="aspect-square w-full object-contain"
          />
        </div>
      ) : null}
      {summary ? (
        <p className="mt-3 text-[17px] text-muted-foreground">{summary}</p>
      ) : null}
      <FabricForm
        values={toFabricForm(fabric.data)}
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
              <DialogTitle>删除这块布料</DialogTitle>
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
