import type { Metadata } from "next";
import { DiagnosisPanel } from "@/components/diagnosis/DiagnosisPanel";
import { DiseaseGuide } from "@/components/diagnosis/DiseaseGuide";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Disease diagnosis" };

export default function DiagnosisPage() {
  return (
    <>
      <PageHeader title="Disease diagnosis" description="Upload a tobacco leaf image to classify its disease." />
      <DiagnosisPanel />
      <DiseaseGuide />
    </>
  );
}
