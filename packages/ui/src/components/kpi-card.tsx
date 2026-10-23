import * as React from "react";
import { cn } from "../lib/utils";
import { Card, CardContent } from "./card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export interface KpiCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
  delta?: {
    value: string | number;
    isPositive?: boolean;
    isNeutral?: boolean;
    label?: string;
  };
  sparklineData?: number[];
  variant?: "default" | "indigo" | "emerald" | "amber" | "rose" | "blue";
}

const variantStyles = {
  default: {
    iconBg: "bg-secondary text-secondary-foreground border-border",
    border: "border-border",
    glow: "hover:border-primary/40",
    stroke: "#71717a",
  },
  indigo: {
    iconBg: "bg-primary/10 text-primary border-primary/20",
    border: "border-border",
    glow: "hover:border-primary/40 hover:shadow-primary/5",
    stroke: "#003399",
  },
  emerald: {
    iconBg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    border: "border-border",
    glow: "hover:border-emerald-500/40 hover:shadow-emerald-500/5",
    stroke: "#2CA02C",
  },
  amber: {
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    border: "border-border",
    glow: "hover:border-amber-500/40 hover:shadow-amber-500/5",
    stroke: "#f59e0b",
  },
  rose: {
    iconBg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    border: "border-border",
    glow: "hover:border-rose-500/40 hover:shadow-rose-500/5",
    stroke: "#dc2626",
  },
  blue: {
    iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    border: "border-border",
    glow: "hover:border-blue-500/40 hover:shadow-blue-500/5",
    stroke: "#2563eb",
  },
};

function computeSparkline(data?: number[]): string | null {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 24;

  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `M ${points.join(" L ")}`;
}

export function KpiCard({
  title,
  value,
  description,
  badge,
  icon,
  delta,
  sparklineData,
  variant = "default",
  className,
  ...props
}: KpiCardProps) {
  const styles = variantStyles[variant] || variantStyles.default;
  const sparklinePath = computeSparkline(sparklineData);

  return (
    <Card
      className={cn(
        "relative overflow-hidden bg-card text-card-foreground border transition-all duration-200 hover:shadow-md",
        styles.border,
        styles.glow,
        className
      )}
      {...props}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground truncate">
            {title}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            {badge && (
              <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-secondary text-secondary-foreground border border-border">
                {badge}
              </span>
            )}
            {icon && (
              <div
                className={cn(
                  "h-8 w-8 rounded-lg flex items-center justify-center border shadow-sm",
                  styles.iconBg
                )}
              >
                {React.isValidElement(icon) ? (
                  icon
                ) : typeof icon === "function" ? (
                  React.createElement(icon as React.ComponentType<{ className?: string }>, { className: "h-4 w-4" })
                ) : null}
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-4">
          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground font-mono">
            {value}
          </div>

          {sparklinePath && (
            <svg
              className="w-20 h-6 shrink-0 opacity-80"
              viewBox="0 0 80 24"
              fill="none"
            >
              <path
                d={sparklinePath}
                stroke={styles.stroke}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>

        {(delta || description) && (
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            {delta ? (
              <div
                className={cn(
                  "flex items-center gap-1 font-medium text-[11px]",
                  delta.isNeutral
                    ? "text-muted-foreground"
                    : delta.isPositive
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"
                )}
              >
                {delta.isNeutral ? (
                  <Minus className="h-3.5 w-3.5 shrink-0" />
                ) : delta.isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                )}
                <span>{delta.value}</span>
                {delta.label && (
                  <span className="text-muted-foreground text-[10px] ml-1">
                    {delta.label}
                  </span>
                )}
              </div>
            ) : (
              <span className="truncate">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
