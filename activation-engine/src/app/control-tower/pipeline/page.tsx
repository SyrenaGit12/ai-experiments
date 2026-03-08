"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { STAGES, STAGE_LABELS, STAGE_BADGE_COLORS, TEAM_MEMBERS, SYRENA_INDUSTRIES } from "@/lib/constants"
import type { ActivationRecordClient as ActivationRecord, ActivationListResponse } from "@/lib/types"
import { useToast } from "@/components/ui/toast"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

export default function PipelinePage() {
  const [records, setRecords] = useState<ActivationRecord[]>([])
  const [total, setTotal] = useState(0)
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const toast = useToast()
  const [page, setPage] = useState(0)
  const pageSize = 50

  // Filters
  const [filterSide, setFilterSide] = useState("")
  const [filterStage, setFilterStage] = useState("")
  const [filterOwner, setFilterOwner] = useState("")
  const [filterIndustry, setFilterIndustry] = useState("")
  const [searchInput, setSearchInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState("")
  const [bulkValue, setBulkValue] = useState("")
  const [bulkLoading, setBulkLoading] = useState(false)
  const [showBulkConfirm, setShowBulkConfirm] = useState(false)

  // Debounce search: update searchQuery 300ms after user stops typing
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearchQuery(searchInput)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchInput])

  const fetchRecords = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterSide) params.set("side", filterSide)
      if (filterStage) params.set("stage", filterStage)
      if (filterOwner) params.set("owner", filterOwner)
      if (filterIndustry) params.set("industry", filterIndustry)
      if (searchQuery) params.set("search", searchQuery)
      params.set("limit", String(pageSize))
      params.set("offset", String(page * pageSize))

      const res = await fetch(`/api/activation?${params}`)
      const data: ActivationListResponse = await res.json()
      setRecords(data.records ?? [])
      setTotal(data.total ?? 0)
      setStageCounts(data.stageCounts ?? {})
    } catch {
      if (!silent) toast.error("Failed to load pipeline data")
    } finally {
      if (!silent) setLoading(false)
    }
  }, [filterSide, filterStage, filterOwner, filterIndustry, searchQuery, page, toast])

  // Reset to first page when filters change
  useEffect(() => {
    setPage(0)
  }, [filterSide, filterStage, filterOwner, filterIndustry, searchQuery])

  // Clear selection when records change
  useEffect(() => {
    setSelectedIds(new Set())
  }, [records])

  useEffect(() => {
    fetchRecords()
  }, [fetchRecords])

  // Auto-refresh every 30s (silent — no loading flash)
  useEffect(() => {
    const interval = setInterval(() => fetchRecords(true), 30_000)
    return () => clearInterval(interval)
  }, [fetchRecords])

  function isSLAOverdue(rec: ActivationRecord) {
    if (!rec.slaDeadline) return false
    if (["ACTIVATED", "STALLED", "DECLINED"].includes(rec.stage)) return false
    return new Date(rec.slaDeadline) < new Date()
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedIds.size === records.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(records.map((r) => r.id)))
    }
  }

  async function executeBulkAction() {
    if (selectedIds.size === 0 || !bulkAction) return

    setBulkLoading(true)
    try {
      const payload: Record<string, unknown> = {
        ids: Array.from(selectedIds),
        action: bulkAction,
        actor: "Control Tower",
      }

      if (bulkAction === "assign_owner") {
        payload.value = bulkValue || null
      } else if (bulkAction === "set_stage") {
        if (!bulkValue) {
          setBulkLoading(false)
          return
        }
        payload.value = bulkValue
      }

      const res = await fetch("/api/activation/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        const data = await res.json()
        // Reset selection and refresh
        setSelectedIds(new Set())
        setBulkAction("")
        setBulkValue("")
        await fetchRecords()
        toast.success(`Bulk action complete: ${data.updated} records updated`)
      } else {
        const err = await res.json().catch(() => ({}))
        console.error("Bulk action failed:", err)
        toast.error("Bulk action failed")
      }
    } catch (err) {
      console.error("Bulk action error:", err)
      toast.error("Bulk action failed")
    } finally {
      setBulkLoading(false)
    }
  }

  const allSelected = records.length > 0 && selectedIds.size === records.length
  const someSelected = selectedIds.size > 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Activation Pipeline</h1>
          <p className="text-sm text-gray-400 mt-1">
            {total} records{filterSide || filterStage || filterOwner ? " (filtered)" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/control-tower/match-finder"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors"
          >
            + Add to Pipeline
          </Link>
          <a
            href="/api/activation/export"
            className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors border border-gray-700"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search name, email, company..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm w-64 placeholder:text-gray-500"
        />
        <select
          value={filterSide}
          onChange={(e) => setFilterSide(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="">All Sides</option>
          <option value="INVESTOR">Investors</option>
          <option value="FOUNDER">Founders</option>
        </select>
        <select
          value={filterStage}
          onChange={(e) => setFilterStage(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="">All Stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={filterOwner}
          onChange={(e) => setFilterOwner(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="">All Owners</option>
          {TEAM_MEMBERS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <select
          value={filterIndustry}
          onChange={(e) => setFilterIndustry(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="">All Industries</option>
          {SYRENA_INDUSTRIES.map((ind) => (
            <option key={ind} value={ind}>{ind.replace(/_/g, " ")}</option>
          ))}
        </select>
        {(filterSide || filterStage || filterOwner || filterIndustry || searchInput) && (
          <button
            onClick={() => {
              setFilterSide("")
              setFilterStage("")
              setFilterOwner("")
              setFilterIndustry("")
              setSearchInput("")
            }}
            className="px-3 py-2 text-gray-400 hover:text-white text-sm"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Stage summary chips — server-side totals, independent of pagination */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STAGES.filter(s => !["STALLED", "DECLINED"].includes(s)).map((s) => {
          const count = stageCounts[s] ?? 0
          return (
            <button
              key={s}
              onClick={() => setFilterStage(filterStage === s ? "" : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterStage === s ? "ring-2 ring-white/30 " : ""
              }${STAGE_BADGE_COLORS[s]}`}
            >
              {STAGE_LABELS[s]}: {count}
            </button>
          )
        })}
      </div>

      {/* Floating Bulk Action Bar */}
      {someSelected && (
        <div className="sticky top-0 z-20 mb-4 bg-blue-950/90 backdrop-blur border border-blue-800 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <span className="text-blue-300 text-sm font-medium whitespace-nowrap">
            {selectedIds.size} selected
          </span>
          <div className="w-px h-6 bg-blue-800" />

          {/* Action selector */}
          <select
            value={bulkAction}
            onChange={(e) => {
              setBulkAction(e.target.value)
              setBulkValue("")
            }}
            className="px-3 py-1.5 bg-blue-900/50 border border-blue-700 rounded-lg text-white text-sm"
          >
            <option value="">Choose action...</option>
            <option value="assign_owner">Assign Owner</option>
            <option value="set_stage">Set Stage</option>
            <option value="delete">Remove from Pipeline</option>
          </select>

          {/* Value selector (context-dependent) */}
          {bulkAction === "assign_owner" && (
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className="px-3 py-1.5 bg-blue-900/50 border border-blue-700 rounded-lg text-white text-sm"
            >
              <option value="">Unassign</option>
              {TEAM_MEMBERS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          )}
          {bulkAction === "set_stage" && (
            <select
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              className="px-3 py-1.5 bg-blue-900/50 border border-blue-700 rounded-lg text-white text-sm"
            >
              <option value="">Select stage...</option>
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABELS[s]}</option>
              ))}
            </select>
          )}

          {/* Execute button */}
          <button
            onClick={() => {
              if (bulkAction === "delete") {
                setShowBulkConfirm(true)
              } else {
                executeBulkAction()
              }
            }}
            disabled={
              bulkLoading ||
              !bulkAction ||
              (bulkAction === "set_stage" && !bulkValue)
            }
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              bulkAction === "delete"
                ? "bg-red-600 text-white hover:bg-red-500 disabled:bg-red-900 disabled:text-red-400"
                : "bg-blue-600 text-white hover:bg-blue-500 disabled:bg-blue-900 disabled:text-blue-400"
            } disabled:cursor-not-allowed`}
          >
            {bulkLoading
              ? "Applying..."
              : bulkAction === "delete"
              ? `Remove ${selectedIds.size}`
              : "Apply"}
          </button>

          {/* Clear selection */}
          <button
            onClick={() => {
              setSelectedIds(new Set())
              setBulkAction("")
              setBulkValue("")
            }}
            className="text-blue-400 hover:text-blue-300 text-sm ml-auto"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-gray-400 py-8 text-center">Loading pipeline...</p>
      ) : records.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg mb-2">No activation records yet</p>
          <p className="text-sm">
            Use the Match Finder to add founders and investors to the pipeline.
          </p>
        </div>
      ) : (
        <>
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-x-auto">
          <table className="w-full min-w-[950px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                  />
                </th>
                <th className="text-left p-3 text-xs text-gray-500 uppercase">Side</th>
                <th className="text-left p-3 text-xs text-gray-500 uppercase">Name</th>
                <th className="text-left p-3 text-xs text-gray-500 uppercase">Company</th>
                <th className="text-left p-3 text-xs text-gray-500 uppercase">Industry</th>
                <th className="text-left p-3 text-xs text-gray-500 uppercase">Stage</th>
                <th className="text-left p-3 text-xs text-gray-500 uppercase">Owner</th>
                <th className="text-center p-3 text-xs text-gray-500 uppercase">Matches</th>
                <th className="text-left p-3 text-xs text-gray-500 uppercase">SLA</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {records.map((rec) => {
                const overdue = isSLAOverdue(rec)
                const isSelected = selectedIds.has(rec.id)
                return (
                  <tr
                    key={rec.id}
                    className={`border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                      overdue ? "bg-red-950/20" : ""
                    }${isSelected ? " bg-blue-950/20" : ""}`}
                  >
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(rec.id)}
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 cursor-pointer"
                      />
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          rec.side === "INVESTOR"
                            ? "bg-indigo-900/50 text-indigo-300"
                            : "bg-emerald-900/50 text-emerald-300"
                        }`}
                      >
                        {rec.side === "INVESTOR" ? "INV" : "FDR"}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="text-white text-sm font-medium">{rec.name}</div>
                      <div className="text-gray-500 text-xs">{rec.email}</div>
                    </td>
                    <td className="p-3 text-gray-300 text-sm">{rec.company ?? "—"}</td>
                    <td className="p-3 text-gray-300 text-sm">
                      {rec.industry.replace(/_/g, " ")}
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STAGE_BADGE_COLORS[rec.stage] ?? ""}`}>
                        {STAGE_LABELS[rec.stage] ?? rec.stage}
                      </span>
                    </td>
                    <td className="p-3 text-gray-300 text-sm">{rec.owner ?? "—"}</td>
                    <td className="p-3 text-center text-gray-300 text-sm">
                      {rec.matches.length > 0 ? (
                        <span>
                          {rec.matches.length}
                          {rec.matches.some((m) => m.selected) && (
                            <span className="text-green-400 ml-1">
                              ({rec.matches.filter((m) => m.selected).length} sel)
                            </span>
                          )}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-sm">
                      {rec.slaDeadline ? (
                        <span className={overdue ? "text-red-400 font-medium" : "text-gray-400"}>
                          {overdue ? "⚠ " : ""}
                          {new Date(rec.slaDeadline).toLocaleDateString()}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/control-tower/pipeline/${rec.id}`}
                        className="text-blue-400 hover:text-blue-300 text-sm"
                      >
                        Open →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between mt-4 px-1">
            <p className="text-sm text-gray-500">
              Showing {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
              >
                ← Prev
              </button>
              <span className="px-3 py-1.5 text-sm text-gray-400">
                Page {page + 1} of {Math.ceil(total / pageSize)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * pageSize >= total}
                className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm border border-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-700 transition-colors"
              >
                Next →
              </button>
            </div>
          </div>
        )}
        </>
      )}
      <ConfirmDialog
        open={showBulkConfirm}
        onConfirm={async () => {
          setShowBulkConfirm(false)
          await executeBulkAction()
        }}
        onCancel={() => setShowBulkConfirm(false)}
        title={`Delete ${selectedIds.size} record${selectedIds.size === 1 ? "" : "s"}?`}
        description="This will permanently remove the selected records from the pipeline. This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={bulkLoading}
      />
    </div>
  )
}
