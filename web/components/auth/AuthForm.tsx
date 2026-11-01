"use client";

import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { authErrorMessage } from "@/lib/authErrors";
import { getFirebaseAuth } from "@/lib/firebase";

type Mode = "login" | "register";
type FieldErrors = { email?: string; password?: string; confirm?: string };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(mode: Mode, email: string, password: string, confirm: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!EMAIL_RE.test(email.trim())) errors.email = "Enter a valid email address.";
  if (mode === "register" && password.length < 8) errors.password = "Use at least 8 characters.";
  if (mode === "login" && !password) errors.password = "Enter your password.";
  if (mode === "register" && confirm !== password) errors.confirm = "Passwords do not match.";
  return errors;
}

const inputClass =
  "mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary-soft";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const { user, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in (or just logged in): go to the dashboard.
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const found = validate(mode, email, password, confirm);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      const auth = getFirebaseAuth();
      if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      // Redirect happens in the effect above once Firebase reports the user.
    } catch (err) {
      setFormError(authErrorMessage(err));
      setSubmitting(false);
    }
  }

  const isLogin = mode === "login";
  return (
    <main className="mx-auto max-w-md px-4 py-12">
      <Link href="/" className="text-sm font-semibold text-primary">Tobacco FL Diagnosis</Link>
      <h1 className="mt-4 text-2xl font-semibold">{isLogin ? "Log in" : "Create an account"}</h1>

      {!configured && (
        <p role="alert" className="mt-4 rounded-md bg-warning-soft p-3 text-sm text-warning">
          Firebase is not configured. Fill in web/.env.local and restart the dev server.
        </p>
      )}

      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4 rounded-lg border border-border bg-surface p-5">
        {formError && (
          <p role="alert" className="rounded-md bg-warning-soft p-3 text-sm text-warning">{formError}</p>
        )}

        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" type="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} className={inputClass}
            aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-err" : undefined} />
          {errors.email && <p id="email-err" className="mt-1 text-sm text-warning">{errors.email}</p>}
        </div>

        <div>
          <label htmlFor="password" className="text-sm font-medium">Password</label>
          <input id="password" type="password" autoComplete={isLogin ? "current-password" : "new-password"}
            value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass}
            aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "pw-err" : undefined} />
          {errors.password && <p id="pw-err" className="mt-1 text-sm text-warning">{errors.password}</p>}
        </div>

        {!isLogin && (
          <div>
            <label htmlFor="confirm" className="text-sm font-medium">Confirm password</label>
            <input id="confirm" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} className={inputClass}
              aria-invalid={Boolean(errors.confirm)} aria-describedby={errors.confirm ? "confirm-err" : undefined} />
            {errors.confirm && <p id="confirm-err" className="mt-1 text-sm text-warning">{errors.confirm}</p>}
          </div>
        )}

        <button type="submit" disabled={submitting || !configured}
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-background hover:bg-primary-hover disabled:opacity-60">
          {submitting ? "Please wait…" : isLogin ? "Log in" : "Register"}
        </button>
      </form>

      <p className="mt-4 text-sm text-muted">
        {isLogin ? "No account yet? " : "Already registered? "}
        <Link href={isLogin ? "/register" : "/login"} className="text-primary underline">
          {isLogin ? "Register" : "Log in"}
        </Link>
      </p>
    </main>
  );
}
