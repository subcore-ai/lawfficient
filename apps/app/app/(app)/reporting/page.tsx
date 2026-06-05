import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

import { AuditLogCard } from "@/components/audit-log-card"
import { CaseMixChart, ConsultationsChart, ConversionFunnelChart, RevenueChart } from "@/components/charts"
import { PageHeader } from "@/components/page-header"
import { ExportReportDialog } from "@/components/reporting/export-report-dialog"
import { ReportingTabs } from "@/components/reporting/reporting-tabs"
import { StatStrip } from "@/components/stat-strip"
import { CASE_TYPE_MIX, CONSULTATIONS_BY_MONTH, CONVERSION_FUNNEL, REVENUE_BY_MONTH } from "@/data"

export const metadata = { title: "Reporting" }

const REPORTS = [
  { title: "Lead conversion", desc: "Conversion rate per attorney and per sales agent." },
  { title: "Revenue report", desc: "Revenue by week of month, case type, and client." },
  { title: "Overdue payments", desc: "Aging report with client buckets and status tags." },
  { title: "Case turnaround", desc: "Packet SLA exceedance and on-time completion." },
  { title: "Monthly drop-off", desc: "Monthly-payment client retention and drop-off rate." },
  { title: "Results received", desc: "Approvals, RFEs, and NOIDs by case type." },
]

export default function ReportingPage() {
  return (
    <>
      <PageHeader
        title="Reporting & Analytics"
        description="Firm performance, finances, case trends, and the firm-wide audit trail."
      />

      <ReportingTabs
        audit={<AuditLogCard />}
        reports={
          <>
            <StatStrip
              stats={[
                { label: "Lead → retained", value: "19.6%" },
                { label: "Qualified consults (May)", value: 33 },
                { label: "Revenue (May)", value: "$52.1k", tone: "success" },
                { label: "Drop-off rate", value: "6.2%" },
              ]}
            />

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <RevenueChart data={REVENUE_BY_MONTH} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Consultation trends</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConsultationsChart data={CONSULTATIONS_BY_MONTH} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Lead conversion funnel</CardTitle>
                </CardHeader>
                <CardContent>
                  <ConversionFunnelChart data={CONVERSION_FUNNEL} />
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Case type mix</CardTitle>
                </CardHeader>
                <CardContent>
                  <CaseMixChart data={CASE_TYPE_MIX} />
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Report catalog</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {REPORTS.map((r) => (
                  <div key={r.title} className="flex flex-col gap-2 rounded-lg border p-3">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-muted-foreground text-xs leading-snug">{r.desc}</p>
                    <ExportReportDialog title={r.title} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        }
      />
    </>
  )
}
