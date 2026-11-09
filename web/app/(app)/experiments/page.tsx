import type { Metadata } from "next";
import { ExperimentsTable } from "@/components/experiments/ExperimentsTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PurposeNote } from "@/components/ui/PurposeNote";

export const metadata: Metadata = { title: "Federated-learning experiments" };

export default function ExperimentsPage() {
  return (
    <>
      <PageHeader
        title="Federated-learning experiments"
        description="Configurations and status of the FedAvg, adaptive selection and Top-k runs."
      />
      <PurposeNote>
        <p>
          This is the project&apos;s research log. Each row is one federated-learning run: how many clients took part, how many
          rounds it ran, how clients were chosen, and whether updates were compressed.
        </p>
        <p>Open a run to see its settings, per-round numbers, per-disease scores and which clients were used. Use it to check that runs were set up fairly before you compare their results.</p>
      </PurposeNote>
      <ExperimentsTable />
    </>
  );
}
