"use client"

import { ToastProvider } from "@/components/ui/toast"
import type { ReactNode } from "react"

/**
 * Client-side providers wrapper.
 * Used in the server-component layout to inject client-only context providers.
 */
export function ClientProviders({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>
}
