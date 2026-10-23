"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";

const revenueChartConfig = {
  revenue: {
    label: "Volume Facturé (XAF)",
    color: "#003399",
  },
  paid: {
    label: "Règlements Encaissés (XAF)",
    color: "#2CA02C",
  },
} satisfies ChartConfig;

const syncChartConfig = {
  success: {
    label: "Synchronisations Réussies",
    color: "#2563eb",
  },
  errors: {
    label: "Erreurs de Réplication",
    color: "#dc2626",
  },
} satisfies ChartConfig;

export function RevenueTrendChart({
  data,
}: {
  data: Array<{ date: string; revenue: number; paid: number }>;
}) {
  return (
    <Card className="bg-card border-border text-card-foreground shadow-sm min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-foreground font-bold">
              Évolution Financière Multi-Tenant
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Volumes facturés et encaissements consolidés sur 7 jours
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground text-[11px]">Facturé</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#2CA02C]" />
              <span className="text-muted-foreground text-[11px]">Encaissé</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 min-w-0">
        <ChartContainer
          config={revenueChartConfig}
          className="h-[260px] w-full aspect-auto min-w-0"
        >
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#003399" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#003399" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="fillPaid" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2CA02C" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#2CA02C" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="date"
              className="text-muted-foreground text-[11px]"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              className="text-muted-foreground text-[11px]"
              tickLine={false}
              axisLine={false}
              tickFormatter={(val) => `${(val / 1000).toFixed(0)}k`}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#003399"
              strokeWidth={2}
              fill="url(#fillRevenue)"
            />
            <Area
              type="monotone"
              dataKey="paid"
              stroke="#2CA02C"
              strokeWidth={2}
              fill="url(#fillPaid)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

export function SyncHealthChart({
  data,
}: {
  data: Array<{ day: string; success: number; errors: number }>;
}) {
  return (
    <Card className="bg-card border-border text-card-foreground shadow-sm min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base text-foreground font-bold">
              Santé & Activité de Réplication Desktop
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Volume des synchronisations journalières et détection d&apos;anomalies
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#2563eb]" />
              <span className="text-muted-foreground text-[11px]">Succès</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#dc2626]" />
              <span className="text-muted-foreground text-[11px]">Erreurs</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 min-w-0">
        <ChartContainer
          config={syncChartConfig}
          className="h-[260px] w-full aspect-auto min-w-0"
        >
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
            <XAxis
              dataKey="day"
              className="text-muted-foreground text-[11px]"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              className="text-muted-foreground text-[11px]"
              tickLine={false}
              axisLine={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="success"
              fill="#2563eb"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
            <Bar
              dataKey="errors"
              fill="#dc2626"
              radius={[4, 4, 0, 0]}
              maxBarSize={32}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
