"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useToast } from "@/components/ui/toast"
import { SYRENA_INDUSTRIES } from "@/lib/constants"

interface PoolRow {
  id: string
  industry: string
  status: string
  investorCount: number
  founderCount: number
  createdAt: string
  _count: { members: number; pairs: number }
}

export default function PoolsPage() {
  const [pools, setPools] = useState<PoolRow[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedIndustry, setSelectedIndustry] = useState("")
  const toast = useToast()

  useEffect(() => {
    fetchPools()
  }, [])

  async function fetchPools() {
    const res = await fetch("/api/pools")
    const data = await res.json()
    setPools(data)
    setLoading(false)
  }

  async function handleGenerate() {
    if (!selectedIndustry) return
    setGenerating(true)
    try {
      const res = await fetch("/api/pool-generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: selectedIndustry }),
      })
      if (res.ok) {
        await fetchPools()
      } else {
        const err = await res.json()
        toast.error(err.error || "Pool generation failed")
      }
    } finally {
      setGenerating(false)
    }
  }

  const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-700 text-gray-300",
    APPROVED: "bg-blue-900/50 text-blue-300",
    ACTIVE: "bg-green-900/50 text-green-300",
    CLOSED: "bg-gray-800 text-gray-500",
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Pools</h1>

        <div className="flex items-center gap-3">
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
          >
            <option value="">Select industry...</option>
            {SYRENA_INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {ind.replace(/_/g, " ")}
              </option>
            ))}
          </select>

          <button
            onClick={handleGenerate}
            disabled={!selectedIndustry || generating}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? "Generating..." : "Generate Pool"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : pools.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No pools yet</p>
          <p className="text-sm">
            Select an industry above and click Generate Pool to create your
            first pool.
          </p>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-4 text-xs text-gray-500 uppercase">
                  Industry
                </th>
                <th className="text-left p-4 text-xs text-gray-500 uppercase">
                  Status
                </th>
                <th className="text-center p-4 text-xs text-gray-500 uppercase">
                  Investors
                </th>
                <th className="text-center p-4 text-xs text-gray-500 uppercase">
                  Founders
                </th>
                <th className="text-center p-4 text-xs text-gray-500 uppercase">
                  Pairs
                </th>
                <th className="text-left p-4 text-xs text-gray-500 uppercase">
                  Created
                </th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {pools.map((pool) => (
                <tr
                  key={pool.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="p-4 text-white text-sm">
                    {pool.industry.replace(/_/g, " ")}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[pool.status] ?? ""}`}
                    >
                      {pool.status}
                    </span>
                  </td>
                  <td className="p-4 text-center text-gray-300 text-sm">
                    {pool.investorCount}
                  </td>
                  <td className="p-4 text-center text-gray-300 text-sm">
                    {pool.founderCount}
                  </td>
                  <td className="p-4 text-center text-gray-300 text-sm">
                    {pool._count.pairs}
                  </td>
                  <td className="p-4 text-gray-400 text-sm">
                    {new Date(pool.createdAt).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <Link
                      href={`/control-tower/pools/${pool.id}`}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
