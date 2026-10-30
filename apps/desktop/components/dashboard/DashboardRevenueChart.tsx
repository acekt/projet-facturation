"use client"

import * as React from "react"
import { Activity, PieChart as PieIcon, BarChart2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@workspace/ui/components/card"
import { formatCurrency } from "@/lib/utils"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts"

const PIE_COLORS = ["#6366f1", "#f59e0b", "#10b981", "#ef4444"]

interface DashboardRevenueChartProps {
  revenueData: Array<{ label: string; value: number; date?: string; revenue?: number }>
  paymentMethodData: Array<{ method: string; amount: number }>
  totalRevenue: number
  formatYAxis: (val: number) => string
}

export function DashboardRevenueChart({
  revenueData,
  paymentMethodData,
  totalRevenue,
  formatYAxis,
}: DashboardRevenueChartProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-2 border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-md font-semibold">Évolution Commerciale</CardTitle>
            <CardDescription className="text-[10px] uppercase font-medium tracking-widest">
              Revenus perçus sur la période (XAF)
            </CardDescription>
          </div>
          <Activity className="w-5 h-5 text-muted-foreground opacity-20" />
        </CardHeader>
        <CardContent className="h-[300px]">
          {totalRevenue === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] border border-dashed rounded-lg text-muted-foreground text-center">
              <BarChart2 className="w-8 h-8 text-muted-foreground/20 mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                Aucune donnée financière générée sur cette période.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888820" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={formatYAxis} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(val: number) => [formatCurrency(val), "Revenu"]}
                />
                <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-md font-semibold">Modes de Paiement</CardTitle>
            <CardDescription className="text-[10px] uppercase font-medium tracking-widest">
              Répartition en %
            </CardDescription>
          </div>
          <PieIcon className="w-4 h-4 text-muted-foreground opacity-30" />
        </CardHeader>
        <CardContent className="h-[300px] flex items-center justify-center">
          {paymentMethodData && paymentMethodData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="amount"
                  nameKey="method"
                >
                  {paymentMethodData.map((_entry, index: number) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(val: number) => [`${val}%`, "Part"]}
                />
                <Legend
                  iconType="circle"
                  layout="horizontal"
                  verticalAlign="bottom"
                  align="center"
                  wrapperStyle={{ fontSize: "10px", fontWeight: 700, paddingTop: "20px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground italic">Aucun paiement enregistré</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

