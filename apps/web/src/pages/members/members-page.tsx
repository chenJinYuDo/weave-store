import { useQuery } from "@tanstack/react-query"
import { Link } from "react-router"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatHeight, listMembers } from "@/lib/members"

export function MembersPage() {
  const members = useQuery({
    queryKey: ["members"],
    queryFn: listMembers,
  })

  return (
    <div className="page-pad">
      <div className="flex items-center justify-between gap-4">
        <h1 className="page-title">成员</h1>
        {members.isError || (members.data ?? []).length === 0 ? null : (
          <Button asChild>
            <Link to="/members/new">添加成员</Link>
          </Button>
        )}
      </div>
      <MemberResults query={members} />
    </div>
  )
}

function MemberResults({
  query,
}: {
  query: ReturnType<typeof useQuery<Awaited<ReturnType<typeof listMembers>>>>
}) {
  if (query.isPending) {
    return (
      <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
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

  if (query.data.length === 0) {
    return (
      <div>
        <p className="mt-3 text-[17px] text-muted-foreground">还没有家庭成员</p>
        <div className="mt-6">
          <Button asChild>
            <Link to="/members/new">添加成员</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-8 grid grid-cols-2 gap-5 md:grid-cols-3 xl:grid-cols-4">
      {query.data.map((member) => (
        <Link
          key={member.id}
          to={`/members/${member.id}`}
          className="surface overflow-hidden"
        >
          {member.front ? (
            <div className="bg-muted p-3">
              <img
                src={member.front}
                alt=""
                className="aspect-square w-full object-contain"
              />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center bg-muted text-[17px]">
              {member.name}
            </div>
          )}
          <div className="grid gap-1 p-4">
            <p className="text-[17px] font-semibold">{member.name}</p>
            <p className="text-[13px] text-muted-foreground">
              {formatHeight(member.height_cm)}
            </p>
          </div>
        </Link>
      ))}
    </div>
  )
}
