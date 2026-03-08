"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useToast } from "@/components/ui/toast"

interface EmailTemplate {
  id: string
  slug: string
  name: string
  subject: string
  body: string
  side: string | null
  description: string | null
}

interface ActivationRecord {
  id: string
  name: string
  email: string
  company: string | null
  side: string
  industry: string
  matches: { matchName: string; matchEmail: string; matchCompany: string | null; whyRelevant: string | null; selected: boolean }[]
}

const DEFAULT_TEMPLATES: Omit<EmailTemplate, "id" | "createdAt" | "updatedAt">[] = [
  {
    slug: "s1-investor-matches",
    name: "S1: Investor Match List",
    subject: "Your curated founder matches on Syrena",
    body: `Hi {{name}},

I'm reaching out because we've identified some founders on Syrena that align with your investment focus in {{industry}}.

Here are your curated matches:

{{matches}}

If any of these founders interest you, simply reply to this email with their names and we'll facilitate an introduction.

Best,
Aziz
Founder, Syrena`,
    side: "INVESTOR",
    description: "Send curated founder matches to an investor (Stage 1)",
  },
  {
    slug: "s1-founder-matches",
    name: "S1: Founder Match List",
    subject: "Investors interested in {{industry}} — your Syrena matches",
    body: `Hi {{name}},

Great news! We've identified investors on Syrena who are actively investing in {{industry}} and could be a great fit for {{company}}.

Here are your curated matches:

{{matches}}

Let us know which investor you'd like to be introduced to, and we'll make it happen.

Best,
Aziz
Founder, Syrena`,
    side: "FOUNDER",
    description: "Send curated investor matches to a founder (Stage 1)",
  },
  {
    slug: "s3-intro-request",
    name: "S3: Introduction Request",
    subject: "Introduction: {{name}} ↔ {{matchName}}",
    body: `Hi {{matchName}},

One of our {{side_label}} on Syrena, {{name}}{{company_line}}, is interested in connecting with you.

{{why_relevant}}

Would you be open to an introduction? Just reply to this email and we'll set it up.

Best,
Aziz
Founder, Syrena`,
    side: null,
    description: "Ask the counterparty if they're open to an introduction (Stage 3)",
  },
  {
    slug: "intro-email",
    name: "Introduction Email",
    subject: "Intro: {{name}} ↔ {{matchName}}",
    body: `Hi {{name}} and {{matchName}},

I'm excited to connect you both!

{{name}}{{company_line}} — {{name_bio}}

{{matchName}}{{match_company_line}} — {{match_bio}}

I'll let you two take it from here. Feel free to reply all or reach out to each other directly.

Best,
Aziz
Founder, Syrena`,
    side: null,
    description: "The actual introduction email connecting both parties",
  },
  {
    slug: "followup-no-response",
    name: "Follow-up: No Response",
    subject: "Quick follow-up — your Syrena matches",
    body: `Hi {{name}},

Just wanted to follow up on the matches we sent over. Have you had a chance to look through them?

If you're interested in any of the {{side_label_plural}} we shared, just reply with their names and we'll facilitate an introduction.

No pressure at all — just want to make sure you didn't miss this!

Best,
Aziz
Founder, Syrena`,
    side: null,
    description: "Follow-up email when user hasn't responded to S1",
  },
]

export default function ComposePageWrapper() {
  return (
    <Suspense fallback={<div className="text-gray-400 py-8 text-center">Loading...</div>}>
      <ComposePage />
    </Suspense>
  )
}

function ComposePage() {
  const searchParams = useSearchParams()
  const recordId = searchParams.get("record")
  const toast = useToast()

  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null)
  const [record, setRecord] = useState<ActivationRecord | null>(null)
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  // Composed email state
  const [toEmail, setToEmail] = useState("")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [ccMatchmaking, setCcMatchmaking] = useState(true)

  // Loading states
  const [seeding, setSeeding] = useState(false)
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Template editor
  const [editMode, setEditMode] = useState(false)
  const [editSlug, setEditSlug] = useState("")
  const [editName, setEditName] = useState("")
  const [editSubject, setEditSubject] = useState("")
  const [editBody, setEditBody] = useState("")
  const [editSide, setEditSide] = useState("")
  const [editDescription, setEditDescription] = useState("")

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    if (recordId) fetchRecord(recordId)
  }, [recordId])

  async function fetchTemplates() {
    setLoadingTemplates(true)
    try {
      const res = await fetch("/api/templates")
      const data = await res.json()
      setTemplates(data)
    } catch {
      toast.error("Failed to load templates")
    } finally {
      setLoadingTemplates(false)
    }
  }

  async function seedDefaults() {
    setSeeding(true)
    try {
      for (const t of DEFAULT_TEMPLATES) {
        await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(t),
        })
      }
      await fetchTemplates()
      toast.success("Default templates seeded")
    } catch {
      toast.error("Failed to seed default templates")
    } finally {
      setSeeding(false)
    }
  }

  async function fetchRecord(id: string) {
    try {
      const res = await fetch(`/api/activation/${id}`)
      if (res.ok) {
        const data = await res.json()
        setRecord(data)
        setToEmail(data.email)
      }
    } catch {
      toast.error("Failed to load record")
    }
  }

  function interpolate(template: string, vars: Record<string, string>): string {
    let result = template
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value)
    }
    return result
  }

  function applyTemplate(tmpl: EmailTemplate) {
    setSelectedTemplate(tmpl)
    if (!record) {
      setSubject(tmpl.subject)
      setBody(tmpl.body)
      return
    }

    const selectedMatches = record.matches.filter((m) => m.selected)
    const matchesList = (selectedMatches.length > 0 ? selectedMatches : record.matches)
      .map((m, i) => {
        let line = `${i + 1}. ${m.matchName}`
        if (m.matchCompany) line += ` (${m.matchCompany})`
        if (m.whyRelevant) line += `\n   → ${m.whyRelevant}`
        return line
      })
      .join("\n\n")

    const firstMatch = selectedMatches[0] ?? record.matches[0]

    const vars: Record<string, string> = {
      name: record.name,
      email: record.email,
      company: record.company ?? "",
      company_line: record.company ? ` (${record.company})` : "",
      industry: record.industry.replace(/_/g, " "),
      side_label: record.side === "INVESTOR" ? "investors" : "founders",
      side_label_plural: record.side === "INVESTOR" ? "investors" : "founders",
      matches: matchesList,
      matchName: firstMatch?.matchName ?? "",
      matchEmail: firstMatch?.matchEmail ?? "",
      match_company_line: firstMatch?.matchCompany ? ` (${firstMatch.matchCompany})` : "",
      why_relevant: firstMatch?.whyRelevant ?? "",
    }

    setSubject(interpolate(tmpl.subject, vars))
    setBody(interpolate(tmpl.body, vars))
  }

  async function saveTemplate() {
    setSavingTemplate(true)
    try {
      await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: editSlug,
          name: editName,
          subject: editSubject,
          body: editBody,
          side: editSide || null,
          description: editDescription || null,
        }),
      })
      await fetchTemplates()
      setEditMode(false)
      toast.success("Template saved")
    } catch {
      toast.error("Failed to save template")
    } finally {
      setSavingTemplate(false)
    }
  }

  function startEditTemplate(tmpl?: EmailTemplate) {
    if (tmpl) {
      setEditSlug(tmpl.slug)
      setEditName(tmpl.name)
      setEditSubject(tmpl.subject)
      setEditBody(tmpl.body)
      setEditSide(tmpl.side ?? "")
      setEditDescription(tmpl.description ?? "")
    } else {
      setEditSlug("")
      setEditName("")
      setEditSubject("")
      setEditBody("")
      setEditSide("")
      setEditDescription("")
    }
    setEditMode(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Compose Email</h1>
          <p className="text-sm text-gray-400 mt-1">
            {record
              ? `Composing for ${record.name} (${record.side})`
              : "Select a template and compose an email"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Templates panel */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-400 uppercase">Templates</h2>
              <button
                onClick={() => startEditTemplate()}
                className="text-blue-400 hover:text-blue-300 text-xs"
              >
                + New
              </button>
            </div>

            {loadingTemplates ? (
              <p className="text-gray-500 text-sm">Loading...</p>
            ) : templates.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm mb-2">No templates yet</p>
                <button
                  onClick={seedDefaults}
                  disabled={seeding}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {seeding && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  {seeding ? "Seeding..." : "Seed Default Templates"}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {templates.map((tmpl) => (
                  <button
                    key={tmpl.id}
                    onClick={() => applyTemplate(tmpl)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedTemplate?.id === tmpl.id
                        ? "border-blue-600 bg-blue-950/30"
                        : "border-gray-800 bg-gray-800/50 hover:bg-gray-800"
                    }`}
                  >
                    <p className="text-white text-sm font-medium">{tmpl.name}</p>
                    {tmpl.side && (
                      <span className={`text-xs ${
                        tmpl.side === "INVESTOR" ? "text-indigo-400" : "text-emerald-400"
                      }`}>
                        {tmpl.side}
                      </span>
                    )}
                    {tmpl.description && (
                      <p className="text-gray-500 text-xs mt-1">{tmpl.description}</p>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        startEditTemplate(tmpl)
                      }}
                      className="text-gray-600 hover:text-gray-400 text-xs mt-1"
                    >
                      Edit
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Compose panel */}
        <div className="lg:col-span-2">
          {editMode ? (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">
                {editSlug ? "Edit Template" : "New Template"}
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Slug (unique ID)</label>
                    <input
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                      placeholder="s1-investor-matches"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Name</label>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                      placeholder="S1: Investor Match List"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Side (optional)</label>
                    <select
                      value={editSide}
                      onChange={(e) => setEditSide(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                    >
                      <option value="">Both</option>
                      <option value="INVESTOR">Investor</option>
                      <option value="FOUNDER">Founder</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Description</label>
                    <input
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Subject</label>
                  <input
                    value={editSubject}
                    onChange={(e) => setEditSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">
                    Body (use {"{{name}}"}, {"{{company}}"}, {"{{industry}}"}, {"{{matches}}"}, etc.)
                  </label>
                  <textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm font-mono resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveTemplate}
                    disabled={savingTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {savingTemplate && <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {savingTemplate ? "Saving..." : "Save Template"}
                  </button>
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Compose</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">To</label>
                  <input
                    value={toEmail}
                    onChange={(e) => setToEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Subject</label>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Body</label>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={16}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm resize-none"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={ccMatchmaking}
                      onChange={(e) => setCcMatchmaking(e.target.checked)}
                      className="rounded"
                    />
                    CC matchmaking@syrena.co.uk
                  </label>
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      const mailto = `mailto:${toEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${ccMatchmaking ? "&cc=matchmaking@syrena.co.uk" : ""}`
                      window.open(mailto, "_blank")
                    }}
                    disabled={!toEmail || !subject}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
                  >
                    Open in Email Client
                  </button>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(body)
                      toast.success("Email body copied to clipboard!")
                    }}
                    className="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600"
                  >
                    Copy Body
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
