import { SidebarNav } from "@/components/control-tower/sidebar-nav"

export default function ControlTowerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <SidebarNav />
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
