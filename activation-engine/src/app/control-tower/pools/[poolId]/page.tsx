"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

interface PoolDetail {
  id: string
  industry: string
  status: string
  slaHours: number
  approvedBy: string | null
  approvedAt: string | null
  activatedAt: string | null
  createdAt: string
  members: {
    id: string
    userId: string
    side: string
    displayName: string | null
    email: string | null
    investorTier: string | null
    engagementScore: number
    status: string
  }[]
  pairs: {
    id: string
    investorId: string
    founderId: string
    investorName: string | null
    founderName: string | null
    score: number
    rank: number
    status: string
    matchScore: {
      industryScore: number
      locationScore: number
      stageScore: number
      chequeSizeScore: number
      engagementScore: number
      totalScore: number
    } | null
  }[]
  events: {
    id: string
    type: string
    createdAt: string
    payload: unknown
  }[]
}

export default function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>()
  const [pool, setPool] = useState<PoolDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"members" | "pairs" | "timeline">(
    "members"
  )
  const [actionLoading, setActionLoading] = useState("")

  useEffect(() => {
    fetchPool()
  }, [poolId])

  async function fetchPool() {
    const res = await fetch(`/api/pools/${poolId}`)
    const data = await res.json()
    setPool(data)
    setLoading(false)
  }

  async function handleApprove() {
    setActionLoading("approve")
    await fetch(`/api/pools/${poolId}/approve`, { method: "POST" })
    await fetchPool()
    setActionLoading("")
  }

  async function handleSendEmails(side: "INVESTOR" | "FOUNDER") {
    setActionLoading(`send-${side}`)
    const res = await fetch(`/api/pools/${poolId}/trigger-emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side }),
    })
    if (!res.ok) {
      const err = await res.json()
      alert(err.error)
    }
    await fetchPool()
    setActionLoading("")
  }

  if (loading) return <p className="text-gray-400">Loading...</p>
  if (!pool) return <p className="text-red-400">Pool not found</p>

  const investors = pool.members.filter((m) => m.side === "INVESTOR")
  const founders = pool.members.filter((m) => m.side === "FOUNDER")

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-700 text-gray-300",
    APPROVED: "bg-blue-900/50 text-blue-300",
    ACTIVE: "bg-green-900/50 text-green-300",
    CLOSED: "bg-gray-800 text-gray-500",
  }

  const tierColors: Record<string, string> = {
    HOT: "text-red-400",
    WARM: "text-amber-400",
    GAP_FILL: "text-gray-400",
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/control-tower/pools"
          className="text-gray-400 hover:text-white"
        >
          Pools
        </Link>
        <span className="text-gray-600">/</span>
        <h1 className="text-2xl font-bold text-white">
          {pool.industry.replace(/_/g, " ")}
        </h1>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[pool.status] ?? ""}`}
        >
          {pool.status}
        </span>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500">Investors</p>
          <p className="text-xl font-bold text-white">{investors.length}</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500">Founders</p>
          <p className="text-xl font-bold text-white">{founders.length}</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500">Pairs</p>
          <p className="text-xl font-bold text-white">{pool.pairs.length}</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500">SLA</p>
          <p className="text-xl font-bold text-white">{pool.slaHours}h</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6">
        {pool.status === "DRAFT" && (
          <button
            onClick={handleApprove}
            disabled={actionLoading === "approve"}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {actionLoading === "approve" ? "Approving..." : "Approve Pool"}
          </button>
        )}
        {(pool.status === "APPROVED" || pool.status === "ACTIVE") && (
          <>
            <button
              onClick={() => handleSendEmails("INVESTOR")}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
            >
              {actionLoading === "send-INVESTOR"
                ? "Sending..."
                : "Send A1 Emails (Investors)"}
            </button>
            <button
              onClick={() => handleSendEmails("FOUNDER")}
              disabled={!!actionLoading}
              className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors"
            >
              {actionLoading === "send-FOUNDER"
                ? "Sending..."
                : "Send B1 Emails (Founders)"}
            </button>
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {(["members", "pairs", "timeline"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-blue-500"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "members" && (
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase">
              Investors ({investors.length})
            </h3>
            <div className="space-y-2">
              {investors.map((m) => (
                <div
                  key={m.id}
                  className="p-4 bg-gray-900 rounded-lg border border-gray-800"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">
                        {m.displayName ?? "Unknown"}
                      </p>
                      <p className="text-gray-500 text-xs">{m.email}</p>
                    </div>
                    {m.investorTier && (
                      <span
                        className={`text-xs font-semibold ${tierColors[m.investorTier] ?? ""}`}
                      >
                        {m.investorTier}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-1">
                    Score: {m.engagementScore.toFixed(1)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase">
              Founders ({founders.length})
            </h3>
            <div className="space-y-2">
              {founders.map((m) => (
                <div
                  key={m.id}
                  className="p-4 bg-gray-900 rounded-lg border border-gray-800"
                >
                  <p className="text-white font-medium">
                    {m.displayName ?? "Unknown"}
                  </p>
                  <p className="text-gray-500 text-xs">{m.email}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "pairs" && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-3 text-xs text-gray-500">#</th>
                <th className="text-left p-3 text-xs text-gray-500">
                  Investor
                </th>
                <th className="text-left p-3 text-xs text-gray-500">
                  Founder
                </th>
                <th className="text-center p-3 text-xs text-gray-500">
                  Score
                </th>
                <th className="text-center p-3 text-xs text-gray-500">
                  Status
                </th>
                <th className="text-right p-3 text-xs text-gray-500">
                  Breakdown
                </th>
              </tr>
            </thead>
            <tbody>
              {pool.pairs.map((pair) => (
                <tr
                  key={pair.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="p-3 text-gray-500 text-sm">{pair.rank}</td>
                  <td className="p-3 text-white text-sm">
                    {pair.investorName}
                  </td>
                  <td className="p-3 text-white text-sm">
                    {pair.founderName}
                  </td>
                  <td className="p-3 text-center text-white text-sm font-mono">
                    {pair.score.toFixed(1)}
                  </td>
                  <td className="p-3 text-center">
                    <span className="text-xs text-gray-400">{pair.status}</span>
                  </td>
                  <td className="p-3 text-right text-xs text-gray-500 font-mono">
                    {pair.matchScore
                      ? `I:${pair.matchScore.industryScore.toFixed(0)} L:${pair.matchScore.locationScore.toFixed(0)} S:${pair.matchScore.stageScore.toFixed(0)} C:${pair.matchScore.chequeSizeScore.toFixed(0)} E:${pair.matchScore.engagementScore.toFixed(0)}`
                      : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="space-y-3">
          {pool.events.map((event) => (
            <div
              key={event.id}
              className="flex gap-4 p-3 bg-gray-900 rounded-lg border border-gray-800"
            >
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {new Date(event.createdAt).toLocaleString()}
              </span>
              <span className="text-sm text-white">{event.type}</span>
              <span className="text-xs text-gray-500 truncate">
                {JSON.stringify(event.payload)}
              </span>
            </div>
          ))}
          {pool.events.length === 0 && (
            <p className="text-gray-500 text-sm">No events yet</p>
          )}
        </div>
      )}
    </div>
  )
}
