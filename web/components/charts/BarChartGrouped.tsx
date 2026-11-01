"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, DataTable } from "./ChartCard";
import type { Series } from "./LineChartMulti";

// Bars grouped by category. With a single series the legend is omitted (the title names it).
export type BarRow = { name: string } & Record<string, string | number | null | undefined>;

type Props = {
  title: string;
  note?: string;
  series: Series[];
  rows: BarRow[];
  format: (v: number) => string;
  domain?: [number | "auto", number | "auto"];
};

const AXIS = { fontSize: 12, fill: "var(--muted)" } as const;

export function BarChartGrouped({ title, note, series, rows, format, domain }: Props) {
  const hasData = rows.some((r) => series.some((s) => typeof r[s.key] === "number"));
  if (!hasData) {
    return (
      <ChartCard
        title={title}
        note={note}
        chart={<p className="py-10 text-center text-sm text-muted">No recorded values for the selected experiments.</p>}
        table={<p className="py-4 text-sm text-muted">No recorded values.</p>}
      />
    );
  }
  return (
    <ChartCard
      title={title}
      note={note}
      chart={
        <div className="h-72 w-full" role="img" aria-label={`${title}. Use the table view for exact values.`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="name" tick={AXIS} stroke="var(--chart-axis)" tickLine={false} interval={0} />
              <YAxis tick={AXIS} stroke="var(--chart-axis)" tickLine={false} tickFormatter={format} domain={domain} width={56} />
              <Tooltip
                cursor={{ fill: "var(--primary-soft)", opacity: 0.5 }}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}
                formatter={(v, name) => [typeof v === "number" ? format(v) : "—", name]}
              />
              {series.length > 1 && <Legend wrapperStyle={{ fontSize: 13 }} />}
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} maxBarSize={28}
                  radius={[4, 4, 0, 0]} stroke="var(--surface)" strokeWidth={0} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <DataTable
          columns={["", ...series.map((s) => s.label)]}
          rows={rows.map((r) => [r.name, ...series.map((s) => (typeof r[s.key] === "number" ? format(r[s.key] as number) : "—"))])}
        />
      }
    />
  );
}
