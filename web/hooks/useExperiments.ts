"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchExperiments } from "@/lib/experiments";
import type { Experiment } from "@/types/experiment";

type State = { experiments: Experiment[]; loading: boolean; error: string | null };

// Loads the signed-in user's imported experiments from Firestore.
export function useExperiments(): State {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<State>({ experiments: [], loading: true, error: null });

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    fetchExperiments(uid)
      .then((experiments) => !cancelled && setState({ experiments, loading: false, error: null }))
      .catch(() => !cancelled && setState({ experiments: [], loading: false, error: "Could not load experiments. Check your connection and Firestore setup." }));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return state;
}
