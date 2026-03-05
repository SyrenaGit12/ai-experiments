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

interface FounderMatch {
  index: number
  name: string
  company?: string | null
  bio?: string | null
  industry: string
  fundingStage?: string | null
}

interface A1InvestorMatchListProps {
  investorFirstName: string
  industry: string
  founders: FounderMatch[]
}

export function A1InvestorMatchList({
  investorFirstName,
  industry,
  founders,
}: A1InvestorMatchListProps) {
  const industryLabel = industry.replace(/_/g, " ")

  return (
    <Html>
      <Head />
      <Preview>
        Your curated founder matches in {industryLabel}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Your Curated Matches</Heading>

          <Text style={text}>
            Hi {investorFirstName},
          </Text>

          <Text style={text}>
            We&apos;ve hand-picked {founders.length} founder
            {founders.length > 1 ? "s" : ""} building in{" "}
            <strong>{industryLabel}</strong> that align with your investment
            profile. Here&apos;s who we think you should meet:
          </Text>

          <Hr style={divider} />

          {founders.map((founder) => (
            <Section key={founder.index} style={matchCard}>
              <Row>
                <Column>
                  <Text style={matchNumber}>{founder.index}</Text>
                </Column>
                <Column style={{ width: "100%" }}>
                  <Text style={matchName}>{founder.name}</Text>
                  {founder.company && (
                    <Text style={matchCompany}>{founder.company}</Text>
                  )}
                  {founder.bio && (
                    <Text style={matchBio}>
                      {founder.bio.length > 150
                        ? founder.bio.slice(0, 150) + "..."
                        : founder.bio}
                    </Text>
                  )}
                  <Text style={matchMeta}>
                    {founder.industry.replace(/_/g, " ")}
                    {founder.fundingStage &&
                      ` · ${founder.fundingStage.replace(/_/g, " ")}`}
                  </Text>
                </Column>
              </Row>
            </Section>
          ))}

          <Hr style={divider} />

          <Section style={ctaSection}>
            <Text style={ctaText}>
              <strong>Interested?</strong> Simply reply to this email with the
              numbers of the founders you&apos;d like to meet.
            </Text>
            <Text style={ctaExample}>
              For example: &quot;I&apos;d like to meet 1 and 3&quot;
            </Text>
          </Section>

          <Text style={text}>
            We&apos;ll handle the introductions and make sure both sides are
            aligned before connecting you.
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
            You&apos;re receiving this because you&apos;re a member of the Syrena
            investor network. If you&apos;d prefer not to receive match
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
  color: "#6366f1",
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

const matchCompany = {
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

const matchMeta = {
  color: "#9ca3af",
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0",
  lineHeight: "16px",
}

const ctaSection = {
  backgroundColor: "#eef2ff",
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
  color: "#6366f1",
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
