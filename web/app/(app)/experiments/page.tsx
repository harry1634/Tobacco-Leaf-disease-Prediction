import type { Metadata } from "next";
import { ExperimentsTable } from "@/components/experiments/ExperimentsTable";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Federated-learning experiments" };

export default function ExperimentsPage() {
  return (
    <>
      <PageHeader
        title="Federated-learning experiments"
        description="Configurations and status of the FedAvg, adaptive selection and Top-k runs."
      />
      <ExperimentsTable />
    </>
  );
}
