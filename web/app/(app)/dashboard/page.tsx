import type { Metadata } from "next";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Your diagnoses, project progress and imported federated-learning experiments." />
      <DashboardContent />
    </>
  );
}
