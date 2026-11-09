"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { useExperiments } from "@/hooks/useExperiments";
import { usePredictions } from "@/hooks/usePredictions";
import { DISEASES, niceName } from "@/lib/diseases";
import { fmtBytes, fmtDate, fmtPercent, fmtScore } from "@/lib/experiments";

const DISEASE_COUNT = Object.keys(DISEASES).length;

function Step({ done, title, children }: { done: boolean; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm">
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs ${
          done ? "border-primary bg-primary text-background" : "border-border text-muted"
        }`}
      >
        {done ? "✓" : ""}
      </span>
      <span>
        <span className="font-medium">{title}</span>
        <span className="sr-only">{done ? " (done)" : " (not done yet)"}</span>
        <span className="block text-muted">{children}</span>
      </span>
    </li>
  );
}

export function DashboardContent() {
  const { user } = useAuth();
  const { experiments, loading: expLoading, error: expError } = useExperiments();
  const { predictions, loading: predLoading, error: predError } = usePredictions();

  const name = user?.email?.split("@")[0];
  const latest = experiments[0] ?? null; // list is sorted newest first
  const f1Values = experiments.map((e) => e.summary.macroF1).filter((v): v is number => v !== null);
  const bestF1 = f1Values.length ? Math.max(...f1Values) : null;
  const total = experiments.length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">{name ? `Welcome, ${name}` : "Welcome"}</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Upload a photo of a tobacco leaf and the trained model suggests which of {DISEASE_COUNT} conditions it shows,
            with a plain-language explanation. It is an estimate, not a professional diagnosis.
          </p>
        </div>
        <Link href="/diagnosis" className="shrink-0 rounded-md bg-primary px-4 py-2 text-center text-sm font-medium text-background hover:bg-primary-hover">
          Diagnose a leaf
        </Link>
      </section>

      <section aria-labelledby="stats">
        <h2 id="stats" className="mb-3 text-lg font-semibold">At a glance</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Your diagnoses" value={predLoading || predError ? null : `${predictions.length}${predictions.length >= 50 ? "+" : ""}`} />
          <StatCard label="Federated experiments" value={expLoading || total === 0 ? null : String(total)} />
          <StatCard label="Best macro-F1" value={bestF1 === null ? null : fmtScore(bestF1)} />
          <StatCard label="Latest accuracy" value={latest?.summary.accuracy == null ? null : fmtPercent(latest.summary.accuracy)} />
        </div>
        {latest?.summary.totalCommBytes != null && (
          <p className="mt-3 text-sm text-muted">Communication cost of the latest run: {fmtBytes(latest.summary.totalCommBytes)}</p>
        )}
        {!expLoading && total === 0 && (
          <p className="mt-3 text-sm text-muted">
            Experiment figures show &ldquo;No data yet&rdquo; because no federated runs have been imported. They are never filled with placeholders.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="recent-dx">
          <h2 id="recent-dx" className="mb-3 text-lg font-semibold">Your recent diagnoses</h2>
          {predLoading ? (
            <p role="status" className="text-sm text-muted">Loading…</p>
          ) : predError ? (
            <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-warning">Could not load your diagnoses. Check your connection and Firestore rules.</p>
          ) : predictions.length === 0 ? (
            <EmptyState title="No diagnoses yet" message="Results you generate on the Disease diagnosis page are listed here. Only the label and confidence are saved, never the photo." />
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {predictions.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="font-medium">{niceName(p.label)}</span>
                  <span className="text-right text-muted">
                    {(p.confidence * 100).toFixed(1)}% · {fmtDate(p.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="progress">
          <h2 id="progress" className="mb-3 text-lg font-semibold">Project progress</h2>
          <Card>
            <ol className="space-y-4">
              <Step done title="Leaf disease classifier">
                A trained model is connected to the Diagnosis page.
              </Step>
              <Step done={predictions.length > 0} title="Try a diagnosis">
                Upload a leaf photo and read the explanation.
              </Step>
              <Step done={total > 0} title="Run the federated experiments (A–D)">
                Compare random vs adaptive client selection, with and without Top-k compression.
              </Step>
              <Step done={total > 0} title="Import results and explore analytics">
                Results appear under FL experiments and Results &amp; analytics.
              </Step>
            </ol>
          </Card>
        </section>
      </div>

      <section aria-labelledby="recent-exp">
        <h2 id="recent-exp" className="mb-3 text-lg font-semibold">Recent experiments</h2>
        {expLoading ? (
          <p role="status" className="text-sm text-muted">Loading experiments…</p>
        ) : expError ? (
          <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-warning">{expError}</p>
        ) : total === 0 ? (
          <EmptyState
            title="No experiments yet"
            message="Metrics appear here after real experiment results are imported from the Python pipeline."
          />
        ) : (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
              {experiments.slice(0, 5).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                  <span className="font-medium">{e.name}</span>
                  <span className="text-muted">{e.status ?? "status unknown"} · {fmtDate(e.createdAt)}</span>
                </li>
              ))}
            </ul>
            <Link href="/experiments" className="mt-3 inline-block text-sm text-primary underline">
              View all experiments
            </Link>
          </>
        )}
      </section>
    </div>
  );
}
