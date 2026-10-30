
"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Chrome, LoaderCircle } from "lucide-react";
import { supabase, supabaseConfigured } from "@/lib/supabase";

function AuthForm() {
  const params = useSearchParams();

  const role = params.get("role") === "owner" ? "owner" : "customer";
  const mode = params.get("mode") === "signup" ? "signup" : "login";

  const requestedNext = params.get("next");
  const next =
    role === "owner"
      ? !requestedNext || requestedNext === "/restaurant-admin"
        ? "/restaurant-registration"
        : requestedNext
      : requestedNext || "/my-orders";

  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage(
        "Supabase is not configured. Check your .env.local file.",
      );
      return;
    }

    setBusy(true);

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim(),
              requested_role: role,
            },
            emailRedirectTo:
              `${window.location.origin}/auth/callback?next=` +
              encodeURIComponent(next),
          },
        });

        if (error) throw error;

        if (data.session) {
          window.location.href = next;
          return;
        }

        setMessage(
          "Account created. Check your email to confirm your address, then sign in.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        window.location.href = next;
        return;
      }
    } catch (err: unknown) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    if (!supabase) {
      setMessage("Supabase is not configured. Check .env.local.");
      return;
    }

    setMessage("");
    setBusy(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo:
            `${window.location.origin}/auth/callback?next=` +
            encodeURIComponent(next),
          queryParams: {
            // This is only a signup request, not an authorization grant.
            access_type: "offline",
          },
        },
      });

      if (error) throw error;
    } catch (err: unknown) {
      setMessage(
        err instanceof Error
          ? err.message
          : "Google sign-in failed. Please try again.",
      );
      setBusy(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/">
          Tho<span>’</span>am<span className="wordmark-dot">.</span>
        </Link>

        <Link
          href={role === "owner" ? "/owner" : "/"}
          className="muted"
          style={{
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <ArrowLeft size={15} />
          Back
        </Link>
      </header>

      <main className="auth-wrap">
        <section className="auth-card">
          <div className="brand-mark">T.</div>

          <div className="eyebrow" style={{ textAlign: "center" }}>
            {role === "owner"
              ? "RESTAURANT PARTNER"
              : "WELCOME TO THO'AM"}
          </div>

          <h1 style={{ textAlign: "center" }}>
            {isSignup
              ? role === "owner"
                ? "Create partner account"
                : "Create your account"
              : "Welcome back."}
          </h1>

          <p
            className="muted"
            style={{
              textAlign: "center",
              fontSize: 13,
              marginBottom: 22,
            }}
          >
            {isSignup
              ? "A few details to get you started."
              : "Sign in to continue to Tho'am."}
          </p>

          <button
            type="button"
            className="button button-light full"
            onClick={google}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Chrome size={17} />
            )}
            Continue with Google
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "20px 0",
              color: "#999",
              fontSize: 11,
            }}
          >
            <span
              style={{
                height: 1,
                background: "#eee",
                flex: 1,
              }}
            />
            OR WITH EMAIL
            <span
              style={{
                height: 1,
                background: "#eee",
                flex: 1,
              }}
            />
          </div>

          <form className="form-stack" onSubmit={submit}>
            {isSignup && (
              <label className="field">
                Full name
                <input
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                />
              </label>
            )}

            <label className="field">
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label className="field">
              Password
              <input
                type="password"
                required
                minLength={6}
                autoComplete={
                  isSignup ? "new-password" : "current-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
              />
            </label>

            <button
              type="submit"
              className="button button-dark full"
              disabled={busy}
            >
              {busy && <LoaderCircle size={16} className="spin" />}
              {isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          {message && (
            <p className="notice" role="alert" style={{ marginTop: 14 }}>
              {message}
            </p>
          )}

          <p
            style={{
              textAlign: "center",
              fontSize: 12,
              color: "#777",
              marginTop: 22,
            }}
          >
            {isSignup
              ? "Already have an account?"
              : "New to Tho'am?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsSignup((current) => !current);
                setMessage("");
              }}
              style={{
                border: 0,
                background: "none",
                fontWeight: 800,
                textDecoration: "underline",
              }}
            >
              {isSignup ? "Sign in" : "Create account"}
            </button>
          </p>

          {role === "owner" && (
            <p className="footer-note">
              Restaurant partner accounts must be authorized before
              managing restaurant orders.
            </p>
          )}

          {!supabaseConfigured && (
            <p className="footer-note">
              Authentication will work after Supabase environment
              variables are configured.
            </p>
          )}
        </section>
      </main>
    </>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-wrap">
          <section className="auth-card">Loading sign in…</section>
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
