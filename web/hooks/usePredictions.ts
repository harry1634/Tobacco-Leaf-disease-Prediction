"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { fetchPredictions, type SavedPrediction } from "@/lib/predictions";

type State = { predictions: SavedPrediction[]; loading: boolean; error: boolean };

export function usePredictions(): State {
  const { user } = useAuth();
  const uid = user?.uid ?? null;
  const [state, setState] = useState<State>({ predictions: [], loading: true, error: false });

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    fetchPredictions(uid)
      .then((predictions) => !cancelled && setState({ predictions, loading: false, error: false }))
      .catch(() => !cancelled && setState({ predictions: [], loading: false, error: true }));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return state;
}
