"use client"

import { useEffect, useState } from "react"

export function TestModeBanner() {
  const [isTestMode, setIsTestMode] = useState(false)

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setIsTestMode(d.testMode === true))
      .catch(() => {})
  }, [])

  if (!isTestMode) return null

  return (
    <div className="bg-amber-600/90 text-white text-center py-2 px-4 text-sm font-medium">
      ⚠️ TEST MODE — All emails redirecting to aziz@syrena.co.uk
    </div>
  )
}
