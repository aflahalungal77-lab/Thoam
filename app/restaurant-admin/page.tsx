"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

import {
  Package,
  ClipboardList,
  QrCode,
  LogOut,
  ShieldAlert,
  Store,
  ArrowUpRight,
  TrendingUp,
  ShoppingBag,
  CheckCircle2,
  Clock3,
  CircleDollarSign,
  ChevronRight,
  UtensilsCrossed,
  RefreshCw,
  Bell,
  Volume2,
  VolumeX,
  Tag,
} from "lucide-react";

type RestaurantData = {
  id: string;
  name: string;
  is_open: boolean;
  [key: string]: unknown;
};

type ProductData = {
  id: string;
  name?: string;
  is_available?: boolean;
  price?: number | string;
  [key: string]: unknown;
};

type OrderData = {
  id: string;
  order_number?: number | string;
  order_type?: string;
  status?: string;
  total_amount?: number | string;
  created_at?: string;
  payment_status?: string;
};

export default function RestaurantAdmin() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [restaurant, setRestaurant] =
    useState<RestaurantData | null>(null);
  const [products, setProducts] = useState<ProductData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [message, setMessage] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);

  const soundEnabledRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const router = useRouter();

  const playNewOrderSound = useCallback(() => {
    if (!soundEnabledRef.current || typeof window === "undefined") return;

    try {
      const AudioContextClass = window.AudioContext;
      if (!AudioContextClass) return;

      const context =
        audioContextRef.current || new AudioContextClass();

      audioContextRef.current = context;

      if (context.state === "suspended") {
        void context.resume();
      }

      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(
        880,
        context.currentTime
      );
      oscillator.frequency.setValueAtTime(
        660,
        context.currentTime + 0.16
      );

      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(
        0.16,
        context.currentTime + 0.025
      );
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        context.currentTime + 0.48
      );

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start();
      oscillator.stop(context.currentTime + 0.5);
    } catch (error) {
      console.error("Order notification sound failed:", error);
    }
  }, []);

  function toggleOrderSound() {
    const next = !soundEnabledRef.current;

    soundEnabledRef.current = next;
    setSoundEnabled(next);

    if (next) playNewOrderSound();
  }

  const loadDashboard = useCallback(
    async (showRefresh = false) => {
      if (!supabase) {
        setMessage(
          "Supabase is not configured. Check your environment variables."
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setMessage("");

      try {
        const {
          data: { user: currentUser },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) throw authError;

        if (!currentUser) {
          router.replace(
            "/auth?role=owner&next=/restaurant-admin"
          );
          return;
        }

        setUser(currentUser);

        const { data: profile, error: profileError } =
          await supabase
            .from("profiles")
            .select("role, restaurant_id")
            .eq("id", currentUser.id)
            .maybeSingle();

        if (profileError) throw profileError;

        if (profile?.role === "admin" && !profile.restaurant_id) {
          setMessage(
            "Your admin account is not linked to a restaurant."
          );
          setRestaurant(null);
          return;
        }

        if (!profile || !profile.restaurant_id) {
          if (
            !profile ||
            profile.role === "customer" ||
            profile.role === "restaurant_owner"
          ) {
            router.replace("/restaurant-registration");
            return;
          }

          setRestaurant(null);
          setMessage(
            "This account cannot access the restaurant dashboard."
          );
          return;
        }

        if (
          profile.role !== "restaurant_owner" &&
          profile.role !== "admin"
        ) {
          setRestaurant(null);
          setMessage(
            "This account is not authorized to access the restaurant dashboard."
          );
          return;
        }

        const { data: restaurantData, error: restaurantError } =
          await supabase
            .from("restaurants")
            .select("*")
            .eq("id", profile.restaurant_id)
            .maybeSingle();

        if (restaurantError) throw restaurantError;

        if (!restaurantData) {
          setRestaurant(null);
          setMessage("The linked restaurant could not be found.");
          return;
        }

        const [
          { data: productData, error: productError },
          { data: orderData, error: orderError },
        ] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .eq("restaurant_id", profile.restaurant_id)
            .order("created_at", { ascending: false }),

          supabase
            .from("orders")
            .select(
              "id,order_number,order_type,status,total_amount,created_at,payment_status"
            )
            .eq("restaurant_id", profile.restaurant_id)
            .order("created_at", { ascending: false })
            .limit(100),
        ]);

        if (productError) throw productError;
        if (orderError) throw orderError;

        setRestaurant(restaurantData as RestaurantData);
        setProducts((productData || []) as ProductData[]);
        setOrders((orderData || []) as OrderData[]);
        setMessage("");
      } catch (error) {
        console.error("Restaurant dashboard load failed:", error);

        setMessage(
          "Could not load dashboard data. Please try refreshing."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  // Listen for new orders and status changes for this restaurant only.
  useEffect(() => {
    const client = supabase;

    if (!client || !restaurant?.id) return;

    const channel = client
      .channel(`restaurant-orders-${restaurant.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        (payload) => {
          const newOrder = payload.new as OrderData;

          if (
            (newOrder.status || "").toLowerCase() === "placed"
          ) {
            playNewOrderSound();
          }

          void loadDashboard(true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `restaurant_id=eq.${restaurant.id}`,
        },
        () => {
          void loadDashboard(true);
        }
      )
      .subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [restaurant?.id, loadDashboard, playNewOrderSound]);

  async function toggleOpen() {
    if (!supabase || !restaurant || savingStatus) return;

    setSavingStatus(true);
    setMessage("");

    const nextOpenState = !restaurant.is_open;

    try {
      const { error } = await supabase
        .from("restaurants")
        .update({ is_open: nextOpenState })
        .eq("id", restaurant.id);

      if (error) throw error;

      setRestaurant((current) =>
        current
          ? { ...current, is_open: nextOpenState }
          : current
      );
    } catch (error) {
      console.error("Restaurant status update failed:", error);

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not update restaurant status."
      );
    } finally {
      setSavingStatus(false);
    }
  }

  async function signout() {
    await supabase?.auth.signOut();
    router.push("/");
  }

  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  const todayOrders = orders.filter((order) => {
    if (!order.created_at) return false;

    const orderDate = new Date(
      order.created_at
    ).toLocaleDateString("en-CA", {
      timeZone: "Asia/Kolkata",
    });

    return orderDate === today;
  });

  const completed = todayOrders.filter((order) =>
    ["delivered", "completed"].includes(
      (order.status || "").toLowerCase()
    )
  );

  const sales = completed.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );

  const pendingOrders = todayOrders.filter(
    (order) =>
      ![
        "delivered",
        "completed",
        "cancelled",
        "rejected",
        "ready",
      ].includes((order.status || "pending").toLowerCase())
  );

  const newOrders = orders.filter(
    (order) => (order.status || "").toLowerCase() === "placed"
  );

  const visibleRecentOrders = orders.filter(
    (order) =>
      !["delivered", "completed"].includes(
        (order.status || "").toLowerCase()
      )
  );

  const money = (value: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);

  const formatTime = (date?: string) => {
    if (!date) return "—";

    return new Date(date).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Kolkata",
    });
  };

  if (loading) {
    return (
      <main className="ta-dashboard">
        <section className="ta-main">
          <div className="ta-loading">
            <RefreshCw size={26} className="ta-refreshing" />
            <h2>Getting things ready</h2>
            <p>Loading your restaurant workspace...</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="ta-dashboard">
      <aside className="ta-sidebar">
        <Link href="/" className="ta-brand">
          <span className="ta-brand-icon">T.</span>
          <span>
            Tho’am
            <small>RESTAURANT PARTNER</small>
          </span>
        </Link>

        <div className="ta-nav-label">WORKSPACE</div>

        <nav className="ta-nav">
          <a href="#overview" className="ta-nav-link active">
            <TrendingUp size={18} />
            Overview
          </a>

          <Link
            href="/restaurant-admin/products"
            className="ta-nav-link"
          >
            <Package size={18} />
            Products
            <ChevronRight size={15} className="ta-nav-arrow" />
          </Link>

          <Link
            href="/restaurant-admin/orders"
            className="ta-nav-link"
          >
            <ClipboardList size={18} />
            Orders
            <ChevronRight size={15} className="ta-nav-arrow" />
          </Link>

          {/* NEW: Offers navigation */}
          <Link
            href="/restaurant-admin/offers"
            className="ta-nav-link"
          >
            <Tag size={18} />
            Offers
            <ChevronRight size={15} className="ta-nav-arrow" />
          </Link>

          <Link
            href="/restaurant-admin/qr"
            className="ta-nav-link"
          >
            <QrCode size={18} />
            QR ordering
            <ChevronRight size={15} className="ta-nav-arrow" />
          </Link>

          <Link
            href="/restaurant-admin/kitchen"
            className="ta-nav-link"
          >
            <UtensilsCrossed size={18} />
            Kitchen KOT
            <ChevronRight size={15} className="ta-nav-arrow" />
          </Link>
        </nav>

        <div className="ta-sidebar-bottom">
          <div className="ta-sidebar-help">
            <div className="ta-help-icon">
              <UtensilsCrossed size={19} />
            </div>

            <strong>Your restaurant.</strong>

            <p>
              Your menu, orders and daily performance in one place.
            </p>

            <Link href="/owner">
              Partner portal <ArrowUpRight size={14} />
            </Link>
          </div>

          <button className="ta-signout" onClick={signout}>
            <LogOut size={17} />
            Sign out
          </button>
        </div>
      </aside>

      <section className="ta-main">
        <header className="ta-topbar">
          <div>
            <span className="ta-topbar-label">
              THO’AM / PARTNER
            </span>
            <span className="ta-topbar-title">Dashboard</span>
          </div>

          <div className="ta-topbar-right">
            <button
              className={`ta-sound-toggle ${
                soundEnabled ? "is-enabled" : ""
              }`}
              onClick={toggleOrderSound}
              aria-label={
                soundEnabled
                  ? "Disable order sound"
                  : "Enable order sound"
              }
              title={
                soundEnabled
                  ? "Order sound enabled"
                  : "Enable order sound"
              }
            >
              {soundEnabled ? (
                <Volume2 size={17} />
              ) : (
                <VolumeX size={17} />
              )}

              <span>
                {soundEnabled ? "Sound on" : "Enable sound"}
              </span>
            </button>

            <button
              className="ta-refresh"
              onClick={() => void loadDashboard(true)}
              disabled={loading || refreshing}
              aria-label="Refresh dashboard"
              title="Refresh dashboard"
            >
              <RefreshCw
                size={17}
                className={refreshing ? "ta-refreshing" : ""}
              />
            </button>

            <div className="ta-avatar">
              {(user?.email || "R").slice(0, 1).toUpperCase()}
            </div>

            <div className="ta-user-info">
              <strong>Restaurant partner</strong>
              <span>{user?.email || "Your account"}</span>
            </div>
          </div>
        </header>

        <div className="ta-content" id="overview">
          {message && !restaurant ? (
            <div className="ta-setup-card">
              <div className="ta-setup-icon">
                <ShieldAlert size={26} />
              </div>

              <span className="ta-eyebrow">ACCOUNT SETUP</span>

              <h1>Let’s get you set up.</h1>

              <p>{message}</p>

              <div className="ta-setup-actions">
                <Link
                  href="/owner"
                  className="ta-primary-button"
                >
                  Partner portal <ArrowUpRight size={16} />
                </Link>

                <button
                  className="ta-secondary-button"
                  onClick={() => void loadDashboard(true)}
                  disabled={refreshing}
                >
                  Try again
                </button>
              </div>
            </div>
          ) : (
            <>
              <section className="ta-welcome">
                <div className="ta-welcome-copy">
                  <span className="ta-eyebrow">
                    <span className="ta-eyebrow-dot" />
                    YOUR RESTAURANT WORKSPACE
                  </span>

                  <h1>
                    Good things
                    <br />
                    are <span>cooking.</span>
                  </h1>

                  <p>
                    Here’s what’s happening at{" "}
                    <strong>
                      {restaurant?.name || "your restaurant"}
                    </strong>{" "}
                    today.
                  </p>

                  <div className="ta-welcome-actions">
                    <Link
                      href="/restaurant-admin/orders"
                      className="ta-primary-button"
                    >
                      <ClipboardList size={17} />
                      Manage orders
                      <ArrowUpRight size={15} />
                    </Link>

                    <Link
                      href="/restaurant-admin/products"
                      className="ta-secondary-button"
                    >
                      <Package size={16} />
                      Manage menu
                    </Link>
                  </div>
                </div>

                <div
                  className="ta-welcome-art"
                  aria-hidden="true"
                >
                  <div className="ta-art-circle ta-art-circle-one" />
                  <div className="ta-art-circle ta-art-circle-two" />

                  <div className="ta-art-plate">
                    <UtensilsCrossed
                      size={64}
                      strokeWidth={1.1}
                    />
                  </div>

                  <span className="ta-art-label">
                    MADE WITH CARE
                  </span>

                  <div className="ta-art-caption">
                    <span>YOUR PARTNER DASHBOARD</span>
                    <strong>Everything, at a glance.</strong>
                  </div>
                </div>
              </section>

              {message && (
                <div className="ta-message" role="status">
                  <ShieldAlert size={17} />
                  {message}
                </div>
              )}

              <section className="ta-restaurant-strip">
                <div className="ta-restaurant-identity">
                  <div className="ta-restaurant-icon">
                    <Store size={21} />
                  </div>

                  <div>
                    <span className="ta-eyebrow">
                      YOUR RESTAURANT
                    </span>

                    <h2>{restaurant?.name}</h2>

                    <span className="ta-restaurant-subtitle">
                      Partner workspace
                    </span>
                  </div>
                </div>

                <div className="ta-restaurant-controls">
                  <span
                    className={`ta-open-status ${
                      restaurant?.is_open
                        ? "is-open"
                        : "is-closed"
                    }`}
                  >
                    <span />

                    {restaurant?.is_open
                      ? "Open for orders"
                      : "Currently closed"}
                  </span>

                  <button
                    className={
                      restaurant?.is_open
                        ? "ta-close-button"
                        : "ta-open-button"
                    }
                    onClick={toggleOpen}
                    disabled={savingStatus}
                  >
                    {savingStatus
                      ? "Updating..."
                      : restaurant?.is_open
                        ? "Close restaurant"
                        : "Open restaurant"}
                  </button>
                </div>
              </section>

              <Link
                href="/restaurant-admin/orders"
                className={`ta-new-orders-alert ${
                  newOrders.length > 0
                    ? "has-new-orders"
                    : "is-clear"
                }`}
                aria-live="polite"
              >
                <span className="ta-new-orders-icon">
                  <Bell size={21} />
                </span>

                <span className="ta-new-orders-copy">
                  <strong>
                    {newOrders.length > 0
                      ? "Orders need attention"
                      : "You’re all caught up"}
                  </strong>

                  <small>
                    {newOrders.length > 0
                      ? "Orders waiting to be marked Ready"
                      : "No orders waiting for preparation"}
                  </small>
                </span>

                <span className="ta-new-orders-count">
                  {newOrders.length}
                </span>

                <ArrowUpRight
                  size={18}
                  className="ta-new-orders-arrow"
                />
              </Link>

              <section className="ta-stats-section">
                <div className="ta-section-header">
                  <div>
                    <span className="ta-eyebrow">
                      LIVE SNAPSHOT
                    </span>

                    <h2>
                      Today at a glance<span>.</span>
                    </h2>
                  </div>

                  <span className="ta-date-label">
                    {new Date().toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      timeZone: "Asia/Kolkata",
                    })}
                  </span>
                </div>

                <div className="ta-stats-grid">
                  <article className="ta-stat-card">
                    <div className="ta-stat-top">
                      <span>Today's orders</span>
                      <div className="ta-stat-icon">
                        <ShoppingBag size={19} />
                      </div>
                    </div>

                    <strong className="ta-stat-value">
                      {todayOrders.length}
                    </strong>

                    <span className="ta-stat-foot">
                      Orders received today
                    </span>
                  </article>

                  <article className="ta-stat-card">
                    <div className="ta-stat-top">
                      <span>Pending orders</span>

                      <div className="ta-stat-icon ta-icon-warm">
                        <Clock3 size={19} />
                      </div>
                    </div>

                    <strong className="ta-stat-value">
                      {pendingOrders.length}
                    </strong>

                    <span className="ta-stat-foot">
                      Waiting to be completed
                    </span>
                  </article>

                  <article className="ta-stat-card">
                    <div className="ta-stat-top">
                      <span>Completed orders</span>

                      <div className="ta-stat-icon ta-icon-green">
                        <CheckCircle2 size={19} />
                      </div>
                    </div>

                    <strong className="ta-stat-value">
                      {completed.length}
                    </strong>

                    <span className="ta-stat-foot">
                      Completed today
                    </span>
                  </article>

                  <article className="ta-stat-card ta-stat-sales">
                    <div className="ta-stat-top">
                      <span>Completed sales</span>

                      <div className="ta-stat-icon ta-icon-dark">
                        <CircleDollarSign size={19} />
                      </div>
                    </div>

                    <strong className="ta-stat-value ta-sales-value">
                      {money(sales)}
                    </strong>

                    <span className="ta-stat-foot">
                      From completed orders today
                    </span>
                  </article>
                </div>
              </section>

              <section className="ta-tools-section">
                <div className="ta-section-header">
                  <div>
                    <span className="ta-eyebrow">YOUR TOOLS</span>

                    <h2>
                      Run your restaurant<span>.</span>
                    </h2>
                  </div>
                </div>

                <div className="ta-tools-grid">
                  <Link
                    className="ta-tool-card"
                    href="/restaurant-admin/products"
                  >
                    <div className="ta-tool-icon">
                      <Package size={23} />
                    </div>

                    <span className="ta-tool-arrow">
                      <ArrowUpRight size={18} />
                    </span>

                    <h3>Product management</h3>

                    <p>
                      Add dishes, update prices and manage menu
                      availability.
                    </p>

                    <div className="ta-tool-bottom">
                      <span>{products.length} products</span>

                      <span className="ta-tool-link">
                        Open workspace <ChevronRight size={15} />
                      </span>
                    </div>
                  </Link>

                  <Link
                    className="ta-tool-card"
                    href="/restaurant-admin/orders"
                  >
                    <div className="ta-tool-icon">
                      <ClipboardList size={23} />
                    </div>

                    <span className="ta-tool-arrow">
                      <ArrowUpRight size={18} />
                    </span>

                    <h3>Order management</h3>

                    <p>
                      Review incoming orders and follow their
                      progress.
                    </p>

                    <div className="ta-tool-bottom">
                      <span>
                        {visibleRecentOrders.length} recent orders
                      </span>

                      <span className="ta-tool-link">
                        Open workspace <ChevronRight size={15} />
                      </span>
                    </div>
                  </Link>

                  {/* NEW: Offers management card */}
                  <Link
                    className="ta-tool-card"
                    href="/restaurant-admin/offers"
                  >
                    <div className="ta-tool-icon">
                      <Tag size={23} />
                    </div>

                    <span className="ta-tool-arrow">
                      <ArrowUpRight size={18} />
                    </span>

                    <h3>Offers & discounts</h3>

                    <p>
                      Create promotional offers and manage
                      restaurant discounts.
                    </p>

                    <div className="ta-tool-bottom">
                      <span>Promotions</span>

                      <span className="ta-tool-link">
                        Manage offers <ChevronRight size={15} />
                      </span>
                    </div>
                  </Link>

                  <Link
                    className="ta-tool-card"
                    href="/restaurant-admin/qr"
                  >
                    <div className="ta-tool-icon">
                      <QrCode size={23} />
                    </div>

                    <span className="ta-tool-arrow">
                      <ArrowUpRight size={18} />
                    </span>

                    <h3>QR ordering</h3>

                    <p>
                      Manage table QR codes and your dine-in
                      ordering setup.
                    </p>

                    <div className="ta-tool-bottom">
                      <span>Dine-in experience</span>

                      <span className="ta-tool-link">
                        Open workspace <ChevronRight size={15} />
                      </span>
                    </div>
                  </Link>
                </div>
              </section>

              <section className="ta-orders-section">
                <div className="ta-section-header">
                  <div>
                    <span className="ta-eyebrow">THE LATEST</span>

                    <h2>
                      Recent orders<span>.</span>
                    </h2>
                  </div>

                  <Link
                    href="/restaurant-admin/orders"
                    className="ta-view-all"
                  >
                    View all orders <ArrowUpRight size={15} />
                  </Link>
                </div>

                {visibleRecentOrders.length === 0 ? (
                  <div className="ta-empty-orders">
                    <div className="ta-empty-icon">
                      <ClipboardList size={25} />
                    </div>

                    <h3>Your next order starts here.</h3>

                    <p>
                      New customer and QR orders will appear here
                      when they are saved in your orders table.
                    </p>

                    <Link
                      href="/restaurant-admin/products"
                      className="ta-secondary-button"
                    >
                      Check your menu <ArrowUpRight size={15} />
                    </Link>
                  </div>
                ) : (
                  <div className="ta-orders-table-wrap">
                    <table className="ta-orders-table">
                      <thead>
                        <tr>
                          <th>ORDER</th>
                          <th>TYPE</th>
                          <th>TIME</th>
                          <th>STATUS</th>
                          <th>AMOUNT</th>
                          <th>PAYMENT</th>
                        </tr>
                      </thead>

                      <tbody>
                        {visibleRecentOrders
                          .slice(0, 8)
                          .map((order) => {
                            const state = (
                              order.status || "pending"
                            ).toLowerCase();

                            return (
                              <tr key={order.id}>
                                <td>
                                  <strong>
                                    #
                                    {order.order_number ||
                                      order.id.slice(0, 8)}
                                  </strong>
                                </td>

                                <td>
                                  <span className="ta-order-type">
                                    {order.order_type || "Order"}
                                  </span>
                                </td>

                                <td>
                                  {formatTime(order.created_at)}
                                </td>

                                <td>
                                  <span
                                    className={`ta-order-status status-${state.replace(
                                      /[^a-z0-9_-]/g,
                                      ""
                                    )}`}
                                  >
                                    <span />
                                    {state.replace(/_/g, " ")}
                                  </span>
                                </td>

                                <td>
                                  <strong>
                                    {money(
                                      Number(order.total_amount || 0)
                                    )}
                                  </strong>
                                </td>

                                <td>
                                  <span className="ta-payment-label">
                                    {order.payment_status || "—"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <footer className="ta-footer">
                <span>
                  <strong>THO’AM.</strong> Restaurant partner
                  workspace
                </span>

                <span>Good food. Good moments.</span>
              </footer>
            </>
          )}
        </div>
      </section>
    </main>
  );
}