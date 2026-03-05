import db from "@/lib/db"

export default async function MetricsPage() {
  const [activationStats, emailStats, poolStats] = await Promise.all([
    db.userActivationStatus.groupBy({
      by: ["status", "side"],
      _count: true,
    }),
    db.outreachEmail.aggregate({
      _count: true,
    }),
    db.pool.groupBy({
      by: ["status"],
      _count: true,
    }),
  ])

  const emailBreakdown = await db.outreachEmail.groupBy({
    by: ["step"],
    _count: true,
  })

  const openedCount = await db.outreachEmail.count({
    where: { openedAt: { not: null } },
  })
  const repliedCount = await db.outreachEmail.count({
    where: { repliedAt: { not: null } },
  })

  const totalSent = emailStats._count
  const openRate = totalSent > 0 ? ((openedCount / totalSent) * 100).toFixed(1) : "0"
  const replyRate = totalSent > 0 ? ((repliedCount / totalSent) * 100).toFixed(1) : "0"

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Metrics</h1>

      {/* Email performance */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-sm">Total Emails Sent</p>
          <p className="text-3xl font-bold text-white mt-1">{totalSent}</p>
        </div>
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-sm">Opened</p>
          <p className="text-3xl font-bold text-blue-400 mt-1">{openedCount}</p>
          <p className="text-xs text-gray-500">{openRate}% rate</p>
        </div>
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-sm">Replied</p>
          <p className="text-3xl font-bold text-purple-400 mt-1">{repliedCount}</p>
          <p className="text-xs text-gray-500">{replyRate}% rate</p>
        </div>
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-gray-400 text-sm">Introductions</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {await db.introduction.count()}
          </p>
        </div>
      </div>

      {/* Activation funnel */}
      <div className="p-6 bg-gray-900 rounded-xl border border-gray-800 mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">
          Activation Funnel
        </h2>
        <div className="space-y-3">
          {activationStats.map((stat) => (
            <div key={`${stat.status}-${stat.side}`} className="flex items-center gap-4">
              <span className="text-xs text-gray-500 w-24 uppercase">
                {stat.side}
              </span>
              <span className="text-xs text-gray-400 w-40">
                {stat.status.replace(/_/g, " ")}
              </span>
              <div className="flex-1 bg-gray-800 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full"
                  style={{ width: `${Math.min(100, stat._count * 5)}%` }}
                />
              </div>
              <span className="text-white text-sm font-mono w-10 text-right">
                {stat._count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Pool status breakdown */}
      <div className="grid grid-cols-2 gap-6">
        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">
            Pool Status
          </h2>
          <div className="space-y-2">
            {poolStats.map((stat) => (
              <div key={stat.status} className="flex justify-between">
                <span className="text-gray-400 text-sm">{stat.status}</span>
                <span className="text-white font-mono">{stat._count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-gray-900 rounded-xl border border-gray-800">
          <h2 className="text-lg font-semibold text-white mb-4">
            Email Steps
          </h2>
          <div className="space-y-2">
            {emailBreakdown.map((stat) => (
              <div key={stat.step} className="flex justify-between">
                <span className="text-gray-400 text-sm">{stat.step}</span>
                <span className="text-white font-mono">{stat._count}</span>
              </div>
            ))}
            {emailBreakdown.length === 0 && (
              <p className="text-gray-500 text-sm">No emails sent yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
