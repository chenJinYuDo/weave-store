import { Shirt, SwatchBook, Users, type LucideIcon } from "lucide-react"

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { to: "/closet", label: "衣橱", icon: Shirt },
  { to: "/fabrics", label: "布料", icon: SwatchBook },
  // 衣服还少，先藏起搭配。恢复时加回 PersonStanding 的导入，取消下一行注释，并把底栏改回 grid-cols-4。
  // { to: "/studio", label: "搭配", icon: PersonStanding },
  { to: "/members", label: "成员", icon: Users },
]
