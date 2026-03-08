"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const links = [
  { href: "/control-tower", label: "Dashboard", icon: "◉" },
  { href: "/control-tower/my-queue", label: "My Queue", icon: "⚡" },
  { href: "/control-tower/pipeline", label: "Pipeline", icon: "▸" },
  { href: "/control-tower/match-finder", label: "Match Finder", icon: "◎" },
  { href: "/control-tower/new-joiners", label: "New Joiners", icon: "✦" },
  { href: "/control-tower/compose", label: "Compose Email", icon: "✉" },
  { href: "/control-tower/emails", label: "Email Activity", icon: "↗" },
  { href: "/control-tower/metrics", label: "Metrics", icon: "◆" },
  { href: "/control-tower/pools", label: "Pools (Legacy)", icon: "▤" },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h2 className="text-lg font-bold text-white">Syrena</h2>
        <p className="text-xs text-gray-500">Activation Workspace</p>
      </div>

      <nav className="space-y-1 flex-1">
        {links.map((link) => {
          const active =
            link.href === "/control-tower"
              ? pathname === "/control-tower"
              : pathname.startsWith(link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </nav>

      <div className="space-y-2">
        <Link
          href="/api/activation/export"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          <span className="text-base">⤓</span>
          Export CSV
        </Link>
        <button
          onClick={async () => {
            await fetch("/api/auth/login", { method: "DELETE" })
            window.location.href = "/login"
          }}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-3"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
