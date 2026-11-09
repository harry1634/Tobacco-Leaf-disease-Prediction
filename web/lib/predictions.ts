import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";

export type SavedPrediction = { id: string; label: string; confidence: number; createdAt: Date | null };

// The signed-in user's saved diagnoses (label + confidence only, never images), newest first.
export async function fetchPredictions(uid: string, max = 50): Promise<SavedPrediction[]> {
  const q = query(collection(getFirebaseDb(), "users", uid, "predictions"), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.flatMap((d) => {
    const data = d.data();
    if (typeof data.label !== "string" || typeof data.confidence !== "number") return [];
    const created = data.createdAt?.toDate?.();
    return [{ id: d.id, label: data.label, confidence: data.confidence, createdAt: created instanceof Date ? created : null }];
  });
}
