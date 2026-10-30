"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, RefreshCw, Search, ClipboardList,
  Clock3, CheckCircle2, ShoppingBag, LoaderCircle,
} from "lucide-react";

const statuses = [
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

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
    if (!supabase) {
      setMsg("Supabase is not configured.");
      setLoading(false);
      return;
    }

    if (manual) setRefreshing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth?role=owner&next=/restaurant-admin/orders");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("restaurant_id,role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (
        (profile?.role !== "restaurant_owner" && profile?.role !== "admin") ||
        !profile?.restaurant_id
      ) {
        setMsg("This account is not linked to a restaurant.");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("restaurant_id", profile.restaurant_id)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      setItems(data || []);
      setMsg("");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Unable to load orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(id: string, status: string) {
    if (!supabase || updatingId) return;

    const previous = items.find((item) => item.id === id);
    if (!previous || previous.status === status) return;

    setUpdatingId(id);
    setMsg("");

    // Optimistic UI update, rolled back if Supabase returns an error.
    setItems((current) =>
      current.map((item) => item.id === id ? { ...item, status } : item)
    );

    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) {
      setItems((current) =>
        current.map((item) => item.id === id ? previous : item)
      );
      setMsg(error.message);
    }

    setUpdatingId("");
  }

  const filtered = items.filter((order) => {
    const query = search.toLowerCase();

    const matchesSearch = [
      order.order_number,
      order.id,
      order.order_type,
      order.status,
      order.payment_status,
    ].some((value) => String(value || "").toLowerCase().includes(query));

    const matchesFilter =
      filter === "All" ||
      (filter === "Active" &&
        !["delivered", "completed", "cancelled", "rejected"].includes(
          String(order.status || "").toLowerCase()
        )) ||
      (filter === "Completed" &&
        ["delivered", "completed"].includes(
          String(order.status || "").toLowerCase()
        )) ||
      (filter === "Cancelled" &&
        ["cancelled", "rejected"].includes(
          String(order.status || "").toLowerCase()
        ));

    return matchesSearch && matchesFilter;
  });

  const activeCount = items.filter(
    (o) => !["delivered", "completed", "cancelled", "rejected"].includes(
      String(o.status || "").toLowerCase()
    )
  ).length;

  const completedCount = items.filter(
    (o) => ["delivered", "completed"].includes(
      String(o.status || "").toLowerCase()
    )
  ).length;

  function money(value: unknown) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
  }

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
          <RefreshCw size={15} className={refreshing ? "ta-refreshing" : ""} />
          Refresh
        </button>
      </header>

      {msg && (
        <div className="ta-manage-message" role="status">
          {msg}
          <button onClick={() => setMsg("")} aria-label="Dismiss message">×</button>
        </div>
      )}

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
          <span>Completed orders</span>
          <strong>{completedCount}</strong>
        </div>
      </section>

      <section className="ta-orders-workspace">
        <div className="ta-menu-heading">
          <div>
            <span className="ta-eyebrow">YOUR RESTAURANT</span>
            <h2>All orders <span>({filtered.length})</span></h2>
          </div>
        </div>

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
            <option>Active</option>
            <option>Completed</option>
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
            <h3>{items.length ? "No matching orders" : "No orders yet."}</h3>
            <p>
              {items.length
                ? "Try changing your search or filter."
                : "New orders will appear here when they are saved in your orders table."}
            </p>
          </div>
        ) : (
          <div className="ta-orders-list">
            {filtered.map((order) => {
              const status = String(order.status || "pending").toLowerCase();

              return (
                <article className="ta-order-card" key={order.id}>
                  <div className="ta-order-card-top">
                    <div className="ta-order-ident">
                      <div className="ta-order-icon"><ShoppingBag size={19} /></div>
                      <div>
                        <span className="ta-eyebrow">ORDER</span>
                        <h3>#{order.order_number || order.id.slice(0, 8)}</h3>
                      </div>
                    </div>

                    <span className={`ta-product-status ${
                      ["delivered", "completed"].includes(status)
                        ? "available"
                        : ["cancelled", "rejected"].includes(status)
                          ? "unavailable"
                          : "pending"
                    }`}>
                      <span />
                      {status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="ta-order-meta">
                    <div>
                      <span>Order type</span>
                      <strong>{String(order.order_type || "Order").replace(/_/g, " ")}</strong>
                    </div>
                    <div>
                      <span>Placed</span>
                      <strong>
                        {order.created_at
                          ? new Date(order.created_at).toLocaleString("en-IN", {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "—"}
                      </strong>
                    </div>
                    <div>
  <span>Payment · COD</span>
  <strong>
    {String(order.payment_status || "").toLowerCase() === "paid"
      ? "Cash collected"
      : ["cancelled", "rejected"].includes(
          String(order.status || "").toLowerCase()
        )
        ? "—"
        : "Collect on delivery"}
  </strong>
</div>
                    <div>
                      <span>Total</span>
                      <strong className="ta-order-total">{money(order.total_amount)}</strong>
                    </div>
                  </div>

                  <div className="ta-order-update">
                    <label htmlFor={`status-${order.id}`}>Update order status</label>
                    <select
                      id={`status-${order.id}`}
                      value={order.status || "pending"}
                      disabled={Boolean(updatingId)}
                      onChange={(e) => void update(order.id, e.target.value)}
                    >
                      {[order.status || "pending", ...statuses.filter((s) => s !== order.status)]
                        .map((statusOption: string) => (
                          <option key={statusOption} value={statusOption}>
                            {statusOption.replace(/_/g, " ")}
                          </option>
                        ))}
                    </select>

                    {updatingId === order.id && (
                      <LoaderCircle size={16} className="ta-refreshing" />
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