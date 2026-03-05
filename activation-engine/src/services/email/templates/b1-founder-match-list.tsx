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

interface InvestorMatch {
  index: number
  name: string
  firm?: string | null
  investorType?: string | null
  fundingStages?: string[]
  bio?: string | null
  whyRelevant?: string | null
}

interface B1FounderMatchListProps {
  founderFirstName: string
  industry: string
  investors: InvestorMatch[]
}

export function B1FounderMatchList({
  founderFirstName,
  industry,
  investors,
}: B1FounderMatchListProps) {
  const industryLabel = industry.replace(/_/g, " ")

  return (
    <Html>
      <Head />
      <Preview>
        Investors interested in your space — {industryLabel}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Investors in Your Space</Heading>

          <Text style={text}>
            Hi {founderFirstName},
          </Text>

          <Text style={text}>
            Great news — we&apos;ve identified {investors.length} investor
            {investors.length > 1 ? "s" : ""} actively looking at{" "}
            <strong>{industryLabel}</strong> who we think would be a great fit
            for you:
          </Text>

          <Hr style={divider} />

          {investors.map((investor) => (
            <Section key={investor.index} style={matchCard}>
              <Row>
                <Column>
                  <Text style={matchNumber}>{investor.index}</Text>
                </Column>
                <Column style={{ width: "100%" }}>
                  <Text style={matchName}>{investor.name}</Text>
                  {investor.firm && (
                    <Text style={matchFirm}>{investor.firm}</Text>
                  )}
                  {investor.investorType && (
                    <Text style={matchType}>
                      {investor.investorType.replace(/_/g, " ")}
                    </Text>
                  )}
                  {investor.bio && (
                    <Text style={matchBio}>
                      {investor.bio.length > 150
                        ? investor.bio.slice(0, 150) + "..."
                        : investor.bio}
                    </Text>
                  )}
                  {investor.whyRelevant && (
                    <Text style={whyRelevant}>
                      {investor.whyRelevant}
                    </Text>
                  )}
                  {investor.fundingStages &&
                    investor.fundingStages.length > 0 && (
                      <Text style={matchMeta}>
                        Stages:{" "}
                        {investor.fundingStages
                          .map((s) => s.replace(/_/g, " "))
                          .join(", ")}
                      </Text>
                    )}
                </Column>
              </Row>
            </Section>
          ))}

          <Hr style={divider} />

          <Section style={ctaSection}>
            <Text style={ctaText}>
              <strong>Want an introduction?</strong> Reply to this email with the
              numbers of investors you&apos;d like to connect with.
            </Text>
            <Text style={ctaExample}>
              For example: &quot;I&apos;d love to meet 1 and 2&quot;
            </Text>
          </Section>

          <Text style={text}>
            We&apos;ll check mutual interest and only make the introduction
            when both sides are keen. No cold outreach, just warm
            introductions.
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
            founder network. If you&apos;d prefer not to receive match
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
  color: "#8b5cf6",
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

const matchFirm = {
  color: "#6b7280",
  fontSize: "14px",
  margin: "0 0 4px",
  lineHeight: "20px",
}

const matchType = {
  color: "#8b5cf6",
  fontSize: "12px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 6px",
  lineHeight: "16px",
}

const matchBio = {
  color: "#374151",
  fontSize: "14px",
  lineHeight: "20px",
  margin: "0 0 8px",
}

const whyRelevant = {
  color: "#8b5cf6",
  fontSize: "13px",
  fontStyle: "italic" as const,
  lineHeight: "18px",
  margin: "0 0 8px",
}

const matchMeta = {
  color: "#9ca3af",
  fontSize: "12px",
  letterSpacing: "0.05em",
  margin: "0",
  lineHeight: "16px",
}

const ctaSection = {
  backgroundColor: "#f5f3ff",
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
  color: "#8b5cf6",
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
