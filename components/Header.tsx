
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogIn, LogOut, Menu, ShoppingBag, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadUser() {
      const { data } = await supabase!.auth.getUser();

      if (mounted) {
        setUser(data.user);
        setLoading(false);
      }
    }

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    if (!supabase) return;

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);
      return;
    }

    setUser(null);
    setMobileMenuOpen(false);
    router.push("/");
    router.refresh();
  }

  function handleOrderFood() {
    if (loading) return;

    if (user) {
      router.push("/restaurants");
    } else {
      router.push("/auth?next=%2Frestaurants");
    }

    setMobileMenuOpen(false);
  }

  return (
    <header className="site-header">
      <Link href="/" className="wordmark" aria-label="Tho'am home">
        Tho<span>’</span>am<span className="wordmark-dot">.</span>
      </Link>

      <nav className="thoam-desktop-nav" aria-label="Main navigation">
        <Link href="/">Home</Link>
        <Link href="/restaurants">Restaurants</Link>
        <Link href="/owner">For restaurants</Link>
      </nav>

      <div className="thoam-header-actions">
        {!loading && (
          user ? (
            <button
              type="button"
              className="button button-light small thoam-auth-button"
              onClick={handleLogout}
            >
              <LogOut size={15} />
              <span>Log out</span>
            </button>
          ) : (
            <Link
              href={`/auth?next=${encodeURIComponent(pathname || "/")}`}
              className="button button-light small thoam-auth-button"
            >
              <LogIn size={15} />
              <span>Log in</span>
            </Link>
          )
        )}

        <button
          type="button"
          className="button button-dark small thoam-order-button"
          onClick={handleOrderFood}
          disabled={loading}
        >
          <ShoppingBag size={15} />
          <span>Order food</span>
        </button>

        <button
          type="button"
          className="thoam-mobile-menu-button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {mobileMenuOpen && (
        <nav className="thoam-mobile-menu" aria-label="Mobile navigation">
          <Link href="/">Home</Link>
          <Link href="/restaurants">Restaurants</Link>
          <Link href="/owner">For restaurants</Link>

          {!loading && (
            user ? (
              <button type="button" onClick={handleLogout}>
                <LogOut size={16} />
                Log out
              </button>
            ) : (
              <Link
                href={`/auth?next=${encodeURIComponent(pathname || "/")}`}
              >
                <LogIn size={16} />
                Log in
              </Link>
            )
          )}

          <button type="button" onClick={handleOrderFood}>
            <ShoppingBag size={16} />
            Order food
          </button>
        </nav>
      )}
    </header>
  );
}
