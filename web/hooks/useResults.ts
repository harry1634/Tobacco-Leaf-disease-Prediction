"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchExperiments, fetchRounds } from "@/lib/experiments";
import type { Experiment, RoundMetrics } from "@/types/experiment";

export type ExperimentWithRounds = Experiment & { rounds: RoundMetrics[] };
type State = { items: ExperimentWithRounds[]; loading: boolean; error: string | null };

// Loads every experiment of the signed-in user together with its per-round metrics.
export function useResults(): State {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<State>({ items: [], loading: true, error: null });

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    (async () => {
      try {
        const experiments = await fetchExperiments(uid);
        const items = await Promise.all(
          experiments.map(async (e) => ({ ...e, rounds: await fetchRounds(uid, e.id) })),
        );
        if (!cancelled) setState({ items, loading: false, error: null });
      } catch {
        if (!cancelled) setState({ items: [], loading: false, error: "Could not load results. Check your connection and that the Firestore rules are published." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return state;
}
