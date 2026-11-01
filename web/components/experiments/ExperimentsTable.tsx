"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { useExperiments } from "@/hooks/useExperiments";
import { fmtDate, fmtText } from "@/lib/experiments";

const columns = ["Name", "Clients", "Rounds", "Selection", "Compression", "Distribution", "Model", "Date", "Status"];

export function ExperimentsTable() {
  const { experiments, loading, error } = useExperiments();

  if (loading) return <p role="status" className="text-muted">Loading experiments…</p>;
  if (error) return <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-warning">{error}</p>;
  if (experiments.length === 0) {
    return (
      <EmptyState
        title="No experiments imported"
        message="Run the Python pipeline and import its results to see experiments here."
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[56rem] text-left text-sm">
        <caption className="sr-only">Federated-learning experiments</caption>
        <thead className="border-b border-border text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="px-4 py-2 font-medium">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {experiments.map((e) => {
            const topk = e.config.topkRatio === null ? "" : ` (k=${e.config.topkRatio})`;
            return (
              <tr key={e.id}>
                <th scope="row" className="px-4 py-2 font-medium">
                  <Link href={`/experiments/${encodeURIComponent(e.id)}`} className="text-primary underline">{e.name}</Link>
                </th>
                <td className="px-4 py-2">{fmtText(e.config.numClients)}</td>
                <td className="px-4 py-2">{fmtText(e.config.rounds)}</td>
                <td className="px-4 py-2">{fmtText(e.config.selectionStrategy)}</td>
                <td className="px-4 py-2">{e.config.compression === null ? "—" : `${e.config.compression}${topk}`}</td>
                <td className="px-4 py-2">{fmtText(e.config.distribution)}</td>
                <td className="px-4 py-2">{fmtText(e.config.model)}</td>
                <td className="px-4 py-2">{fmtDate(e.createdAt)}</td>
                <td className="px-4 py-2">{fmtText(e.status)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
