"use client"

interface Pair {
  id: string
  investorId: string
  founderId: string
  investorName: string | null
  founderName: string | null
  investorSelected: boolean
  founderSelected: boolean
  crossMatchOutcome: string | null
  presentedToInvestor: boolean
  presentedToFounder: boolean
  score: number
}

interface CrossMatchMatrixProps {
  pairs: Pair[]
  onCellClick: (pair: Pair) => void
}

const outcomeConfig: Record<
  string,
  { label: string; bg: string; text: string; emoji: string }
> = {
  MUTUAL_YES: {
    label: "Mutual",
    bg: "bg-green-900/60",
    text: "text-green-300",
    emoji: "🟢",
  },
  INVESTOR_ONLY: {
    label: "Inv only",
    bg: "bg-blue-900/40",
    text: "text-blue-300",
    emoji: "🔵",
  },
  FOUNDER_ONLY: {
    label: "Fnd only",
    bg: "bg-blue-900/40",
    text: "text-blue-300",
    emoji: "🔵",
  },
  NO_MATCH: {
    label: "No match",
    bg: "bg-red-900/30",
    text: "text-red-400",
    emoji: "🔴",
  },
  PENDING: {
    label: "Pending",
    bg: "bg-yellow-900/20",
    text: "text-yellow-400",
    emoji: "🟡",
  },
}

export function CrossMatchMatrix({ pairs, onCellClick }: CrossMatchMatrixProps) {
  // Get unique investors and founders from presented pairs
  const investorIds = [
    ...new Set(
      pairs
        .filter((p) => p.presentedToInvestor || p.presentedToFounder)
        .map((p) => p.investorId)
    ),
  ]
  const founderIds = [
    ...new Set(
      pairs
        .filter((p) => p.presentedToInvestor || p.presentedToFounder)
        .map((p) => p.founderId)
    ),
  ]

  // Build lookup: investorId_founderId → pair
  const pairLookup = new Map(
    pairs.map((p) => [`${p.investorId}_${p.founderId}`, p])
  )

  // Name lookups
  const investorNames = new Map<string, string>()
  const founderNames = new Map<string, string>()
  for (const p of pairs) {
    if (p.investorName) investorNames.set(p.investorId, p.investorName)
    if (p.founderName) founderNames.set(p.founderId, p.founderName)
  }

  // Summary counts
  const presented = pairs.filter(
    (p) => p.presentedToInvestor || p.presentedToFounder
  )
  const summary = {
    mutualYes: presented.filter((p) => p.crossMatchOutcome === "MUTUAL_YES")
      .length,
    pending: presented.filter(
      (p) => p.crossMatchOutcome === "PENDING" || !p.crossMatchOutcome
    ).length,
    oneSided: presented.filter(
      (p) =>
        p.crossMatchOutcome === "INVESTOR_ONLY" ||
        p.crossMatchOutcome === "FOUNDER_ONLY"
    ).length,
    noMatch: presented.filter((p) => p.crossMatchOutcome === "NO_MATCH")
      .length,
  }

  if (investorIds.length === 0 || founderIds.length === 0) {
    return (
      <div className="text-gray-500 text-sm py-8 text-center">
        No presented pairs to display. Send A1/B1 emails first.
      </div>
    )
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-1.5 text-xs">
          <span>🟢</span>
          <span className="text-green-300 font-medium">{summary.mutualYes} Mutual</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span>🟡</span>
          <span className="text-yellow-400 font-medium">{summary.pending} Pending</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span>🔵</span>
          <span className="text-blue-300 font-medium">{summary.oneSided} One-sided</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs">
          <span>🔴</span>
          <span className="text-red-400 font-medium">{summary.noMatch} No match</span>
        </div>
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs text-gray-500 min-w-[140px]">
                Investor ↓ / Founder →
              </th>
              {founderIds.map((fId) => (
                <th
                  key={fId}
                  className="p-2 text-xs text-gray-400 font-medium min-w-[100px]"
                >
                  <div className="truncate max-w-[100px]">
                    {founderNames.get(fId)?.split(" ")[0] ?? "Unknown"}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {investorIds.map((iId) => (
              <tr key={iId}>
                <td className="p-2 text-sm text-white font-medium">
                  <div className="truncate max-w-[140px]">
                    {investorNames.get(iId) ?? "Unknown"}
                  </div>
                </td>
                {founderIds.map((fId) => {
                  const pair = pairLookup.get(`${iId}_${fId}`)
                  if (!pair || (!pair.presentedToInvestor && !pair.presentedToFounder)) {
                    return (
                      <td
                        key={fId}
                        className="p-1"
                      >
                        <div className="h-12 rounded bg-gray-900/30 flex items-center justify-center text-gray-700 text-xs">
                          —
                        </div>
                      </td>
                    )
                  }

                  const outcome = pair.crossMatchOutcome ?? "PENDING"
                  const config = outcomeConfig[outcome] ?? outcomeConfig.PENDING

                  return (
                    <td key={fId} className="p-1">
                      <button
                        onClick={() => onCellClick(pair)}
                        className={`w-full h-12 rounded ${config.bg} border border-gray-800 flex flex-col items-center justify-center gap-0.5 hover:border-gray-600 transition-colors cursor-pointer`}
                      >
                        <span className="text-sm">{config.emoji}</span>
                        <span className={`text-[10px] ${config.text}`}>
                          {config.label}
                        </span>
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
