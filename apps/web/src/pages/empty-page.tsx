import { Link } from "react-router"

import { Button } from "@/components/ui/button"

export function EmptyPage({
  title,
  description,
  actionTo,
  actionLabel,
}: {
  title: string
  description: string
  actionTo: string
  actionLabel: string
}) {
  return (
    <div className="page-pad">
      <h1 className="page-title">{title}</h1>
      <p className="mt-3 text-[17px] text-muted-foreground">{description}</p>
      <div className="mt-6">
        <Button asChild>
          <Link to={actionTo}>{actionLabel}</Link>
        </Button>
      </div>
    </div>
  )
}
