import { useParams } from "react-router"

export function PlaceholderPage({ title }: { title: string }) {
  const { id } = useParams()

  return (
    <div className="page-pad">
      <h1 className="page-title">
        {title}
        {id ? (
          <span className="ml-3 text-[17px] font-normal text-muted-foreground">
            {id}
          </span>
        ) : null}
      </h1>
      <p className="mt-3 text-[17px] text-muted-foreground">这一步以后再做</p>
    </div>
  )
}
