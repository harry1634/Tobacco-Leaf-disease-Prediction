"use client";

import { useMemo, useState } from "react";
import { BarChartGrouped, type BarRow } from "@/components/charts/BarChartGrouped";
import { LineChartMulti, type Row, type Series } from "@/components/charts/LineChartMulti";
import { EmptyState } from "@/components/ui/EmptyState";
import { useResults, type ExperimentWithRounds } from "@/hooks/useResults";
import { fmtBytes, fmtPercent, fmtScore, fmtText } from "@/lib/experiments";

const MAX_SERIES = 8; // the validated palette has 8 fixed slots; beyond that, charts would be unreadable

// Pivot "metric per round per experiment" into one row per round.
function roundRows(items: ExperimentWithRounds[], pick: (r: ExperimentWithRounds["rounds"][number], cumulative: number | null) => number | null, cumulativeBytes = false): Row[] {
  const byRound = new Map<number, Row>();
  for (const e of items) {
    let running: number | null = null;
    for (const r of e.rounds) {
      if (cumulativeBytes) running = r.commBytes === null ? running : (running ?? 0) + r.commBytes;
      const row = byRound.get(r.round) ?? ({ x: r.round } as Row);
      row[e.id] = pick(r, running);
      byRound.set(r.round, row);
    }
  }
  return [...byRound.values()].sort((a, b) => a.x - b.x);
}

export function ResultsContent() {
  const { items, loading, error } = useResults();
  // Colour follows the experiment (its position in this fixed, name-sorted list), never its rank or filter state.
  const all = useMemo(() => [...items].sort((a, b) => a.name.localeCompare(b.name)).slice(0, MAX_SERIES), [items]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  if (loading) return <p role="status" className="text-muted">Loading results…</p>;
  if (error) return <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-warning">{error}</p>;
  if (all.length === 0) {
    return <EmptyState title="No results to chart" message="Charts display only data imported from real experiments. Run the Python pipeline and import its results." />;
  }

  const colorOf = (id: string) => `var(--series-${all.findIndex((e) => e.id === id) + 1})`;
  const shown = all.filter((e) => !hidden.has(e.id));
  const series: Series[] = shown.map((e) => ({ key: e.id, label: e.name, color: colorOf(e.id) }));
  const toggle = (id: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  // Final-round macro metrics (from the experiment summary, which comes from the held-out test set).
  const metricSeries: Series[] = [
    { key: "p", label: "Macro precision", color: "var(--series-1)" },
    { key: "r", label: "Macro recall", color: "var(--series-2)" },
    { key: "f", label: "Macro-F1", color: "var(--series-3)" },
  ];
  const metricRows: BarRow[] = shown.map((e) => ({ name: e.name, p: e.summary.macroPrecision, r: e.summary.macroRecall, f: e.summary.macroF1 }));

  // Client participation = how often each client was selected, counted from the recorded rounds.
  const clientIds = [...new Set(shown.flatMap((e) => e.rounds.flatMap((r) => r.selectedClients)))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
  const participationRows: BarRow[] = clientIds.map((c) => {
    const row: BarRow = { name: `Client ${c}` };
    for (const e of shown) {
      row[e.id] = e.rounds.some((r) => r.selectedClients.length > 0)
        ? e.rounds.filter((r) => r.selectedClients.includes(c)).length
        : null;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <div role="group" aria-label="Experiments to show" className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Show:</span>
        {all.map((e) => {
          const on = !hidden.has(e.id);
          return (
            <button key={e.id} type="button" aria-pressed={on} onClick={() => toggle(e.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${on ? "border-primary bg-primary-soft" : "border-border text-muted"}`}>
              <span aria-hidden className="inline-block size-2.5 rounded-full" style={{ background: colorOf(e.id), opacity: on ? 1 : 0.35 }} />
              {e.name}
            </button>
          );
        })}
        {items.length > MAX_SERIES && <span className="text-sm text-muted">Showing the first {MAX_SERIES} experiments.</span>}
      </div>

      {shown.length === 0 ? (
        <EmptyState title="No experiment selected" message="Choose at least one experiment above." />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <LineChartMulti title="Global accuracy" note="Validation accuracy of the global model after each round." series={series}
            rows={roundRows(shown, (r) => r.accuracy)} xLabel="Round" format={(v) => `${(v * 100).toFixed(1)}%`} domain={[0, 1]} />
          <LineChartMulti title="Macro-F1 per round" note="Mean F1 across classes (each class counts equally)." series={series}
            rows={roundRows(shown, (r) => r.macroF1)} xLabel="Round" format={(v) => v.toFixed(3)} domain={[0, 1]} />
          <LineChartMulti title="Training loss" note="Average local training loss of the selected clients." series={series}
            rows={roundRows(shown, (r) => r.trainLoss)} xLabel="Round" format={(v) => v.toFixed(3)} />
          <LineChartMulti title="Validation loss" note="Loss of the global model on the validation set." series={series}
            rows={roundRows(shown, (r) => r.valLoss)} xLabel="Round" format={(v) => v.toFixed(3)} />
          <BarChartGrouped title="Final macro precision, recall and F1" note="Held-out test set, final global model. Only 1 test image exists for the rarest classes, so treat scores as noisy."
            series={metricSeries} rows={metricRows} format={(v) => v.toFixed(3)} domain={[0, 1]} />
          <LineChartMulti title="Cumulative communication cost" note="Bytes sent between server and clients (both directions), summed over rounds." series={series}
            rows={roundRows(shown, (_r, cum) => cum, true)} xLabel="Round" format={fmtBytes} />
          <div className="xl:col-span-2">
            <BarChartGrouped title="Client participation frequency" note="Number of rounds each client was selected."
              series={series} rows={participationRows} format={(v) => String(v)} />
          </div>
        </div>
      )}

      <section aria-labelledby="cmp" className="rounded-lg border border-border bg-surface p-5">
        <h2 id="cmp" className="mb-3 font-medium">Comparison of experimental configurations</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-sm">
            <thead className="text-muted">
              <tr>{["Experiment", "Selection", "Compression", "Accuracy", "Macro-F1", "Rounds to converge", "Total comm.", "Uplink"].map((h) => <th key={h} scope="col" className="px-3 py-1.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {all.map((e) => (
                <tr key={e.id}>
                  <th scope="row" className="px-3 py-1.5 font-medium">{e.name}</th>
                  <td className="px-3 py-1.5">{fmtText(e.config.selectionStrategy)}</td>
                  <td className="px-3 py-1.5">{e.config.compression === null ? "—" : e.config.topkRatio === null ? e.config.compression : `${e.config.compression} (k=${e.config.topkRatio})`}</td>
                  <td className="px-3 py-1.5">{fmtPercent(e.summary.accuracy)}</td>
                  <td className="px-3 py-1.5">{fmtScore(e.summary.macroF1)}</td>
                  <td className="px-3 py-1.5">{fmtText(e.summary.roundsToConvergence)}</td>
                  <td className="px-3 py-1.5">{fmtBytes(e.summary.totalCommBytes)}</td>
                  <td className="px-3 py-1.5">{fmtBytes(e.summary.uplinkBytes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">&ldquo;—&rdquo; means the value was not recorded; it is not zero.</p>
      </section>
    </div>
  );
}
