"use client"

interface Member {
  id: string
  userId: string
  side: string
  displayName: string | null
  email: string | null
  investorTier: string | null
  engagementScore: number
  stage: number
  matchesPresentedIds: string[] | null
  selectedMatchIds: string[] | null
  respondedAt: string | null
  stageCompletedAt: string | null
}

interface StageProgressProps {
  members: Member[]
  onRecordSelection: (member: Member) => void
}

const stageLabels = ["Not Started", "Presented", "Selected", "Feedback"]

const stageColors = [
  "bg-gray-700",
  "bg-blue-600",
  "bg-amber-600",
  "bg-green-600",
]

const tierColors: Record<string, string> = {
  HOT: "text-red-400",
  WARM: "text-amber-400",
  GAP_FILL: "text-gray-400",
}

export function StageProgress({ members, onRecordSelection }: StageProgressProps) {
  const investors = members.filter((m) => m.side === "INVESTOR")
  const founders = members.filter((m) => m.side === "FOUNDER")

  return (
    <div className="grid grid-cols-2 gap-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase">
          Investors ({investors.length})
        </h3>
        <div className="space-y-2">
          {investors.map((m) => (
            <MemberStageCard
              key={m.id}
              member={m}
              onRecordSelection={onRecordSelection}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase">
          Founders ({founders.length})
        </h3>
        <div className="space-y-2">
          {founders.map((m) => (
            <MemberStageCard
              key={m.id}
              member={m}
              onRecordSelection={onRecordSelection}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function MemberStageCard({
  member,
  onRecordSelection,
}: {
  member: Member
  onRecordSelection: (member: Member) => void
}) {
  const presentedCount = member.matchesPresentedIds?.length ?? 0
  const selectedCount = member.selectedMatchIds?.length ?? 0

  return (
    <div className="p-4 bg-gray-900 rounded-lg border border-gray-800">
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-white font-medium">
            {member.displayName ?? "Unknown"}
          </p>
          <p className="text-gray-500 text-xs">{member.email}</p>
        </div>
        <div className="flex items-center gap-2">
          {member.investorTier && (
            <span
              className={`text-xs font-semibold ${tierColors[member.investorTier] ?? ""}`}
            >
              {member.investorTier}
            </span>
          )}
        </div>
      </div>

      {/* Stage progress bar */}
      <div className="flex gap-1 mb-2">
        {[0, 1, 2, 3].map((stage) => (
          <div
            key={stage}
            className={`h-1.5 flex-1 rounded-full ${
              member.stage >= stage ? stageColors[stage] : "bg-gray-800"
            }`}
          />
        ))}
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${stageColors[member.stage]} text-white`}
          >
            {stageLabels[member.stage]}
          </span>
          {member.stage >= 1 && (
            <span className="text-xs text-gray-500">
              {presentedCount} matches shown
            </span>
          )}
          {member.stage >= 2 && (
            <span className="text-xs text-gray-500">
              · {selectedCount} selected
            </span>
          )}
        </div>

        {member.stage === 1 && (
          <button
            onClick={() => onRecordSelection(member)}
            className="px-2.5 py-1 bg-amber-700 text-white rounded text-xs font-medium hover:bg-amber-600 transition-colors"
          >
            Record Selection
          </button>
        )}
      </div>

      {member.respondedAt && (
        <p className="text-xs text-gray-600 mt-1">
          Responded: {new Date(member.respondedAt).toLocaleDateString()}
        </p>
      )}
    </div>
  )
}
