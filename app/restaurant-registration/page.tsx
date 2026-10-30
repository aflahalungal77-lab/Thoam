"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Store } from "lucide-react";
import { supabase } from "@/lib/supabase";
import RestaurantSetupModal from "@/components/owner/RestaurantSetupModal";

export default function RestaurantRegistrationPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkOwner() {
      if (!supabase) {
        if (active) {
          setMessage("Supabase is not configured. Check your environment variables.");
          setChecking(false);
        }
        return;
      }

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!user) {
          router.replace("/auth?role=owner&next=/restaurant-registration");
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, restaurant_id")
          .eq("id", user.id)
          .maybeSingle();

        if (profileError) throw profileError;

        if (profile?.restaurant_id) {
          router.replace("/restaurant-admin");
          return;
        }

        if (profile?.role === "admin") {
          setMessage("Admin accounts cannot register a restaurant through owner onboarding.");
        } else if (
          profile &&
          profile.role !== "customer" &&
          profile.role !== "restaurant_owner"
        ) {
          setMessage("This account is not eligible for restaurant registration.");
        }
      } catch (error) {
        console.error("Restaurant registration check failed:", error);
        if (active) {
          setMessage("Could not verify your account. Please refresh and try again.");
        }
      } finally {
        if (active) setChecking(false);
      }
    }

    void checkOwner();
    return () => {
      active = false;
    };
  }, [router]);

  if (checking) {
    return (
      <main className="auth-wrap">
        <section className="auth-card" role="status">
          <LoaderCircle size={26} className="spin" />
          <h1>Preparing registration</h1>
          <p className="muted">Checking your owner account…</p>
        </section>
      </main>
    );
  }

  if (message) {
    return (
      <main className="auth-wrap">
        <section className="auth-card">
          <div className="brand-mark"><Store size={22} /></div>
          <h1>Restaurant registration</h1>
          <p className="muted" role="alert">{message}</p>
          <button
            type="button"
            className="button button-dark full"
            onClick={() => router.replace("/owner")}
          >
            Back to partner portal
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="ta-dashboard">
      <RestaurantSetupModal
        onComplete={() => router.replace("/restaurant-admin")}
      />
    </main>
  );
}
