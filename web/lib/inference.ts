// Client for an optional model-inference service. No service exists yet, so by default
// `inferenceUrl` is empty and the diagnosis page shows a "no model connected" state.
//
// Contract the future service must follow:
//   POST {inferenceUrl}   multipart/form-data with one field "file" (jpeg/png/webp)
//   200 -> { "label": string, "confidence": number between 0 and 1, "modelVersion"?: string }
export const inferenceUrl = process.env.NEXT_PUBLIC_INFERENCE_URL ?? "";

export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_BYTES = 15 * 1024 * 1024;
// The hosted function accepts request bodies of at most 4.5 MB, so larger photos are shrunk first.
const UPLOAD_TARGET_BYTES = 3.5 * 1024 * 1024;
const UPLOAD_MAX_SIDE = 1600;

export type Guess = { label: string; confidence: number };
export type Prediction = { label: string; confidence: number; modelVersion?: string; top?: Guess[] };

const isProb = (v: unknown): v is number => typeof v === "number" && v >= 0 && v <= 1;

export function validateImage(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Unsupported file type. Please choose a JPEG, PNG or WebP image.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAX_BYTES) return `The image is too large (${(file.size / 1048576).toFixed(1)} MB). The limit is 15 MB.`;
  return null;
}

/** Return the file unchanged if it is small enough, otherwise a smaller JPEG copy (longest side 1600 px). */
export async function shrinkForUpload(file: File): Promise<File> {
  if (file.size <= UPLOAD_TARGET_BYTES) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser could not prepare the image.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  for (const quality of [0.9, 0.8, 0.7, 0.6]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    if (blob && blob.size <= UPLOAD_TARGET_BYTES) return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  }
  throw new Error("The image could not be made small enough to upload. Try a smaller photo.");
}

export async function predict(file: File, signal?: AbortSignal): Promise<Prediction> {
  if (!inferenceUrl) throw new Error("No model is connected.");
  const body = new FormData();
  body.append("file", await shrinkForUpload(file));
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
