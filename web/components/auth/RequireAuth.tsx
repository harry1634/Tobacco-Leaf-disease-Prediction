"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/ui/EmptyState";

// Wraps pages that need a logged-in user. This only improves the user experience;
// real data protection comes from Firestore security rules (Phase 4).
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (configured && !loading && !user) router.replace("/login");
  }, [configured, loading, user, router]);

  if (!configured) {
    return (
      <EmptyState
        title="Firebase is not configured"
        message="Add the NEXT_PUBLIC_FIREBASE_* values to web/.env.local and restart the dev server."
      />
    );
  }
  if (loading || !user) {
    return <p role="status" className="p-6 text-muted">Checking your session…</p>;
  }
  return <>{children}</>;
}
