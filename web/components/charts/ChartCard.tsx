"use client";

import { useId, useState } from "react";

// Wraps a chart with a title, a note, and a chart/table switch. The table is the
// accessible twin of the chart: every plotted value is also readable there.
export function ChartCard({
  title,
  note,
  chart,
  table,
}: {
  title: string;
  note?: string;
  chart: React.ReactNode;
  table: React.ReactNode;
}) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const id = useId();
  return (
    <section className="rounded-lg border border-border bg-surface p-5" aria-labelledby={id}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id={id} className="font-medium">{title}</h2>
          {note && <p className="mt-0.5 text-sm text-muted">{note}</p>}
        </div>
        <div role="group" aria-label={`${title} view`} className="flex shrink-0 overflow-hidden rounded-md border border-border text-sm">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`px-3 py-1 capitalize ${view === v ? "bg-primary-soft text-primary" : "text-muted hover:text-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {view === "chart" ? chart : <div className="max-h-80 overflow-auto">{table}</div>}
    </section>
  );
}

export function DataTable({ columns, rows }: { columns: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 bg-surface text-muted">
        <tr>{columns.map((c) => <th key={c} scope="col" className="px-3 py-1.5 font-medium">{c}</th>)}</tr>
      </thead>
      <tbody className="divide-y divide-border">
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((cell, j) => (
              <td key={j} className="px-3 py-1.5 tabular-nums">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
