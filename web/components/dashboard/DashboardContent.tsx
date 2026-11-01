"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { useExperiments } from "@/hooks/useExperiments";
import { fmtBytes, fmtDate, fmtPercent, fmtScore } from "@/lib/experiments";

export function DashboardContent() {
  const { experiments, loading, error } = useExperiments();

  if (loading) return <p role="status" className="text-muted">Loading experiments…</p>;
  if (error) return <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-warning">{error}</p>;

  const latest = experiments[0] ?? null; // list is sorted newest first
  const f1Values = experiments.map((e) => e.summary.macroF1).filter((v): v is number => v !== null);
  const bestF1 = f1Values.length ? Math.max(...f1Values) : null;
  const total = experiments.length;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total experiments" value={total ? String(total) : null} />
        <StatCard label="Best macro-F1" value={bestF1 === null ? null : fmtScore(bestF1)} />
        <StatCard label="Latest accuracy" value={latest?.summary.accuracy == null ? null : fmtPercent(latest.summary.accuracy)} />
        <StatCard label="Communication cost (latest run)" value={latest?.summary.totalCommBytes == null ? null : fmtBytes(latest.summary.totalCommBytes)} />
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Recent activity</h2>
      {total === 0 ? (
        <EmptyState
          title="No experiments yet"
          message="Metrics appear here after real experiment results are imported from the Python pipeline."
        />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
          {experiments.slice(0, 5).map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="font-medium">{e.name}</span>
              <span className="text-muted">{e.status ?? "status unknown"} · {fmtDate(e.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {total > 0 && (
        <Link href="/experiments" className="mt-3 inline-block text-sm text-primary underline">
          View all experiments
        </Link>
      )}
    </>
  );
}
