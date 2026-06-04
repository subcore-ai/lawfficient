"use client"

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, XAxis, YAxis } from "recharts"

import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import type { SeriesPoint } from "@/data/types"

const currency = (v: number) => `$${(v / 1000).toFixed(0)}k`

const revenueConfig = {
  revenue: { label: "Revenue", color: "var(--chart-1)" },
} satisfies ChartConfig

export function RevenueChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ChartContainer config={revenueConfig} className="h-[240px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={currency} />
        <ChartTooltip
          content={<ChartTooltipContent indicator="line" formatter={(v) => `$${Number(v).toLocaleString()}`} />}
        />
        <Area
          dataKey="revenue"
          type="natural"
          stroke="var(--color-revenue)"
          fill="var(--color-revenue)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  )
}

const consultConfig = {
  booked: { label: "Booked", color: "var(--chart-1)" },
  paid: { label: "Paid", color: "var(--chart-2)" },
  qualified: { label: "Qualified", color: "var(--chart-4)" },
} satisfies ChartConfig

export function ConsultationsChart({ data }: { data: SeriesPoint[] }) {
  return (
    <ChartContainer config={consultConfig} className="h-[240px] w-full">
      <BarChart data={data} margin={{ left: 4, right: 12, top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={28} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="booked" fill="var(--color-booked)" radius={3} />
        <Bar dataKey="paid" fill="var(--color-paid)" radius={3} />
        <Bar dataKey="qualified" fill="var(--color-qualified)" radius={3} />
      </BarChart>
    </ChartContainer>
  )
}

const funnelConfig = { value: { label: "Count" } } satisfies ChartConfig

export function ConversionFunnelChart({
  data,
}: {
  data: { stage: string; value: number; fill: string }[]
}) {
  return (
    <ChartContainer config={funnelConfig} className="h-[240px] w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 28 }}>
        <XAxis type="number" dataKey="value" hide />
        <YAxis type="category" dataKey="stage" tickLine={false} axisLine={false} width={92} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Bar dataKey="value" radius={4}>
          {data.map((d) => (
            <Cell key={d.stage} fill={d.fill} />
          ))}
          <LabelList dataKey="value" position="right" className="fill-foreground text-xs tabular-nums" />
        </Bar>
      </BarChart>
    </ChartContainer>
  )
}

export function CaseMixChart({ data }: { data: { name: string; value: number; fill: string }[] }) {
  return (
    <ChartContainer config={{}} className="mx-auto aspect-square h-[240px]">
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={56} strokeWidth={2}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
