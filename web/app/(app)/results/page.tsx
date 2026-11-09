import type { Metadata } from "next";
import { ResultsContent } from "@/components/results/ResultsContent";
import { PageHeader } from "@/components/ui/PageHeader";
import { PurposeNote } from "@/components/ui/PurposeNote";

export const metadata: Metadata = { title: "Results and analytics" };

export default function ResultsPage() {
  return (
    <>
      <PageHeader
        title="Results and analytics"
        description="Accuracy, loss, macro-F1, communication cost and client participation, from real imported experiments."
      />
      <PurposeNote>
        <p>
          This is where the project&apos;s main question is answered: can choosing clients smartly and sending only the largest part of
          each update keep accuracy while sending far fewer bytes?
        </p>
        <p>Pick experiments with the buttons to compare them on the same charts. Each experiment keeps its own colour.</p>
      </PurposeNote>
      <ResultsContent />
    </>
  );
}
