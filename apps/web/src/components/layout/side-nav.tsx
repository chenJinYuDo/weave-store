import { AppNavLink } from "@/components/layout/nav-link"
import { navItems } from "@/components/layout/nav-items"

export function SideNav() {
  return (
    <nav aria-label="主导航" className="flex h-full flex-col gap-1 px-4 py-6">
      <p className="px-3 pb-4 text-[17px] font-semibold tracking-tight">
        家庭衣橱
      </p>
      {navItems.map((item) => (
        <AppNavLink key={item.to} item={item} />
      ))}
    </nav>
  )
}
