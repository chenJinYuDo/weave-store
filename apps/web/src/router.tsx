import { createBrowserRouter, Navigate } from "react-router"

import { AppShell } from "@/components/layout/app-shell"
import { ClosetPage } from "@/pages/closet/closet-page"
import { GarmentPage } from "@/pages/closet/garment-page"
import { NewGarmentPage } from "@/pages/closet/new-garment-page"
import { FabricPage } from "@/pages/fabrics/fabric-page"
import { FabricsPage } from "@/pages/fabrics/fabrics-page"
import { NewFabricPage } from "@/pages/fabrics/new-fabric-page"
import { MemberPage } from "@/pages/members/member-page"
import { MembersPage } from "@/pages/members/members-page"
import { NewMemberPage } from "@/pages/members/new-member-page"
import { NotFoundPage } from "@/pages/not-found-page"
import { StudioPage } from "@/pages/studio-page"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/closet" replace /> },
      { path: "closet", element: <ClosetPage /> },
      { path: "closet/new", element: <NewGarmentPage /> },
      { path: "closet/:id", element: <GarmentPage /> },
      { path: "fabrics", element: <FabricsPage /> },
      { path: "fabrics/new", element: <NewFabricPage /> },
      { path: "fabrics/:id", element: <FabricPage /> },
      { path: "studio", element: <StudioPage /> },
      { path: "members", element: <MembersPage /> },
      { path: "members/new", element: <NewMemberPage /> },
      { path: "members/:id", element: <MemberPage /> },
      { path: "*", element: <NotFoundPage /> },
    ],
  },
])
