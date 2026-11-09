import { Card } from "@/components/ui/Card";

// The experiment DESIGN (what will be compared). These are plans, not results: no numbers appear here.
const plan = [
  ["A", "Random", "None", "Baseline: standard FedAvg"],
  ["B", "Adaptive", "None", "Does smarter client selection help?"],
  ["C", "Random", "Top-k", "Does compressing updates cut cost?"],
  ["D", "Adaptive", "Top-k", "Both ideas together (the proposed method)"],
];

const steps = [
  ["Run", "python -m src.federated.run_all", "Trains A to D one after another (hours on a CPU, so use a Colab GPU)."],
  ["Compare", "python -m src.export.compare", "Checks the runs against each other and writes a summary file."],
  ["Import", "python -m src.export.import_to_firestore --uid <YOUR_UID> --service-account <key.json>", "Copies the results into your private area. Keep the key file outside the project."],
];

export function ExperimentPlan() {
  return (
    <div className="space-y-6">
      <Card title="What will be compared (planned, no results yet)">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">Planned experiments A to D</caption>
            <thead className="text-muted">
              <tr>{["", "Client selection", "Compression", "Question it answers"].map((h) => <th key={h} scope="col" className="px-3 py-1.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border">
              {plan.map(([id, sel, comp, why]) => (
                <tr key={id}>
                  <th scope="row" className="px-3 py-2 font-semibold text-primary">Experiment {id}</th>
                  <td className="px-3 py-2">{sel}</td>
                  <td className="px-3 py-2">{comp}</td>
                  <td className="px-3 py-2 text-muted">{why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          All four share the same data split, model and random seed, so differences come only from selection and compression.
          Default settings: 8 clients, 4 chosen per round, 20 rounds, uneven (Dirichlet 0.5) data split, Top-k keeps 10% of each update.
        </p>
      </Card>

      <Card title="How results get onto this page">
        <ol className="space-y-4 text-sm">
          {steps.map(([title, cmd, text], i) => (
            <li key={title} className="flex gap-3">
              <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">{i + 1}</span>
              <span className="min-w-0">
                <span className="font-medium">{title}</span>
                <code className="mt-1 block overflow-x-auto rounded-md bg-primary-soft px-3 py-1.5 text-xs">{cmd}</code>
                <span className="mt-1 block text-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">Run these from the <code>ml</code> folder. Full steps are in the project&apos;s setup guide.</p>
      </Card>
    </div>
  );
}
