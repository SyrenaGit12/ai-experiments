import db from "@/lib/db"

export default async function EmailsPage() {
  const emails = await db.outreachEmail.findMany({
    include: {
      poolPair: {
        select: {
          investorName: true,
          founderName: true,
          pool: { select: { industry: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Email Status</h1>

      {emails.length === 0 ? (
        <p className="text-gray-500">No emails sent yet</p>
      ) : (
        <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left p-3 text-xs text-gray-500">Step</th>
                <th className="text-left p-3 text-xs text-gray-500">Side</th>
                <th className="text-left p-3 text-xs text-gray-500">
                  Recipient
                </th>
                <th className="text-left p-3 text-xs text-gray-500">
                  Industry
                </th>
                <th className="text-center p-3 text-xs text-gray-500">Sent</th>
                <th className="text-center p-3 text-xs text-gray-500">
                  Opened
                </th>
                <th className="text-center p-3 text-xs text-gray-500">
                  Replied
                </th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email) => (
                <tr
                  key={email.id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="p-3 text-white text-xs font-mono">
                    {email.step}
                  </td>
                  <td className="p-3 text-gray-300 text-sm">{email.side}</td>
                  <td className="p-3 text-white text-sm">
                    {email.side === "INVESTOR"
                      ? email.poolPair.investorName
                      : email.poolPair.founderName}
                  </td>
                  <td className="p-3 text-gray-400 text-sm">
                    {email.poolPair.pool.industry.replace(/_/g, " ")}
                  </td>
                  <td className="p-3 text-center">
                    {email.sentAt ? (
                      <span className="text-green-400 text-xs">
                        {new Date(email.sentAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {email.openedAt ? (
                      <span className="text-blue-400 text-xs">
                        {new Date(email.openedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">-</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    {email.repliedAt ? (
                      <span className="text-purple-400 text-xs">
                        {new Date(email.repliedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs">-</span>
                    )}
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
