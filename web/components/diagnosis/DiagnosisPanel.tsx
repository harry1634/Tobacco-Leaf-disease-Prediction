"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { getFirebaseDb } from "@/lib/firebase";
import { DISEASES, niceName } from "@/lib/diseases";
import { ALLOWED_TYPES,inferenceUrl, predict, validateImage, type Prediction } from "@/lib/inference";

type Status = "idle" | "running" | "done" | "error";

export function DiagnosisPanel() {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<Prediction | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Release the preview's memory when it changes or the page closes.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0] ?? null;
    setResult(null); setRunError(null); setStatus("idle");
    if (!picked) { setFile(null); setPreviewUrl(null); setFileError(null); return; }
    const problem = validateImage(picked);
    setFileError(problem);
    if (problem) { setFile(null); setPreviewUrl(null); return; }
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
  }

  async function onDiagnose() {
    if (!file || !user) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("running"); setRunError(null); setResult(null);
    try {
      const p = await predict(file, ctrl.signal);
      setResult(p); setStatus("done");
      // Save only metadata (label + confidence), never the image.
      await addDoc(collection(getFirebaseDb(), "users", user.uid, "predictions"), {
        label: p.label, confidence: p.confidence, ...(p.modelVersion ? { modelVersion: p.modelVersion } : {}), createdAt: serverTimestamp(),
      }).catch(() => undefined);
    } catch (err) {
      if (ctrl.signal.aborted) return;
      setRunError(err instanceof Error ? err.message : "Prediction failed.");
      setStatus("error");
    }
  }

  const connected = Boolean(inferenceUrl);
  const info = result ? DISEASES[result.label] : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-surface p-5" aria-labelledby="up">
        <h2 id="up" className="font-medium">1. Choose a leaf image</h2>
        <p className="mt-1 text-sm text-muted">JPEG, PNG or WebP, up to 15 MB (large photos are shrunk before sending). The image stays in your browser and is not uploaded unless a model service is connected.</p>
        <label htmlFor="leaf" className="mt-4 block text-sm font-medium">Tobacco leaf image</label>
        <input id="leaf" type="file" accept={ALLOWED_TYPES.join(",")} onChange={onPick}
          aria-describedby={fileError ? "leaf-err" : undefined} aria-invalid={Boolean(fileError)}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-background hover:file:bg-primary-hover" />
        {fileError && <p id="leaf-err" role="alert" className="mt-2 text-sm text-warning">{fileError}</p>}

        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL preview; next/image cannot optimise it
          <img src={previewUrl} alt="Preview of the selected leaf" className="mt-4 max-h-80 w-full rounded-md border border-border object-contain" />
        )}

        <button type="button" onClick={onDiagnose} disabled={!file || !connected || status === "running"}
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-background hover:bg-primary-hover disabled:opacity-50">
          {status === "running" ? "Analysing…" : "Diagnose"}
        </button>
        {!connected && <p className="mt-2 text-sm text-muted">The Diagnose button is disabled because no model is connected yet.</p>}
      </section>

      <section className="rounded-lg border border-border bg-surface p-5" aria-labelledby="res" aria-live="polite">
        <h2 id="res" className="font-medium">2. Result</h2>
        {!connected && (
          <div className="mt-3 rounded-md bg-warning-soft p-4 text-sm text-warning">
            <p className="font-medium">Placeholder: no trained model is connected.</p>
            <p className="mt-1">Predictions only appear here once a real trained model service is connected. Nothing on this page is simulated.</p>
          </div>
        )}
        {connected && status === "idle" && <p className="mt-3 text-sm text-muted">Choose an image and press Diagnose.</p>}
        {status === "running" && <p role="status" className="mt-3 text-sm text-muted">Waiting for the model…</p>}
        {status === "error" && <p role="alert" className="mt-3 rounded-md bg-warning-soft p-3 text-sm text-warning">{runError}</p>}
        {status === "done" && result && (
          <div className="mt-3 space-y-3">
            <dl>
              <dt className="text-sm text-muted">Predicted class</dt>
              <dd className="text-xl font-semibold">{niceName(result.label)}</dd>
              {info && <dd className="text-sm text-muted">Model label: {result.label}</dd>}
            </dl>
            {info && (
              <div className="rounded-md border border-border p-4 text-sm">
                <p className="font-medium">
                  What is this?{" "}
                  <span className="ml-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium">
                    Cause: {info.cause}{info.agent ? ` (${info.agent})` : ""}
                  </span>
                </p>
                <p className="mt-2">{info.summary}</p>
                <p className="mt-2"><span className="font-medium">What it usually looks like: </span>{info.signs}</p>
              </div>
            )}
            <dl>
              <dt className="text-sm text-muted">Confidence</dt>
              <dd>
                <span className="text-xl font-semibold">{(result.confidence * 100).toFixed(1)}%</span>
                <span className="mt-1 block h-2 w-full overflow-hidden rounded-full bg-primary-soft" aria-hidden><span className="block h-full bg-primary" style={{ width: `${result.confidence * 100}%` }} /></span>
              </dd>
            </dl>
            {result.confidence < 0.5 && (
              <p role="status" className="rounded-md bg-warning-soft p-3 text-sm text-warning">
                Low confidence. The model is unsure about this image, so treat the result with caution.
              </p>
            )}
            {result.top && result.top.length > 1 && (
              <dl>
                <dt className="text-sm text-muted">Top guesses</dt>
                <dd>
                  <ol className="mt-1 space-y-1 text-sm">
                    {result.top.map((g) => (
                      <li key={g.label} className="flex justify-between gap-4">
                        <span>{niceName(g.label)}</span>
                        <span className="tabular-nums text-muted">{(g.confidence * 100).toFixed(1)}%</span>
                      </li>
                    ))}
                  </ol>
                </dd>
              </dl>
            )}
            <p className="text-sm text-muted">
              This is a model estimate, not a professional diagnosis. Photos taken with different cameras or lighting than the
              training data may be less reliable.{result.modelVersion ? ` Model: ${result.modelVersion}.` : ""}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
