import type { Metadata } from "next";
import { ResultsContent } from "@/components/results/ResultsContent";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Results and analytics" };

export default function ResultsPage() {
  return (
    <>
      <PageHeader
        title="Results and analytics"
        description="Accuracy, loss, macro-F1, communication cost and client participation, from real imported experiments."
      />
      <ResultsContent />
    </>
  );
}
