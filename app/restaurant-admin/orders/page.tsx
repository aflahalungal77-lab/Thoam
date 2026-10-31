
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  RefreshCw,
  Search,
  ClipboardList,
  ShoppingBag,
  LoaderCircle,
  IndianRupee,
  TrendingUp,
} from "lucide-react";

const statuses = [
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const PAGE_SIZE = 1000;
const TIME_ZONE = "Asia/Kolkata";

function getStatus(order: any) {
  return String(order.status || "pending").toLowerCase();
}

function isDelivered(status: string) {
  return ["delivered", "completed"].includes(status);
}

function isCancelled(status: string) {
  return ["cancelled", "rejected"].includes(status);
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function isToday(dateValue?: string) {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;

  return (
    date.toLocaleDateString("en-CA", { timeZone: TIME_ZONE }) ===
    new Date().toLocaleDateString("en-CA", { timeZone: TIME_ZONE })
  );
}

export default function OrdersPage() {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const load = useCallback(async (manual = false) => {
    const client = supabase;

    if (!client) {
      setMsg("Supabase is not configured.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (manual) setRefreshing(true);
    else setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();

      if (authError) throw authError;

      if (!user) {
        router.replace("/auth?role=owner&next=/restaurant-admin/orders");
        return;
      }

      const { data: profile, error: profileError } = await client
        .from("profiles")
        .select("restaurant_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (
        !["restaurant_owner", "admin"].includes(profile?.role || "") ||
        !profile?.restaurant_id
      ) {
        setMsg("This account is not linked to a restaurant.");
        return;
      }

      // Fetch all orders in pages for accurate revenue totals.
      const allOrders: any[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await client
          .from("orders")
          .select("*")
          .eq("restaurant_id", profile.restaurant_id)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const page = data || [];
        allOrders.push(...page);

        if (page.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      setItems(allOrders);
      setMsg("");
    } catch (error) {
      console.error("Orders load failed:", error);
      setMsg(
        error instanceof Error ? error.message : "Unable to load orders."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(id: string, status: string) {
    const client = supabase;

    if (!client || updatingId) return;

    const previous = items.find((item) => item.id === id);

    if (!previous || getStatus(previous) === status) return;

    setUpdatingId(id);
    setMsg("");

    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, status } : item
      )
    );

    try {
      const { error } = await client
        .from("orders")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    } catch (error) {
      setItems((current) =>
        current.map((item) =>
          item.id === id ? previous : item
        )
      );

      setMsg(
        error instanceof Error ? error.message : "Could not update order."
      );
    } finally {
      setUpdatingId("");
    }
  }

  // Delivered orders remain included in revenue calculations.
  // Cancelled/rejected orders are excluded.
  const revenueOrders = useMemo(
    () =>
      items.filter(
        (order) => !isCancelled(getStatus(order))
      ),
    [items]
  );

  const totalRevenue = revenueOrders.reduce(
    (sum, order) => sum + Number(order.total_amount || 0),
    0
  );

  const todayRevenue = revenueOrders
    .filter((order) => isToday(order.created_at))
    .reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0
    );

  const newOrders = items.filter(
    (order) => getStatus(order) === "placed"
  );

  const visibleItems = items.filter(
    (order) => !isDelivered(getStatus(order))
  );

  const activeCount = visibleItems.filter(
    (order) => !isCancelled(getStatus(order))
  ).length;

  const deliveredCount = items.filter(
    (order) => isDelivered(getStatus(order))
  ).length;

  const filtered = visibleItems.filter((order) => {
    const status = getStatus(order);
    const query = search.toLowerCase();

    const matchesSearch = [
      order.order_number,
      order.id,
      order.order_type,
      order.status,
      order.payment_status,
    ].some((value) =>
      String(value || "").toLowerCase().includes(query)
    );

    const matchesFilter =
      filter === "All" ||
      (filter === "New" && status === "placed") ||
      (filter === "Active" &&
        !isCancelled(status) &&
        status !== "placed") ||
      (filter === "Cancelled" && isCancelled(status));

    return matchesSearch && matchesFilter;
  });

  return (
    <main className="container ta-manage-page">
      <Link href="/restaurant-admin" className="ta-back-link">
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <header className="ta-manage-heading">
        <div>
          <span className="ta-eyebrow">ORDER WORKSPACE</span>
          <h1>Order management<span>.</span></h1>
          <p>Keep every order moving in the right direction.</p>
        </div>

        <button
          className="ta-refresh-button"
          onClick={() => void load(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw
            size={15}
            className={refreshing ? "ta-refreshing" : ""}
          />
          Refresh
        </button>
      </header>

      {msg && (
        <div className="ta-manage-message" role="status">
          {msg}
          <button
            onClick={() => setMsg("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      <section className="ta-revenue-grid">
        <article className="ta-revenue-card">
          <div className="ta-revenue-card-top">
            <span>Total revenue</span>
            <IndianRupee size={19} />
          </div>
          <strong>{money(totalRevenue)}</strong>
          <small>All-time orders · excluding cancelled orders</small>
        </article>

        <article className="ta-revenue-card ta-revenue-today">
          <div className="ta-revenue-card-top">
            <span>Today's revenue</span>
            <TrendingUp size={19} />
          </div>
          <strong>{money(todayRevenue)}</strong>
          <small>Today's orders · excluding cancelled orders</small>
        </article>
      </section>

      <section className="ta-product-summary">
        <div>
          <span>Total orders</span>
          <strong>{items.length}</strong>
        </div>
        <div>
          <span>Active orders</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>Delivered orders</span>
          <strong>{deliveredCount}</strong>
        </div>
      </section>

      <section className="ta-orders-workspace">
        <div className="ta-menu-heading">
          <div>
            <span className="ta-eyebrow">YOUR RESTAURANT</span>
            <h2>Orders <span>({filtered.length})</span></h2>
          </div>
        </div>

        {newOrders.length > 0 && (
          <div className="ta-placed-alert" role="status">
            <div className="ta-placed-alert-icon">
              <ShoppingBag size={21} />
            </div>
            <div className="ta-placed-alert-copy">
              <strong>
                {newOrders.length} new{" "}
                {newOrders.length === 1 ? "order" : "orders"} waiting
              </strong>
              <span>Newly placed orders need your attention.</span>
            </div>
            <span className="ta-placed-count">
              {newOrders.length}
            </span>
          </div>
        )}

        <div className="ta-menu-toolbar">
          <label className="ta-menu-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order, status or payment..."
              aria-label="Search orders"
            />
          </label>

          <select
            className="ta-filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter orders"
          >
            <option>All</option>
            <option>New</option>
            <option>Active</option>
            <option>Cancelled</option>
          </select>
        </div>

        {loading ? (
          <div className="ta-menu-empty">
            <LoaderCircle size={28} className="ta-refreshing" />
            <h3>Loading orders...</h3>
          </div>
        ) : filtered.length === 0 ? (
          <div className="ta-menu-empty">
            <ClipboardList size={31} />
            <h3>
              {visibleItems.length
                ? "No matching orders"
                : "No active orders."}
            </h3>
            <p>
              {visibleItems.length
                ? "Try changing your search or filter."
                : "Delivered orders are hidden. New orders will appear here."}
            </p>
          </div>
        ) : (
          <div className="ta-orders-list">
            {filtered.map((order) => {
              const status = getStatus(order);
              const isNew = status === "placed";

              return (
                <article
                  className={`ta-order-card ${
                    isNew ? "ta-order-card-new" : ""
                  }`}
                  key={order.id}
                >
                  <div className="ta-order-card-top">
                    <div className="ta-order-ident">
                      <div className="ta-order-icon">
                        <ShoppingBag size={19} />
                      </div>
                      <div>
                        <span className="ta-eyebrow">ORDER</span>
                        <h3>
                          #{order.order_number || order.id.slice(0, 8)}
                        </h3>
                      </div>
                    </div>

                    <span
                      className={`ta-product-status ${
                        isNew
                          ? "ta-status-placed"
                          : isCancelled(status)
                            ? "unavailable"
                            : "pending"
                      }`}
                    >
                      <span />
                      {status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="ta-order-meta">
                    <div>
                      <span>Order type</span>
                      <strong>
                        {String(order.order_type || "Order").replace(/_/g, " ")}
                      </strong>
                    </div>

                    <div>
                      <span>Placed</span>
                      <strong>
                        {order.created_at
                          ? new Date(order.created_at).toLocaleString(
                              "en-IN",
                              {
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                                timeZone: TIME_ZONE,
                              }
                            )
                          : "—"}
                      </strong>
                    </div>

                    <div>
                      <span>Payment · COD</span>
                      <strong>
                        {String(order.payment_status || "").toLowerCase() === "paid"
                          ? "Cash collected"
                          : isCancelled(status)
                            ? "—"
                            : "Collect on delivery"}
                      </strong>
                    </div>

                    <div>
                      <span>Total</span>
                      <strong className="ta-order-total">
                        {money(Number(order.total_amount || 0))}
                      </strong>
                    </div>
                  </div>

                  <div className="ta-order-update">
                    <label htmlFor={`status-${order.id}`}>
                      Update order status
                    </label>

                    <select
                      id={`status-${order.id}`}
                      value={order.status || "pending"}
                      disabled={Boolean(updatingId)}
                      onChange={(e) =>
                        void update(order.id, e.target.value)
                      }
                    >
                      {[
                        order.status || "pending",
                        ...statuses.filter(
                          (statusOption) =>
                            statusOption !== order.status
                        ),
                      ].map((statusOption: string) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>

                    {updatingId === order.id && (
                      <LoaderCircle
                        size={16}
                        className="ta-refreshing"
                      />
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
