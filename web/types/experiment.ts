// Shapes of the documents under users/{uid}/experiments/{id} (+ /rounds/{r}).
// Any metric may be null: null means "not recorded", which is different from 0.
export type ExperimentStatus = "completed" | "running" | "failed";

export type ExperimentConfig = {
  numClients: number | null;
  clientsPerRound: number | null;
  rounds: number | null;
  selectionStrategy: string | null; // e.g. "random" | "adaptive"
  compression: string | null; // e.g. "none" | "topk"
  topkRatio: number | null;
  distribution: string | null; // "iid" | "non-iid"
  model: string | null;
  dataset: string | null;
  seed: number | null;
};

export type ExperimentSummary = {
  accuracy: number | null;
  macroPrecision: number | null;
  macroRecall: number | null;
  macroF1: number | null;
  roundsToConvergence: number | null;
  totalCommBytes: number | null;
  uplinkBytes: number | null;
};

export type ClassMetric = {
  label: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  support: number | null;
};

export type ClientMetric = {
  clientId: string;
  numSamples: number | null;
  timesSelected: number | null;
  accuracy: number | null; // final global model accuracy on this client's local data
};

export type ConfusionRow = { actual: string; counts: number[] };

export type Experiment = {
  id: string;
  name: string;
  status: ExperimentStatus | null;
  createdAt: Date | null;
  config: ExperimentConfig;
  summary: ExperimentSummary;
  classNames: string[];
  perClass: ClassMetric[];
  perClient: ClientMetric[];
  confusionMatrix: ConfusionRow[];
};

export type RoundMetrics = {
  round: number;
  accuracy: number | null;
  macroPrecision: number | null;
  macroRecall: number | null;
  macroF1: number | null;
  trainLoss: number | null;
  valLoss: number | null;
  commBytes: number | null; // bytes transmitted in this round (uplink + downlink)
  selectedClients: string[];
};
