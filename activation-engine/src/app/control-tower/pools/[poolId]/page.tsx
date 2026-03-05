"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { StageProgress } from "@/components/control-tower/stage-progress"
import { CrossMatchMatrix } from "@/components/control-tower/cross-match-matrix"
import { PersonalizationReview } from "@/components/control-tower/personalization-review"
import { SelectionModal } from "@/components/control-tower/selection-modal"
import { FeedbackForm } from "@/components/control-tower/feedback-form"

interface PoolMember {
  id: string
  userId: string
  side: string
  displayName: string | null
  email: string | null
  investorTier: string | null
  engagementScore: number
  status: string
  stage: number
  matchesPresentedIds: string[] | null
  selectedMatchIds: string[] | null
  respondedAt: string | null
  stageCompletedAt: string | null
}

interface PoolPair {
  id: string
  investorId: string
  founderId: string
  investorName: string | null
  founderName: string | null
  investorEmail: string | null
  founderEmail: string | null
  score: number
  rank: number
  status: string
  presentedToInvestor: boolean
  presentedToFounder: boolean
  investorSelected: boolean
  founderSelected: boolean
  crossMatchOutcome: string | null
  investorFeedback: string | null
  investorFeedbackPositive: boolean | null
  founderFeedback: string | null
  founderFeedbackPositive: boolean | null
  feedbackDeliveredAt: string | null
  matchScore: {
    industryScore: number
    locationScore: number
    stageScore: number
    chequeSizeScore: number
    engagementScore: number
    totalScore: number
  } | null
  personalizationLines: {
    id: string
    side: string
    line: string
    approved: boolean
  }[]
}

interface PoolDetail {
  id: string
  industry: string
  status: string
  slaHours: number
  isTestPool: boolean
  approvedBy: string | null
  approvedAt: string | null
  activatedAt: string | null
  createdAt: string
  members: PoolMember[]
  pairs: PoolPair[]
  events: {
    id: string
    type: string
    createdAt: string
    payload: unknown
  }[]
}

type Tab = "stage-progress" | "pairs" | "cross-match" | "personalization" | "timeline"

export default function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>()
  const [pool, setPool] = useState<PoolDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>("stage-progress")
  const [actionLoading, setActionLoading] = useState("")

  // Modal state
  const [selectionMember, setSelectionMember] = useState<PoolMember | null>(null)
  const [feedbackPair, setFeedbackPair] = useState<PoolPair | null>(null)

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

  async function handleExportCSV() {
    window.open(`/api/pools/${poolId}/export`, "_blank")
  }

  if (loading) return <p className="text-gray-400">Loading...</p>
  if (!pool) return <p className="text-red-400">Pool not found</p>

  const investors = pool.members.filter((m) => m.side === "INVESTOR")
  const founders = pool.members.filter((m) => m.side === "FOUNDER")

  // Check personalization readiness
  const presentedPairs = pool.pairs.filter(
    (p) => p.presentedToInvestor || p.presentedToFounder
  )
  const allLinesApproved =
    presentedPairs.length > 0 &&
    presentedPairs.every((p) => {
      const lines = p.personalizationLines ?? []
      const investorLine = p.presentedToInvestor
        ? lines.find((l) => l.side === "INVESTOR")
        : null
      const founderLine = p.presentedToFounder
        ? lines.find((l) => l.side === "FOUNDER")
        : null
      const investorOk = !p.presentedToInvestor || (investorLine?.approved ?? false)
      const founderOk = !p.presentedToFounder || (founderLine?.approved ?? false)
      return investorOk && founderOk
    })

  // Stage summary
  const membersAtStage = (stage: number) =>
    pool.members.filter((m) => m.stage >= stage).length
  const totalMembers = pool.members.length

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-700 text-gray-300",
    APPROVED: "bg-blue-900/50 text-blue-300",
    ACTIVE: "bg-green-900/50 text-green-300",
    CLOSED: "bg-gray-800 text-gray-500",
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "stage-progress", label: "Stage Progress" },
    { key: "pairs", label: "Pairs" },
    { key: "cross-match", label: "Cross-Match" },
    { key: "personalization", label: "Personalization" },
    { key: "timeline", label: "Timeline" },
  ]

  return (
    <div>
      {/* Header */}
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
        {pool.isTestPool && (
          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-amber-900/50 text-amber-300 border border-amber-700">
            TEST POOL
          </span>
        )}
      </div>

      {/* Metadata cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
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
          <p className="text-xs text-gray-600">
            {presentedPairs.length} presented
          </p>
        </div>
        <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500">Stage Progress</p>
          <p className="text-xl font-bold text-white">
            {membersAtStage(3)}/{totalMembers}
          </p>
          <p className="text-xs text-gray-600">completed</p>
        </div>
        <div className="p-4 bg-gray-900 rounded-xl border border-gray-800">
          <p className="text-xs text-gray-500">SLA</p>
          <p className="text-xl font-bold text-white">{pool.slaHours}h</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mb-6 flex-wrap">
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
              disabled={!!actionLoading || !allLinesApproved}
              className="px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors"
              title={
                !allLinesApproved
                  ? "Approve all personalization lines first"
                  : undefined
              }
            >
              {actionLoading === "send-INVESTOR"
                ? "Sending..."
                : "Send A1 Emails (Investors)"}
            </button>
            <button
              onClick={() => handleSendEmails("FOUNDER")}
              disabled={!!actionLoading || !allLinesApproved}
              className="px-4 py-2 bg-purple-700 text-white rounded-lg text-sm font-medium hover:bg-purple-600 disabled:opacity-50 transition-colors"
              title={
                !allLinesApproved
                  ? "Approve all personalization lines first"
                  : undefined
              }
            >
              {actionLoading === "send-FOUNDER"
                ? "Sending..."
                : "Send B1 Emails (Founders)"}
            </button>
          </>
        )}
        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-600 transition-colors"
        >
          Export CSV
        </button>
      </div>

      {/* Personalization gate warning */}
      {(pool.status === "APPROVED" || pool.status === "ACTIVE") &&
        !allLinesApproved &&
        presentedPairs.length > 0 && (
          <div className="p-3 mb-4 bg-amber-900/20 border border-amber-800/30 rounded-lg text-xs text-amber-300">
            Emails are gated — approve all personalization lines before
            sending. Go to the{" "}
            <button
              onClick={() => setActiveTab("personalization")}
              className="underline hover:text-amber-200"
            >
              Personalization tab
            </button>{" "}
            to review.
          </div>
        )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-white border-b-2 border-blue-500"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "stage-progress" && (
        <StageProgress
          members={pool.members}
          onRecordSelection={(member) => setSelectionMember(member as PoolMember)}
        />
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
                  Presented
                </th>
                <th className="text-center p-3 text-xs text-gray-500">
                  Outcome
                </th>
                <th className="text-right p-3 text-xs text-gray-500">
                  Breakdown
                </th>
              </tr>
            </thead>
            <tbody>
              {pool.pairs.map((pair) => {
                const presented =
                  pair.presentedToInvestor || pair.presentedToFounder
                const outcome = pair.crossMatchOutcome
                const outcomeColors: Record<string, string> = {
                  MUTUAL_YES: "text-green-300",
                  INVESTOR_ONLY: "text-blue-300",
                  FOUNDER_ONLY: "text-blue-300",
                  NO_MATCH: "text-red-400",
                  PENDING: "text-yellow-400",
                }

                return (
                  <tr
                    key={pair.id}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30"
                  >
                    <td className="p-3 text-gray-500 text-sm">{pair.rank}</td>
                    <td className="p-3 text-white text-sm">
                      {pair.investorName}
                      {pair.investorSelected && (
                        <span className="ml-1 text-green-400 text-xs">✓</span>
                      )}
                    </td>
                    <td className="p-3 text-white text-sm">
                      {pair.founderName}
                      {pair.founderSelected && (
                        <span className="ml-1 text-green-400 text-xs">✓</span>
                      )}
                    </td>
                    <td className="p-3 text-center text-white text-sm font-mono">
                      {pair.score.toFixed(1)}
                    </td>
                    <td className="p-3 text-center text-xs">
                      {presented ? (
                        <span className="text-green-400">Yes</span>
                      ) : (
                        <span className="text-gray-600">No</span>
                      )}
                    </td>
                    <td className="p-3 text-center">
                      {outcome ? (
                        <span
                          className={`text-xs font-medium ${outcomeColors[outcome] ?? "text-gray-400"}`}
                        >
                          {outcome.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="p-3 text-right text-xs text-gray-500 font-mono">
                      {pair.matchScore
                        ? `I:${pair.matchScore.industryScore.toFixed(0)} L:${pair.matchScore.locationScore.toFixed(0)} S:${pair.matchScore.stageScore.toFixed(0)} C:${pair.matchScore.chequeSizeScore.toFixed(0)} E:${pair.matchScore.engagementScore.toFixed(0)}`
                        : "-"}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === "cross-match" && (
        <CrossMatchMatrix
          pairs={pool.pairs}
          onCellClick={(pair) => setFeedbackPair(pair as PoolPair)}
        />
      )}

      {activeTab === "personalization" && (
        <PersonalizationReview poolId={poolId} onRefresh={fetchPool} />
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

      {/* Selection Modal */}
      {selectionMember && (
        <SelectionModal
          member={selectionMember}
          pairs={pool.pairs}
          poolId={poolId}
          onClose={() => setSelectionMember(null)}
          onSaved={() => {
            setSelectionMember(null)
            fetchPool()
          }}
        />
      )}

      {/* Feedback Form */}
      {feedbackPair && (
        <FeedbackForm
          pair={feedbackPair}
          poolId={poolId}
          onClose={() => setFeedbackPair(null)}
          onSaved={() => {
            setFeedbackPair(null)
            fetchPool()
          }}
        />
      )}
    </div>
  )
}
