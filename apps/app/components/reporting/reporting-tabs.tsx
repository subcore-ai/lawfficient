"use client"

import type { ReactNode } from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"

export function ReportingTabs({ reports, audit }: { reports: ReactNode; audit: ReactNode }) {
  return (
    <Tabs defaultValue="reports">
      <TabsList>
        <TabsTrigger value="reports">Reports</TabsTrigger>
        <TabsTrigger value="audit">Audit log</TabsTrigger>
      </TabsList>
      <TabsContent value="reports" className="mt-4 flex flex-col gap-6">
        {reports}
      </TabsContent>
      <TabsContent value="audit" className="mt-4">
        {audit}
      </TabsContent>
    </Tabs>
  )
}
