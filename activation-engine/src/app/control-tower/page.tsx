import db from "@/lib/db"

async function getDashboardStats() {
  const [totalPools, activePools, totalMembers, introductions] =
    await Promise.all([
      db.pool.count(),
      db.pool.count({ where: { status: "ACTIVE" } }),
      db.poolMember.count(),
      db.introduction.count(),
    ])

  const activationStats = await db.userActivationStatus.groupBy({
    by: ["status"],
    _count: true,
  })

  return {
    totalPools,
    activePools,
    totalMembers,
    introductions,
    activationStats: Object.fromEntries(
      activationStats.map((s) => [s.status, s._count])
    ),
  }
}

export default async function DashboardPage() {
  const stats = await getDashboardStats()

  const cards = [
    { label: "Total Pools", value: stats.totalPools, color: "blue" },
    { label: "Active Pools", value: stats.activePools, color: "green" },
    { label: "Total Members", value: stats.totalMembers, color: "purple" },
    { label: "Introductions", value: stats.introductions, color: "amber" },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="p-6 bg-gray-900 rounded-xl border border-gray-800"
          >
            <p className="text-gray-400 text-sm">{card.label}</p>
            <p className="text-3xl font-bold text-white mt-1">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
        <h2 className="text-lg font-semibold text-white mb-4">
          Activation Breakdown
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            "UNACTIVATED",
            "IN_POOL",
            "ACTIVATED",
            "STRONG_ACTIVATED",
            "AT_RISK",
          ].map((status) => (
            <div key={status}>
              <p className="text-xs text-gray-500 uppercase">
                {status.replace(/_/g, " ")}
              </p>
              <p className="text-xl font-semibold text-white">
                {stats.activationStats[status] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
