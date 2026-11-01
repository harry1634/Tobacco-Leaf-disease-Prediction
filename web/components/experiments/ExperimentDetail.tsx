"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { fetchExperiment, fmtBytes, fmtDate, fmtPercent, fmtScore, fmtText } from "@/lib/experiments";
import type { Experiment } from "@/types/experiment";

type State = { exp: Experiment | null; loading: boolean; error: string | null };

function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
      {items.map(([k, v]) => (
        <div key={k}><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
      ))}
    </dl>
  );
}

function Confusion({ exp }: { exp: Experiment }) {
  const { confusionMatrix: rows, classNames } = exp;
  if (rows.length === 0) return <p className="text-sm text-muted">No confusion matrix recorded.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">Confusion matrix: rows are actual classes, columns are predicted classes</caption>
        <thead>
          <tr>
            <th className="p-1 text-left font-medium text-muted">Actual ↓ / Predicted →</th>
            {(classNames.length ? classNames : rows.map((r) => r.actual)).map((c) => (
              <th key={c} scope="col" className="max-w-16 p-1 font-medium text-muted"><span className="block truncate" title={c}>{c.slice(0, 6)}</span></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const total = r.counts.reduce((a, b) => a + b, 0);
            return (
              <tr key={r.actual}>
                <th scope="row" className="whitespace-nowrap p-1 pr-2 text-left font-medium">{r.actual}</th>
                {r.counts.map((n, j) => {
                  const share = total ? n / total : 0; // colour = share of the row, so rare classes stay visible
                  return (
                    <td key={j} title={`${r.actual} → ${classNames[j] ?? j}: ${n}`}
                      className="h-8 min-w-8 rounded text-center tabular-nums"
                      style={{ background: `color-mix(in srgb, var(--series-1) ${Math.round(share * 85)}%, var(--surface))`, color: share > 0.55 ? "#fff" : "var(--foreground)" }}>
                      {n || ""}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted">Cell shading shows the share of each actual class (row). Numbers are image counts.</p>
    </div>
  );
}

export function ExperimentDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<State>({ exp: null, loading: true, error: null });

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    fetchExperiment(uid, id)
      .then((exp) => !cancelled && setState({ exp, loading: false, error: null }))
      .catch(() => !cancelled && setState({ exp: null, loading: false, error: "Could not load this experiment." }));
    return () => { cancelled = true; };
  }, [uid, id]);

  if (state.loading) return <p role="status" className="text-muted">Loading experiment…</p>;
  if (state.error) return <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-warning">{state.error}</p>;
  const exp = state.exp;
  if (!exp) return <EmptyState title="Experiment not found" message="It may have been removed, or it belongs to another account." />;

  const c = exp.config;
  const s = exp.summary;
  return (
    <div className="space-y-6">
      <Link href="/experiments" className="text-sm text-primary underline">← All experiments</Link>
      <h1 className="text-2xl font-semibold tracking-tight">{exp.name}</h1>

      <Card title="Configuration">
        <Facts items={[
          ["Status", fmtText(exp.status)], ["Date", fmtDate(exp.createdAt)], ["Model", fmtText(c.model)],
          ["Clients", fmtText(c.numClients)], ["Clients per round", fmtText(c.clientsPerRound)], ["Rounds", fmtText(c.rounds)],
          ["Selection", fmtText(c.selectionStrategy)], ["Compression", fmtText(c.compression)], ["Top-k ratio", fmtText(c.topkRatio)],
          ["Distribution", fmtText(c.distribution)], ["Dataset", fmtText(c.dataset)], ["Seed", fmtText(c.seed)],
        ]} />
      </Card>

      <Card title="Final test-set results">
        <Facts items={[
          ["Accuracy", fmtPercent(s.accuracy)], ["Macro precision", fmtScore(s.macroPrecision)], ["Macro recall", fmtScore(s.macroRecall)],
          ["Macro-F1", fmtScore(s.macroF1)], ["Rounds to convergence", fmtText(s.roundsToConvergence)],
          ["Total communication", fmtBytes(s.totalCommBytes)], ["Uplink only", fmtBytes(s.uplinkBytes)],
        ]} />
      </Card>

      <Card title="Per-class performance">
        {exp.perClass.length === 0 ? <p className="text-sm text-muted">Not recorded.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="text-muted"><tr>{["Class", "Precision", "Recall", "F1", "Test images"].map((h) => <th key={h} scope="col" className="px-3 py-1.5 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {exp.perClass.map((m) => (
                  <tr key={m.label}>
                    <th scope="row" className="px-3 py-1.5 font-medium">{m.label}</th>
                    <td className="px-3 py-1.5">{fmtScore(m.precision)}</td><td className="px-3 py-1.5">{fmtScore(m.recall)}</td>
                    <td className="px-3 py-1.5">{fmtScore(m.f1)}</td>
                    <td className="px-3 py-1.5">{fmtText(m.support)}{m.support !== null && m.support <= 2 ? " ⚠ too few to be reliable" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Per-client performance">
        {exp.perClient.length === 0 ? <p className="text-sm text-muted">Not recorded.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-muted"><tr>{["Client", "Local images", "Times selected", "Final model accuracy on local data"].map((h) => <th key={h} scope="col" className="px-3 py-1.5 font-medium">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-border">
                {exp.perClient.map((m) => (
                  <tr key={m.clientId}>
                    <th scope="row" className="px-3 py-1.5 font-medium">Client {m.clientId}</th>
                    <td className="px-3 py-1.5">{fmtText(m.numSamples)}</td><td className="px-3 py-1.5">{fmtText(m.timesSelected)}</td>
                    <td className="px-3 py-1.5">{fmtPercent(m.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Confusion matrix (test set)"><Confusion exp={exp} /></Card>
    </div>
  );
}
