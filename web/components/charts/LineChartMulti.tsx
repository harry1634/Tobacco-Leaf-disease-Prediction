"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard, DataTable } from "./ChartCard";

export type Series = { key: string; label: string; color: string };
// One row per x value; a series key maps to a number, or null/undefined when not recorded.
export type Row = { x: number } & Record<string, number | null | undefined>;

type Props = {
  title: string;
  note?: string;
  series: Series[];
  rows: Row[];
  xLabel: string;
  format: (v: number) => string;
  domain?: [number | "auto", number | "auto"];
};

const AXIS = { fontSize: 12, fill: "var(--muted)" } as const;

export function LineChartMulti({ title, note, series, rows, xLabel, format, domain }: Props) {
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
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 20, left: 0 }}>
              <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
              <XAxis dataKey="x" tick={AXIS} stroke="var(--chart-axis)" tickLine={false}
                label={{ value: xLabel, position: "insideBottom", offset: -12, fontSize: 12, fill: "var(--muted)" }} />
              <YAxis tick={AXIS} stroke="var(--chart-axis)" tickLine={false} tickFormatter={format} domain={domain} width={56} />
              <Tooltip
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13 }}
                labelFormatter={(x) => `${xLabel} ${x}`}
                formatter={(v, name) => [typeof v === "number" ? format(v) : "—", name]}
              />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              {series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color}
                  strokeWidth={2} dot={rows.length <= 12 ? { r: 3, strokeWidth: 2, stroke: "var(--surface)" } : false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }} connectNulls={false} isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      }
      table={
        <DataTable
          columns={[xLabel, ...series.map((s) => s.label)]}
          rows={rows.map((r) => [r.x, ...series.map((s) => (typeof r[s.key] === "number" ? format(r[s.key] as number) : "—"))])}
        />
      }
    />
  );
}
