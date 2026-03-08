import { SidebarNav } from "@/components/control-tower/sidebar-nav"
import { TestModeBanner } from "@/components/control-tower/test-mode-banner"
import { ClientProviders } from "@/components/ui/providers"

export default function ControlTowerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      <SidebarNav />
      <div className="flex-1 flex flex-col">
        <TestModeBanner />
        <ClientProviders>
          <main className="flex-1 p-8">{children}</main>
        </ClientProviders>
      </div>
    </div>
  )
}
