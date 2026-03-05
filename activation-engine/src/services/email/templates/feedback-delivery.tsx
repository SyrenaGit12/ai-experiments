import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"

interface FeedbackDeliveryProps {
  recipientFirstName: string
  matchName: string
  positive: boolean
  /** Custom feedback message from the other side (optional) */
  feedbackMessage?: string | null
}

export function FeedbackDelivery({
  recipientFirstName,
  matchName,
  positive,
  feedbackMessage,
}: FeedbackDeliveryProps) {
  const previewText = positive
    ? `Great news — ${matchName} is interested!`
    : `Update on your match with ${matchName}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {positive ? (
            <>
              <Heading style={heading}>It&apos;s a Match!</Heading>

              <Text style={text}>
                Hi {recipientFirstName},
              </Text>

              <Text style={text}>
                Great news — <strong>{matchName}</strong> is also interested in
                connecting with you. We&apos;ll be making an introduction
                shortly so you can take it from here.
              </Text>

              {feedbackMessage && (
                <Section style={feedbackSection}>
                  <Text style={feedbackLabel}>
                    A note from {matchName}:
                  </Text>
                  <Text style={feedbackText}>
                    &quot;{feedbackMessage}&quot;
                  </Text>
                </Section>
              )}

              <Text style={text}>
                Keep an eye on your inbox — we&apos;ll send the intro email
                with both of you copied in.
              </Text>
            </>
          ) : (
            <>
              <Heading style={heading}>Match Update</Heading>

              <Text style={text}>
                Hi {recipientFirstName},
              </Text>

              <Text style={text}>
                Thanks for participating in this round.{" "}
                <strong>{matchName}</strong> has decided not to proceed at this
                time. This doesn&apos;t reflect on you — timing and focus areas
                shift constantly.
              </Text>

              <Text style={text}>
                We&apos;ll keep matching you with relevant people and will be
                in touch when we have new opportunities that align with your
                profile.
              </Text>
            </>
          )}

          <Text style={signature}>
            Best,
            <br />
            Aziz
            <br />
            <span style={signatureRole}>Founder, Syrena</span>
          </Text>

          <Hr style={divider} />

          <Text style={footer}>
            You&apos;re receiving this as part of the Syrena matching process.
            If you&apos;d prefer not to receive these updates, reply with
            &quot;unsubscribe&quot;.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
}

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "40px 32px",
  borderRadius: "8px",
  maxWidth: "600px",
}

const heading = {
  color: "#1a1a2e",
  fontSize: "24px",
  fontWeight: "700" as const,
  lineHeight: "32px",
  margin: "0 0 24px",
}

const text = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
}

const divider = {
  borderColor: "#e5e7eb",
  margin: "24px 0",
}

const feedbackSection = {
  backgroundColor: "#f0fdf4",
  borderRadius: "8px",
  padding: "16px 20px",
  marginBottom: "16px",
  border: "1px solid #bbf7d0",
}

const feedbackLabel = {
  color: "#166534",
  fontSize: "13px",
  fontWeight: "600" as const,
  margin: "0 0 4px",
  lineHeight: "18px",
}

const feedbackText = {
  color: "#374151",
  fontSize: "14px",
  fontStyle: "italic" as const,
  lineHeight: "22px",
  margin: "0",
}

const signature = {
  color: "#374151",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "24px 0 0",
}

const signatureRole = {
  color: "#9ca3af",
  fontSize: "13px",
}

const footer = {
  color: "#9ca3af",
  fontSize: "12px",
  lineHeight: "18px",
  textAlign: "center" as const,
}
