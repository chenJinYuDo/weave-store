import { PersonStanding, Shirt, SwatchBook, Users, type LucideIcon } from "lucide-react"

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  desktopOnly?: boolean
}

export const navItems: NavItem[] = [
  { to: "/closet", label: "衣橱", icon: Shirt },
  { to: "/fabrics", label: "布料", icon: SwatchBook },
  { to: "/studio", label: "搭配", icon: PersonStanding, desktopOnly: true },
  { to: "/members", label: "成员", icon: Users },
]
