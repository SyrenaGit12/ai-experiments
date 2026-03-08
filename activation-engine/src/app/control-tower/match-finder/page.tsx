"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"
import { SYRENA_INDUSTRIES } from "@/lib/constants"

interface SyrenaResult {
  investorId?: string
  founderId?: string
  userId: string
  email: string
  firstName: string
  lastName: string
  industries: string[]
  bio: string | null
  linkedinUrl: string | null
  userStatus: string
  lastLogin: string | null
  // Investor fields
  investorType?: string
  fundingStages?: string[]
  preferredLocations?: string[]
  investmentActivity?: string
  // Founder fields
  companyName?: string
  fundingStage?: string
  chequeSizesAccepted?: string[]
  targetRaiseAmount?: number
  websiteUrl?: string
}

export default function MatchFinderPageWrapper() {
  return (
    <Suspense fallback={<div className="text-gray-400 py-8 text-center">Loading...</div>}>
      <MatchFinderPage />
    </Suspense>
  )
}

function MatchFinderPage() {
  const searchParams = useSearchParams()
  const forRecordId = searchParams.get("for")
  const defaultSide = searchParams.get("side") ?? "FOUNDER"

  const [side, setSide] = useState(defaultSide)
  const [industry, setIndustry] = useState("")
  const [search, setSearch] = useState("")
  const [results, setResults] = useState<SyrenaResult[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState("")

  async function handleSearch() {
    setLoading(true)
    setMessage("")
    const params = new URLSearchParams({ side })
    if (industry) params.set("industry", industry)
    if (search) params.set("search", search)
    params.set("limit", "30")

    const res = await fetch(`/api/syrena/search?${params}`)
    const data = await res.json()
    setResults(data.results ?? [])
    if ((data.results ?? []).length === 0) {
      setMessage("No results found. Try adjusting your filters.")
    }
    setLoading(false)
  }

  async function addToPipeline(user: SyrenaResult) {
    setAdding(user.userId)
    try {
      const res = await fetch("/api/activation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          syrenaUserId: user.userId,
          side: side === "INVESTOR" ? "INVESTOR" : "FOUNDER",
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          company: user.companyName ?? null,
          industry: user.industries?.[0] ?? "AI_MACHINE_LEARNING",
          fundingStage: user.fundingStage ?? (user.fundingStages?.[0] ?? null),
        }),
      })
      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(user.userId))
      } else {
        const err = await res.json()
        alert(`Error: ${err.error ?? "Failed to add"}`)
      }
    } finally {
      setAdding(null)
    }
  }

  async function addAsMatch(user: SyrenaResult) {
    if (!forRecordId) return
    setAdding(user.userId)
    try {
      const res = await fetch(`/api/activation/${forRecordId}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchSyrenaUserId: user.userId,
          matchSide: side === "INVESTOR" ? "INVESTOR" : "FOUNDER",
          matchName: `${user.firstName} ${user.lastName}`,
          matchEmail: user.email,
          matchCompany: user.companyName ?? null,
          matchIndustry: user.industries?.[0] ?? null,
        }),
      })
      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(user.userId))
      } else {
        const err = await res.json()
        alert(`Error: ${err.error ?? "Failed to add match"}`)
      }
    } finally {
      setAdding(null)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Match Finder</h1>
        <p className="text-sm text-gray-400 mt-1">
          Search Syrena&apos;s database to find investors and founders
          {forRecordId && <span className="text-blue-400"> — Adding matches to record</span>}
        </p>
      </div>

      {/* Search Controls */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <div className="flex flex-wrap gap-3">
          <div className="flex bg-gray-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setSide("INVESTOR")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                side === "INVESTOR"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Investors
            </button>
            <button
              onClick={() => setSide("FOUNDER")}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                side === "FOUNDER"
                  ? "bg-emerald-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Founders
            </button>
          </div>

          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            <option value="">All Industries</option>
            {SYRENA_INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind.replace(/_/g, " ")}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search name, email, company..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm flex-1 min-w-[200px] placeholder:text-gray-500"
          />

          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {/* Results */}
      {message && (
        <p className="text-gray-400 text-sm py-4 text-center">{message}</p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          <p className="text-gray-500 text-xs">{results.length} results</p>
          {results.map((user) => {
            const isAdded = addedIds.has(user.userId)
            const isAdding = adding === user.userId
            return (
              <div
                key={user.userId}
                className={`bg-gray-900 rounded-xl border p-4 transition-colors ${
                  isAdded ? "border-green-700/50 bg-green-950/10" : "border-gray-800"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      {user.investorType && (
                        <span className="text-xs text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded">
                          {user.investorType.replace(/_/g, " ")}
                        </span>
                      )}
                      {user.companyName && (
                        <span className="text-xs text-emerald-400">@ {user.companyName}</span>
                      )}
                      {user.investmentActivity && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          user.investmentActivity === "ACTIVE" ? "bg-green-900/30 text-green-400" :
                          user.investmentActivity === "OPEN" ? "bg-amber-900/30 text-amber-400" :
                          "bg-gray-800 text-gray-500"
                        }`}>
                          {user.investmentActivity}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">{user.email}</p>
                    {user.bio && (
                      <p className="text-gray-300 text-sm mt-1 line-clamp-2">{user.bio}</p>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(user.industries ?? []).map((ind) => (
                        <span
                          key={ind}
                          className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded"
                        >
                          {ind.replace(/_/g, " ")}
                        </span>
                      ))}
                      {user.fundingStage && (
                        <span className="text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded">
                          {user.fundingStage.replace(/_/g, " ")}
                        </span>
                      )}
                      {(user.fundingStages ?? []).map((fs) => (
                        <span key={fs} className="text-xs bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded">
                          {fs.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                    {user.lastLogin && (
                      <p className="text-gray-600 text-xs mt-1">
                        Last login: {new Date(user.lastLogin).toLocaleDateString()}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4 shrink-0">
                    {forRecordId ? (
                      <button
                        onClick={() => addAsMatch(user)}
                        disabled={isAdded || isAdding}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          isAdded
                            ? "bg-green-800 text-green-200 cursor-default"
                            : "bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                        }`}
                      >
                        {isAdded ? "Added ✓" : isAdding ? "Adding..." : "Add as Match"}
                      </button>
                    ) : (
                      <button
                        onClick={() => addToPipeline(user)}
                        disabled={isAdded || isAdding}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          isAdded
                            ? "bg-green-800 text-green-200 cursor-default"
                            : "bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                        }`}
                      >
                        {isAdded ? "Added ✓" : isAdding ? "Adding..." : "Add to Pipeline"}
                      </button>
                    )}
                    {user.linkedinUrl && (
                      <a
                        href={user.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm hover:bg-gray-700"
                      >
                        LinkedIn
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
