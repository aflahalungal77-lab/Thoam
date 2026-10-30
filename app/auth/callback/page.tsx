"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function AuthCallbackContent() {
  const params = useSearchParams();
  const [message, setMessage] = useState("Completing sign in…");

  useEffect(() => {
    let alive = true;

    async function run() {
      if (!supabase) {
        setMessage("Supabase is not configured.");
        return;
      }

      try {
        const code = params.get("code");
        const requestedNext = params.get("next") || "/my-orders";

        // Prevent external redirects and send owner onboarding through registration.
        const safeNext =
          requestedNext.startsWith("/") &&
          !requestedNext.startsWith("//") &&
          !requestedNext.startsWith("/\\")
            ? requestedNext
            : "/my-orders";
        const next =
          safeNext === "/restaurant-admin"
            ? "/restaurant-registration"
            : safeNext;

        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) {
            if (alive) setMessage(error.message);
            return;
          }
        }

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          if (alive) setMessage("Could not verify your sign-in session.");
          return;
        }

        if (session) {
          window.location.replace(next);
          return;
        }

        if (alive) {
          setMessage(
            "Sign-in could not be completed. Please return and try again."
          );
        }
      } catch {
        if (alive) {
          setMessage("Something went wrong. Please try signing in again.");
        }
      }
    }

    void run();

    return () => {
      alive = false;
    };
  }, [params]);

  return (
    <main className="auth-wrap">
      <section className="auth-card">
        <div className="brand-mark">T.</div>
        <h1>One moment.</h1>
        <p className="muted" role="status">
          {message}
        </p>
        <Link className="button button-dark full" href="/auth">
          Return to sign in
        </Link>
      </section>
    </main>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <main className="auth-wrap">
          <section className="auth-card">
            <div className="brand-mark">T.</div>
            <h1>One moment.</h1>
            <p className="muted">Loading sign-in callback…</p>
          </section>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}