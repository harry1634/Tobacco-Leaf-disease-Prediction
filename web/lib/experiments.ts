import { collection, doc, getDoc, getDocs, type DocumentData } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import type { ClassMetric, ClientMetric, ConfusionRow, Experiment, ExperimentStatus, RoundMetrics } from "@/types/experiment";

// Only finite numbers count as recorded values; everything else becomes null (never 0).
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const STATUSES: ExperimentStatus[] = ["completed", "running", "failed"];

export function parseExperiment(id: string, data: DocumentData): Experiment {
  const c = data.config ?? {};
  const s = data.summary ?? {};
  const created = data.createdAt?.toDate?.();
  const perClass: ClassMetric[] = arr(data.perClass).map((x) => {
    const m = (x ?? {}) as DocumentData;
    return { label: str(m.label) ?? "?", precision: num(m.precision), recall: num(m.recall), f1: num(m.f1), support: num(m.support) };
  });
  const perClient: ClientMetric[] = arr(data.perClient).map((x) => {
    const m = (x ?? {}) as DocumentData;
    return { clientId: String(m.clientId ?? "?"), numSamples: num(m.numSamples), timesSelected: num(m.timesSelected), accuracy: num(m.accuracy) };
  });
  const confusionMatrix: ConfusionRow[] = arr(data.confusionMatrix).map((x) => {
    const m = (x ?? {}) as DocumentData;
    return { actual: str(m.actual) ?? "?", counts: arr(m.counts).map((n) => num(n) ?? 0) };
  });
  return {
    id,
    name: str(data.name) ?? id,
    status: STATUSES.includes(data.status) ? data.status : null,
    createdAt: created instanceof Date ? created : null,
    config: {
      numClients: num(c.numClients),
      clientsPerRound: num(c.clientsPerRound),
      rounds: num(c.rounds),
      selectionStrategy: str(c.selectionStrategy),
      compression: str(c.compression),
      topkRatio: num(c.topkRatio),
      distribution: str(c.distribution),
      model: str(c.model),
      dataset: str(c.dataset),
      seed: num(c.seed),
    },
    summary: {
      accuracy: num(s.accuracy),
      macroPrecision: num(s.macroPrecision),
      macroRecall: num(s.macroRecall),
      macroF1: num(s.macroF1),
      roundsToConvergence: num(s.roundsToConvergence),
      totalCommBytes: num(s.totalCommBytes),
      uplinkBytes: num(s.uplinkBytes),
    },
    classNames: arr(data.classNames).map(String),
    perClass,
    perClient,
    confusionMatrix,
  };
}

export function parseRound(data: DocumentData): RoundMetrics {
  return {
    round: num(data.round) ?? 0,
    accuracy: num(data.accuracy),
    macroPrecision: num(data.macroPrecision),
    macroRecall: num(data.macroRecall),
    macroF1: num(data.macroF1),
    trainLoss: num(data.trainLoss),
    valLoss: num(data.valLoss),
    commBytes: num(data.commBytes),
    selectedClients: arr(data.selectedClients).map(String),
  };
}

// Newest first. Sorting is done here so no Firestore index is needed.
export async function fetchExperiments(uid: string): Promise<Experiment[]> {
  const snap = await getDocs(collection(getFirebaseDb(), "users", uid, "experiments"));
  return snap.docs
    .map((d) => parseExperiment(d.id, d.data()))
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

export async function fetchExperiment(uid: string, expId: string): Promise<Experiment | null> {
  const snap = await getDoc(doc(getFirebaseDb(), "users", uid, "experiments", expId));
  return snap.exists() ? parseExperiment(snap.id, snap.data()) : null;
}

export async function fetchRounds(uid: string, expId: string): Promise<RoundMetrics[]> {
  const snap = await getDocs(collection(getFirebaseDb(), "users", uid, "experiments", expId, "rounds"));
  return snap.docs.map((d) => parseRound(d.data())).sort((a, b) => a.round - b.round);
}

// ---- display helpers: null always renders as an em dash, never as 0 ----
export const fmtPercent = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);
export const fmtScore = (v: number | null) => (v === null ? "—" : v.toFixed(3));
export const fmtDate = (d: Date | null) => (d ? d.toLocaleDateString() : "—");
export const fmtText = (v: string | number | null) => (v === null ? "—" : String(v));

export function fmtBytes(v: number | null): string {
  if (v === null) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = v;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}
