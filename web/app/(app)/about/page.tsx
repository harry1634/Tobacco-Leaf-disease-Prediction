import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Project information" };

const experiments = [
  ["A", "FedAvg baseline", "Random client sampling, full (dense) updates"],
  ["B", "FedAvg + adaptive selection", "Score-based client sampling, dense updates"],
  ["C", "FedAvg + Top-k compression", "Random client sampling, sparse Top-k updates"],
  ["D", "FedAvg + both", "Score-based client sampling, sparse Top-k updates"],
];

export default function AboutPage() {
  return (
    <>
      <PageHeader title="Project information" description="What this project studies, and how the experiments are run and measured." />
      <div className="max-w-4xl space-y-5">
        <Card title="Problem statement">
          <p className="text-sm leading-6">
            Tobacco leaf diseases reduce yield and quality, and growers benefit from fast image-based diagnosis. Training a good
            classifier needs many labelled images, but images are held by different farms or institutions and may not be shared.
            Federated learning (FL) trains one shared model without moving the raw images. Its main cost is communication: every
            round, clients and server exchange the whole model. This project asks whether choosing clients more carefully and
            sending only the largest parts of each update can cut that cost without hurting diagnostic quality.
          </p>
        </Card>

        <Card title="Objectives">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
            <li>Build a MobileNetV2 tobacco-leaf classifier and a centralised baseline.</li>
            <li>Simulate federated clients with Flower and implement FedAvg.</li>
            <li>Add adaptive client selection and Top-k update compression, alone and together.</li>
            <li>Compare all four set-ups on accuracy, macro-F1, convergence speed and bytes transmitted.</li>
          </ul>
        </Card>

        <Card title="Federated-learning workflow (one round)">
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6">
            <li>The server chooses which clients take part (random, or by the adaptive score).</li>
            <li>It sends the current global model to them (downlink, dense).</li>
            <li>Each client trains on its own images for a few local epochs.</li>
            <li>Each client sends back its update, the difference between its trained and the received model (uplink), optionally compressed.</li>
            <li>The server rebuilds the updates and averages them, weighted by each client&apos;s number of images (FedAvg).</li>
            <li>The new global model is evaluated on a validation set; metrics and bytes are recorded.</li>
          </ol>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <Card title="Adaptive client selection">
            <p className="text-sm leading-6">
              Each client gets a score from three min-max normalised parts: its last reported local training loss (clients that still
              struggle teach the model more), how many rounds ago it was last chosen (fairness, so nobody is starved), and its
              number of images. Default weights are 0.5, 0.3 and 0.2. A client that has never been chosen is treated as having the
              highest loss so every client is tried. The server picks the highest-scoring clients each round.
            </p>
          </Card>
          <Card title="Top-k update compression">
            <p className="text-sm leading-6">
              A client keeps only the k% of learned-weight update values with the largest magnitude (default 10%) and sends their positions and values. The small BatchNorm statistics are not compressed; they are always sent in full.
              The server rebuilds a full-size update by filling the rest with zeros. The values that were not sent are remembered on
              the client and added to its next update (error feedback), so information is delayed rather than lost. A sparse entry
              costs 8 bytes (4 for the position, 4 for the value) against 4 bytes for a dense one.
            </p>
          </Card>
        </div>

        <Card title="Experimental methodology">
          <p className="mb-3 text-sm leading-6">
            All four experiments use the same architecture, the same data partition across clients, the same training settings and
            the same random seed. Only the selection rule and the compression change.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-muted"><tr><th className="py-1 pr-3 font-medium">ID</th><th className="py-1 pr-3 font-medium">Name</th><th className="py-1 font-medium">What changes</th></tr></thead>
              <tbody className="divide-y divide-border">
                {experiments.map(([id, name, what]) => (
                  <tr key={id}><td className="py-1.5 pr-3 font-medium">{id}</td><td className="py-1.5 pr-3">{name}</td><td className="py-1.5">{what}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-6">
            <li><span className="font-medium">Data:</span> the 16-class Tobacco Leaf Abnormality set (Lin et al., Macao Polytechnic University), real images only, with a fixed train / validation / test split.</li>
            <li><span className="font-medium">Metrics:</span> accuracy, macro precision, macro recall, macro-F1, confusion matrix, per-class and per-client results.</li>
            <li><span className="font-medium">Communication:</span> bytes actually serialised in both directions, counted per round.</li>
            <li><span className="font-medium">Convergence:</span> first round whose validation accuracy is within 1 percentage point of the best accuracy that run reached.</li>
          </ul>
        </Card>

        <Card title="Limitations">
          <ul className="list-disc space-y-1 pl-5 text-sm leading-6">
            <li>The dataset is small. Four classes have 1 validation and 1 test image, so their individual scores are unreliable.</li>
            <li>Clients are simulated on one machine, so timing and network effects are not measured; only bytes are.</li>
            <li>The diagnosis page is not a medical or agronomic authority; predictions are model estimates.</li>
          </ul>
        </Card>
      </div>
    </>
  );
}
