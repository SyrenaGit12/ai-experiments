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
  Row,
  Column,
} from "@react-email/components"

interface MatchCard {
  index: number
  name: string
  /** Company name for founders, firm name for investors */
  organization?: string | null
  bio?: string | null
  whyRelevant?: string | null
  industry: string
  /** e.g. "Pre-Seed" for founders, "Angel" for investors */
  detail?: string | null
}

interface NewJoinerWelcomeProps {
  firstName: string
  /** "INVESTOR" or "FOUNDER" — the role of the new joiner */
  side: "INVESTOR" | "FOUNDER"
  matches: MatchCard[]
}

export function NewJoinerWelcome({
  firstName,
  side,
  matches,
}: NewJoinerWelcomeProps) {
  const matchType = side === "INVESTOR" ? "founders" : "investors"
  const previewText = `Welcome to Syrena — we found ${matches.length} ${matchType} for you`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Welcome to Syrena</Heading>

          <Text style={text}>
            Hi {firstName},
          </Text>

          <Text style={text}>
            Welcome aboard! Based on your profile, we&apos;ve already
            identified {matches.length} {matchType} who look like a great fit.
            Here&apos;s who we think you should meet:
          </Text>

          <Hr style={divider} />

          {matches.map((match) => (
            <Section key={match.index} style={matchCard}>
              <Row>
                <Column>
                  <Text style={matchNumber}>{match.index}</Text>
                </Column>
                <Column style={{ width: "100%" }}>
                  <Text style={matchName}>{match.name}</Text>
                  {match.organization && (
                    <Text style={matchOrg}>{match.organization}</Text>
                  )}
                  {match.bio && (
                    <Text style={matchBio}>
                      {match.bio.length > 150
                        ? match.bio.slice(0, 150) + "..."
                        : match.bio}
                    </Text>
                  )}
                  {match.whyRelevant && (
                    <Text style={whyRelevantStyle}>
                      {match.whyRelevant}
                    </Text>
                  )}
                  <Text style={matchMeta}>
                    {match.industry.replace(/_/g, " ")}
                    {match.detail && ` · ${match.detail.replace(/_/g, " ")}`}
                  </Text>
                </Column>
              </Row>
            </Section>
          ))}

          <Hr style={divider} />

          <Section style={ctaSection}>
            <Text style={ctaText}>
              <strong>Like what you see?</strong> Simply reply to this email
              and let us know which {matchType} you&apos;d like to meet.
            </Text>
            <Text style={ctaExample}>
              For example: &quot;I&apos;d love to meet{" "}
              {matches.length >= 2 ? "1 and 2" : "1"}&quot;
            </Text>
          </Section>

          <Text style={text}>
            We&apos;ll check mutual interest and handle the introductions —
            no cold outreach, just warm connections.
          </Text>

          <Text style={signature}>
            Best,
            <br />
            Aziz
            <br />
            <span style={signatureRole}>Founder, Syrena</span>
          </Text>

          <Hr style={divider} />

          <Text style={footer}>
            You&apos;re receiving this because you recently joined the Syrena
            network. If you&apos;d prefer not to receive match
            recommendations, reply with &quot;unsubscribe&quot;.
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

const matchCard = {
  backgroundColor: "#f9fafb",
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "12px",
  border: "1px solid #e5e7eb",
}

const matchNumber = {
  color: "#10b981",
  fontSize: "20px",
  fontWeight: "700" as const,
  margin: "0",
  paddingRight: "16px",
  lineHeight: "28px",
}

const matchName = {
  color: "#1a1a2e",
  fontSize: "16px",
  fontWeight: "600" as const,
  margin: "0 0 2px",
  lineHeight: "24px",
}

const matchOrg = {
  color: "#6b7280",
  fontSize: "14px",
  margin: "0 0 6px",
  lineHeight: "20px",
}

const matchBio = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 8px",
}

const whyRelevantStyle = {
  color: "#10b981",
  fontSize: "13px",
  fontStyle: "italic" as const,
  lineHeight: "18px",
  margin: "0 0 8px",
}

const matchMeta = {
  color: "#9ca3af",
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0",
  lineHeight: "16px",
}

const ctaSection = {
  backgroundColor: "#ecfdf5",
  borderRadius: "8px",
  padding: "20px",
  marginBottom: "16px",
}

const ctaText = {
  color: "#1a1a2e",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 8px",
}

const ctaExample = {
  color: "#10b981",
  fontSize: "14px",
  fontStyle: "italic" as const,
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
