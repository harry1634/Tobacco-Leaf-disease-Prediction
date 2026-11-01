// Client for an optional model-inference service. No service exists yet, so by default
// `inferenceUrl` is empty and the diagnosis page shows a "no model connected" state.
//
// Contract the future service must follow:
//   POST {inferenceUrl}   multipart/form-data with one field "file" (jpeg/png/webp)
//   200 -> { "label": string, "confidence": number between 0 and 1, "modelVersion"?: string }
export const inferenceUrl = process.env.NEXT_PUBLIC_INFERENCE_URL ?? "";

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 5 * 1024 * 1024;

export type Guess = { label: string; confidence: number };
export type Prediction = { label: string; confidence: number; modelVersion?: string; top?: Guess[] };

const isProb = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;

export function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Unsupported file type. Please choose a JPEG, PNG or WebP image.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_BYTES) return `The image is too large (${(file.size / 1048576).toFixed(1)} MB). The limit is 5 MB.`;
  return null;
}

export async function predict(file: File, signal?: AbortSignal): Promise<Prediction> {
  if (!inferenceUrl) throw new Error("No model is connected.");
  const body = new FormData();
  body.append("file", file);
  const res = await fetch(inferenceUrl, { method: "POST", body, signal });
  if (!res.ok) throw new Error(`The model service returned an error (${res.status}).`);
  const data: unknown = await res.json();
  const d = data as Partial<Prediction> | null;
  if (!d || typeof d.label !== "string" || !d.label || typeof d.confidence !== "number" || !(d.confidence >= 0 && d.confidence <= 1)) {
    throw new Error("The model service returned an invalid response.");
  }
  const top = Array.isArray(d.top)
    ? d.top.filter((g): g is Guess => typeof g?.label === "string" && isProb(g?.confidence)).slice(0, 3)
    : undefined;
  return { label: d.label, confidence: d.confidence, modelVersion: typeof d.modelVersion === "string" ? d.modelVersion : undefined, top };
}
