import { cn } from "cn"
import { NavLink } from "react-router"

import type { NavItem } from "@/components/layout/nav-items"

export function AppNavLink({
  item,
  variant = "side",
}: {
  item: NavItem
  variant?: "side" | "tab"
}) {
  const Icon = item.icon

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        cn(
          variant === "tab"
            ? "flex flex-col items-center gap-1 py-2 text-[13px]"
            : "flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px]",
          variant === "tab"
            ? isActive
              ? "text-[#007AFF]"
              : "text-muted-foreground"
            : isActive
              ? "bg-secondary text-foreground"
              : "text-foreground hover:bg-secondary",
        )
      }
    >
      <Icon aria-hidden="true" className="size-5" />
      {item.label}
    </NavLink>
  )
}
