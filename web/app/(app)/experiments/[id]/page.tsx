import type { Metadata } from "next";
import { ExperimentDetail } from "@/components/experiments/ExperimentDetail";

export const metadata: Metadata = { title: "Experiment details" };

export default async function ExperimentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExperimentDetail id={id} />;
}
