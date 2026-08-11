import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Box, Card, CardContent, Stack, Typography, useTheme } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";

/**
 * A small set of "modern" dashboard building blocks — glass-card KPIs with
 * count-up animation and pre-styled Recharts wrappers using gradient area
 * fills and smoother curves. Zero new dependencies; the count-up is a
 * hand-rolled rAF hook, the entrance animations are pure CSS keyframes,
 * and the charts remain Recharts (already in the bundle) so nothing
 * inflates first-paint.
 *
 * Inspired by LiveCharts2's animation-heavy look, translated to the
 * React/MUI stack the app already ships with.
 */

// ─── Count-up hook (no external lib) ────────────────────────────────────
// Interpolates from the previous rendered value to the new one over the
// given duration. Handles large numbers, negatives, currency, and re-runs
// smoothly when the target changes mid-animation.
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState<number>(target);
  const fromRef = useRef<number>(target);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    fromRef.current = value;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      // ease-out-cubic — feels snappier than linear and calmer than expo
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);
  return value;
}

// ─── KPI card ──────────────────────────────────────────────────────────
export interface KpiCardProps {
  label: string;
  /** Raw numeric value for animation; if you must show a formatted string, pass valueLabel */
  value: number;
  /** Formatter applied to the animated value on every frame. */
  format?: (v: number) => string;
  /** Override the auto-formatter; useful when the value is a currency amount. */
  currency?: boolean;
  /** Small icon rendered in a colored badge on the right. */
  icon?: ReactNode;
  /** Accent color used for the top gradient bar + icon badge. */
  accent?: string;
  /** Optional trend delta % vs previous period (positive → green ↑, negative → red ↓). */
  deltaPct?: number;
  /** Optional 6–12 point series for a sparkline under the number. */
  spark?: number[];
  /** Order of appearance — used to stagger the fade-in animation. */
  index?: number;
}

export function AnimatedKpiCard({
  label, value, format, currency, icon, accent, deltaPct, spark, index = 0
}: KpiCardProps) {
  const theme = useTheme();
  const color = accent ?? theme.palette.primary.main;
  const animated = useCountUp(value);
  const money = useMemo(
    () => new Intl.NumberFormat("el-GR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }),
    []
  );
  const intFmt = useMemo(() => new Intl.NumberFormat("el-GR"), []);
  const fmt = format ?? (currency
    ? (v: number) => money.format(v)
    : (v: number) => intFmt.format(Math.round(v)));

  const trendIcon = deltaPct === undefined
    ? null
    : Math.abs(deltaPct) < 0.5
      ? <TrendingFlatIcon fontSize="small" sx={{ color: "text.disabled" }} />
      : deltaPct > 0
        ? <TrendingUpIcon fontSize="small" sx={{ color: "success.main" }} />
        : <TrendingDownIcon fontSize="small" sx={{ color: "error.main" }} />;
  const trendText = deltaPct === undefined ? null : (
    <Typography variant="caption" sx={{
      color: deltaPct > 0 ? "success.main" : deltaPct < 0 ? "error.main" : "text.secondary",
      fontWeight: 700,
    }}>
      {deltaPct > 0 ? "+" : ""}{deltaPct.toFixed(1)}%
    </Typography>
  );

  // Zero-state: when the value collapses to 0 and no sparkline was supplied,
  // the card is otherwise inert on hover. Render a subtle animated baseline
  // that slides in from the left — signals the metric is *tracked*, just
  // empty right now. Mirrors the desktop app's "empty axis at 0" affordance.
  const showZeroBaseline = (value === 0) && (!spark || spark.length < 2 || spark.every(v => v === 0));

  return (
    <Card
      sx={{
        position: "relative", overflow: "hidden",
        borderRadius: 2.5,
        // Permanent framed look — thick navy-tinted border at rest so the
        // card reads as a distinct container even when the metric is zero.
        // Deepens on hover into the metric's accent colour.
        border: "1.5px solid",
        borderColor: (theme) => theme.palette.mode === "dark"
          ? "rgba(148,191,230,0.28)"
          : "rgba(11,37,69,0.28)",
        transition: "transform 240ms, box-shadow 240ms, border-color 240ms",
        animation: "kpiCardIn 460ms cubic-bezier(.16,.84,.44,1) both",
        animationDelay: `${index * 60}ms`,
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: 6,
          borderColor: color,
        },
        "@keyframes kpiCardIn": {
          from: { opacity: 0, transform: "translateY(10px) scale(.985)" },
          to:   { opacity: 1, transform: "translateY(0)   scale(1)" },
        },
        // Zero-baseline: full-width dashed line pinned to the bottom of the
        // card. Grows in on hover so idle rows stay calm.
        ...(showZeroBaseline && {
          "&::after": {
            content: '""',
            position: "absolute",
            left: 12, right: 12, bottom: 10,
            height: 0,
            borderBottom: `1.5px dashed ${color}`,
            opacity: 0,
            transform: "scaleX(0)",
            transformOrigin: "left center",
            transition: "opacity 260ms ease, transform 420ms cubic-bezier(.22,.61,.36,1)",
          },
          "&:hover::after": { opacity: 0.55, transform: "scaleX(1)" },
        }),
      }}
    >
      {/* Top gradient bar removed intentionally — the permanent navy frame
          already anchors the card as a container; the coloured accent is now
          carried by the icon badge alone. */}
      <CardContent sx={{ pt: 2.25 }}>
        <Stack direction="row" alignItems="flex-start" spacing={1.5}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary"
              sx={{ letterSpacing: "0.08em", display: "block", lineHeight: 1.2 }}>
              {label}
            </Typography>
            <Typography variant="h4"
              sx={{ fontWeight: 800, fontVariantNumeric: "tabular-nums", lineHeight: 1.15, mt: 0.5 }}>
              {fmt(animated)}
            </Typography>
            {(trendIcon || trendText) && (
              <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5 }}>
                {trendIcon}{trendText}
              </Stack>
            )}
          </Box>
          {icon && (
            <Box sx={{
              width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              color, bgcolor: `${color}18`,
              "& svg": { fontSize: 22 },
            }}>
              {icon}
            </Box>
          )}
        </Stack>
        {spark && spark.length >= 2 && (
          <Box sx={{ height: 36, mt: 1, mx: -1 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={spark.map((v, i) => ({ i, v }))}
                         margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`sparkGrad-${label}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={color} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2}
                      fill={`url(#sparkGrad-${label})`}
                      isAnimationActive animationDuration={900} />
              </AreaChart>
            </ResponsiveContainer>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Chart card wrapper ────────────────────────────────────────────────
export function ChartCard({ title, subtitle, height = 300, action, children }: {
  title: string; subtitle?: string; height?: number; action?: ReactNode; children: ReactNode;
}) {
  return (
    <Card sx={{
      borderRadius: 2.5,
      // Same framed look as the KPI cards — permanent navy border so the
      // chart reads as a distinct container without depending on hover.
      border: "1.5px solid",
      borderColor: (theme) => theme.palette.mode === "dark"
        ? "rgba(148,191,230,0.28)"
        : "rgba(11,37,69,0.28)",
      transition: "border-color 240ms ease, box-shadow 240ms ease",
      animation: "chartCardIn 500ms cubic-bezier(.16,.84,.44,1) both",
      "&:hover": { borderColor: "primary.main" },
      "@keyframes chartCardIn": {
        from: { opacity: 0, transform: "translateY(8px)" },
        to:   { opacity: 1, transform: "translateY(0)" },
      },
    }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
            {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
          </Box>
          {action}
        </Stack>
        <Box sx={{ height, "& .recharts-tooltip-wrapper": { outline: "none" } }}>
          {children}
        </Box>
      </CardContent>
    </Card>
  );
}

// ─── Modern area / bar / line series wrappers ──────────────────────────
export interface SeriesPoint { label: string; value: number }
export interface DualSeriesPoint { label: string; a: number; b: number }

export function ModernAreaChart({ data, color, format }: {
  data: SeriesPoint[]; color?: string; format?: (v: number) => string;
}) {
  const theme = useTheme();
  const c = color ?? theme.palette.primary.main;
  const gid = `areaGrad-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.map(d => ({ label: d.label, v: d.value }))}
                 margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={c} stopOpacity={0.45} />
            <stop offset="100%" stopColor={c} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
               tickFormatter={format ? (v) => format(v as number) : undefined} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(v) => (format ? format(v as number) : String(v))} />
        <Area type="monotone" dataKey="v" stroke={c} strokeWidth={2.5} fill={`url(#${gid})`}
              isAnimationActive animationDuration={900} activeDot={{ r: 6 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ModernBarChart({ data, color, format }: {
  data: SeriesPoint[]; color?: string; format?: (v: number) => string;
}) {
  const theme = useTheme();
  const c = color ?? theme.palette.secondary.main;
  const gid = `barGrad-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data.map(d => ({ label: d.label, v: d.value }))}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={c} stopOpacity={1} />
            <stop offset="100%" stopColor={c} stopOpacity={0.55} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
               tickFormatter={format ? (v) => format(v as number) : undefined} />
        <Tooltip cursor={{ fill: `${c}12` }} contentStyle={tooltipStyle}
                 formatter={(v) => (format ? format(v as number) : String(v))} />
        <Bar dataKey="v" fill={`url(#${gid})`} radius={[6, 6, 0, 0]}
             isAnimationActive animationDuration={900} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ModernDualLineChart({ data, aLabel, bLabel, aColor, bColor, format }: {
  data: DualSeriesPoint[]; aLabel: string; bLabel: string;
  aColor?: string; bColor?: string; format?: (v: number) => string;
}) {
  const theme = useTheme();
  const ca = aColor ?? theme.palette.success.main;
  const cb = bColor ?? theme.palette.error.main;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.25} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
               tickFormatter={format ? (v) => format(v as number) : undefined} />
        <Tooltip contentStyle={tooltipStyle}
                 formatter={(v) => (format ? format(v as number) : String(v))} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
        <Line type="monotone" dataKey="a" name={aLabel} stroke={ca} strokeWidth={2.5}
              dot={{ r: 3 }} activeDot={{ r: 6 }} isAnimationActive animationDuration={900} />
        <Line type="monotone" dataKey="b" name={bLabel} stroke={cb} strokeWidth={2.5}
              dot={{ r: 3 }} activeDot={{ r: 6 }} isAnimationActive animationDuration={900} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ModernDonutChart({ data, colors, format }: {
  data: SeriesPoint[]; colors?: string[]; format?: (v: number) => string;
}) {
  const theme = useTheme();
  const palette = colors ?? [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.info.main, theme.palette.error.main, theme.palette.secondary.main,
    "#8b5cf6", "#14b8a6", "#f43f5e",
  ];
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={data.map(d => ({ name: d.label, value: d.value }))}
             dataKey="value" nameKey="name" cx="50%" cy="50%"
             innerRadius="60%" outerRadius="95%" paddingAngle={2}
             stroke="#ffffff" strokeWidth={2}
             isAnimationActive animationDuration={900}>
          {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
        </Pie>
        <Tooltip contentStyle={tooltipStyle}
                 formatter={(v, name) => [
                   format ? format(v as number) : String(v),
                   `${name}${total > 0 ? ` — ${(((v as number) / total) * 100).toFixed(1)}%` : ""}`
                 ]} />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Shared tooltip look — subtle border + shadow so it reads on both light
// and dark themes without extra work per-page.
const tooltipStyle = {
  border: "1px solid rgba(15,23,42,0.12)",
  borderRadius: 8,
  boxShadow: "0 10px 32px -12px rgba(15,42,80,0.28)",
  padding: "8px 12px",
  fontSize: 12,
} as const;
