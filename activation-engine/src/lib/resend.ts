import { Resend } from "resend"
import { env } from "./env"

export const resend = new Resend(env.RESEND_API_KEY)

export const EMAIL_FROM = "Aziz, Founder of Syrena <aziz@syrena.co.uk>"
export const BATCH_SIZE = 99
export const BATCH_DELAY_MS = 3000
