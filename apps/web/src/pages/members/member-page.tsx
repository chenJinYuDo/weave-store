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
  deleteMember,
  getMember,
  toMemberForm,
  updateMember,
  type MemberInput,
} from "@/lib/members"
import { MemberForm } from "@/pages/members/member-form"

export function MemberPage() {
  const { id = "" } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState(false)
  const member = useQuery({
    queryKey: ["members", id],
    queryFn: () => getMember(id),
    retry: false,
  })
  const save = useMutation({
    mutationFn: (values: MemberInput) => updateMember(id, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["members"] })
      navigate("/members")
    },
  })
  const remove = useMutation({
    mutationFn: () => deleteMember(id),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ["members", id] })
      await queryClient.invalidateQueries({ queryKey: ["members"] })
      navigate("/members")
    },
  })

  if (member.isPending) {
    return (
      <div className="page-pad">
        <Skeleton className="h-8 w-40" />
      </div>
    )
  }

  if (member.error instanceof ApiError && member.error.status === 404) {
    return (
      <div className="page-pad">
        <h1 className="page-title">没有这位成员</h1>
        <div className="mt-6">
          <Button asChild>
            <Link to="/members">回到成员</Link>
          </Button>
        </div>
      </div>
    )
  }

  if (member.isError || !member.data) {
    return (
      <div className="page-pad">
        <p className="text-[17px] text-muted-foreground">加载失败</p>
        <div className="mt-6">
          <Button onClick={() => member.refetch()}>重试</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-pad">
      <h1 className="page-title">{member.data.name}</h1>
      <div className="mt-6 grid max-w-xl gap-5">
        {member.data.front ? (
          <div className="rounded-[24px] border border-border bg-muted p-4">
            <img
              src={member.data.front}
              alt=""
              className="aspect-square w-full object-contain"
            />
          </div>
        ) : null}
        {member.data.side ? (
          <div className="rounded-[24px] border border-border bg-muted p-4">
            <img
              src={member.data.side}
              alt=""
              className="aspect-square w-full object-contain"
            />
          </div>
        ) : null}
        <div className="flex min-h-40 items-center justify-center rounded-[24px] border border-border bg-muted px-6 text-center">
          <p className="text-[17px] text-muted-foreground">还不能生成人体</p>
        </div>
      </div>
      <MemberForm
        values={toMemberForm(member.data)}
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
              <DialogTitle>删除这位成员</DialogTitle>
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
