import { Outlet } from "react-router"

import { BottomNav } from "@/components/layout/bottom-nav"
import { SideNav } from "@/components/layout/side-nav"

export function AppShell() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="lg:flex">
        <aside className="sticky top-0 hidden h-svh w-[240px] shrink-0 border-r border-border lg:block">
          <SideNav />
        </aside>
        <div className="min-w-0 flex-1 pb-24 lg:pb-0">
          <Outlet />
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
