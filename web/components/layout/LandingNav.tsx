"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";

// Shows Log in / Register to visitors and a Dashboard link to signed-in users.
export function LandingNav() {
  const { user, loading } = useAuth();
  const ghost = "rounded-md px-3 py-1.5 hover:bg-primary-soft";
  const solid = "rounded-md bg-primary px-3 py-1.5 font-medium text-background hover:bg-primary-hover";
  return (
    <nav aria-label="Account" className="flex gap-2 text-sm">
      {loading ? null : user ? (
        <Link href="/dashboard" className={solid}>Open dashboard</Link>
      ) : (
        <>
          <Link href="/login" className={ghost}>Log in</Link>
          <Link href="/register" className={solid}>Register</Link>
        </>
      )}
    </nav>
  );
}
