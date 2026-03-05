import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

export const env = createEnv({
  server: {
    SANDBOX_DATABASE_URL: z.string().url(),
    SYRENA_DATABASE_URL: z.string().url(),
    RESEND_API_KEY: z.string().min(1),
    CONTROL_TOWER_PASSWORD: z.string().min(1),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
  },
  runtimeEnv: {
    SANDBOX_DATABASE_URL: process.env.SANDBOX_DATABASE_URL,
    SYRENA_DATABASE_URL: process.env.SYRENA_DATABASE_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    CONTROL_TOWER_PASSWORD: process.env.CONTROL_TOWER_PASSWORD,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
})
