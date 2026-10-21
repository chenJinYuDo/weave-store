import { Link } from "react-router"

import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="page-pad">
      <h1 className="page-title">页面不存在</h1>
      <div className="mt-6">
        <Button asChild>
          <Link to="/closet">回到衣橱</Link>
        </Button>
      </div>
    </div>
  )
}
