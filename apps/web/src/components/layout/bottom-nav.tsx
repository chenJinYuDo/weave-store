import { AppNavLink } from "@/components/layout/nav-link"
import { navItems } from "@/components/layout/nav-items"

export function BottomNav() {
  const items = navItems.filter((item) => !item.desktopOnly)

  return (
    <nav
      aria-label="主导航"
      className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-border bg-white/72 backdrop-blur-xl lg:hidden"
    >
      {items.map((item) => (
        <AppNavLink key={item.to} item={item} variant="tab" />
      ))}
    </nav>
  )
}
