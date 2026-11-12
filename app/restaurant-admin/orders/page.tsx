
"use client";

import { useLanguage } from "@/components/LanguageProvider";

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

type OrderItemRow = { id: string; product_name: string | null; quantity: number | string; unit_price: number | string; line_total: number | string | null };
type RestaurantOrder = {
  id: string; order_number?: number | string | null; restaurant_id?: string; status?: string | null;
  total_amount?: number | string | null; created_at?: string | null; order_type?: string | null;
  payment_status?: string | null; payment_method?: string | null; customer_name?: string | null;
  customer_phone?: string | null; delivery_address?: string | null; notes?: string | null;
  subtotal?: number | string | null; delivery_fee?: number | string | null; platform_fee?: number | string | null;
  restaurant?: { name?: string | null; area?: string | null; city?: string | null } | null;
  order_items?: OrderItemRow[] | null;
};

function getStatus(order: RestaurantOrder) {
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
  const { t } = useLanguage();
  const router = useRouter();

  const [items, setItems] = useState<RestaurantOrder[]>([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState<RestaurantOrder | null>(null);

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
      const allOrders: RestaurantOrder[] = [];
      let from = 0;

      while (true) {
        const { data, error } = await client
          .from("orders")
          .select("*,order_items(id,product_name,quantity,unit_price,line_total),restaurant:restaurants(name,area,city)")
          .eq("restaurant_id", profile.restaurant_id)
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const page = (data || []) as RestaurantOrder[];
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

  async function markCashCollected(id: string) {
    const client = supabase;
    if (!client || updatingId) return;
    setUpdatingId(id);
    setMsg("");
    try {
      const { error } = await client
        .from("orders")
        .update({ payment_status: "collected" })
        .eq("id", id)
        .eq("payment_status", "pending");
      if (error) throw error;
      setItems((current) =>
        current.map((item) =>
          item.id === id ? { ...item, payment_status: "collected" } : item
        )
      );
      setMsg("Cash collection recorded. Eligible challenge letters are awarded automatically when the order is completed.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Could not record cash collection.");
    } finally {
      setUpdatingId("");
    }
  }

  // Delivered orders remain included in revenue calculations.
  // Cancelled/rejected orders are excluded.
// Only delivered/completed orders count towards revenue.
const revenueOrders = useMemo(
  () =>
    items.filter((order) => isDelivered(getStatus(order))),
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
          <span className="ta-eyebrow">{t("ORDER WORKSPACE")}</span>
          <h1>{t("Order management.")}<span>.</span></h1>
          <p>{t("Keep every order moving in the right direction.")}</p>
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
            <span>{t("Total revenue")}</span>
            <IndianRupee size={19} />
          </div>
          <strong>{money(totalRevenue)}</strong>
          <small>{t("All-time · Delivered orders only")}</small>
        </article>

        <article className="ta-revenue-card ta-revenue-today">
          <div className="ta-revenue-card-top">
            <span>Today&apos;s revenue</span>
            <TrendingUp size={19} />
          </div>
          <strong>{money(todayRevenue)}</strong>
          <small>Today&apos;s delivered orders only</small>
        </article>
      </section>

      <section className="ta-product-summary">
        <div>
          <span>{t("Total orders")}</span>
          <strong>{items.length}</strong>
        </div>
        <div>
          <span>{t("Active orders")}</span>
          <strong>{activeCount}</strong>
        </div>
        <div>
          <span>{t("Delivered orders")}</span>
          <strong>{deliveredCount}</strong>
        </div>
      </section>

      <section className="ta-orders-workspace">
        <div className="ta-menu-heading">
          <div>
            <span className="ta-eyebrow">{t("YOUR RESTAURANT")}</span>
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
              <span>{t("Newly placed orders need your attention.")}</span>
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
              placeholder={t("Search order, status or payment...")}
              aria-label={t("Search orders")}
            />
          </label>

          <select
            className="ta-filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filter orders"
          >
            <option>{t("All")}</option>
            <option>{t("New")}</option>
            <option>{t("Active")}</option>
            <option>{t("Cancelled")}</option>
          </select>
        </div>

        {loading ? (
          <div className="ta-menu-empty">
            <LoaderCircle size={28} className="ta-refreshing" />
            <h3>{t("Loading orders...")}</h3>
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
                      <span>{t("Order type")}</span>
                      <strong>
                        {String(order.order_type || "Order").replace(/_/g, " ")}
                      </strong>
                    </div>

                    <div>
                      <span>{t("Placed")}</span>
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
                      <span>{t("Payment · COD")}</span>
                      <strong>
                        {String(order.payment_status || "").toLowerCase() === "collected"
                          ? "Cash collected"
                          : isCancelled(status)
                            ? "—"
                            : "Collect on delivery"}
                      </strong>
                      {String(order.payment_status || "").toLowerCase() === "pending" && !isCancelled(status) && (
                        <button
                          type="button"
                          className="ta-payment-collect"
                          disabled={Boolean(updatingId)}
                          onClick={() => void markCashCollected(order.id)}
                        >
                          {updatingId === order.id ? "Saving…" : "Mark cash collected"}
                        </button>
                      )}
                    </div>

                    <div>
                      <span>{t("Total")}</span>
                      <strong className="ta-order-total">
                        {money(Number(order.total_amount || 0))}
                      </strong>
                    </div>
                  </div>

                  <div className="ta-order-actions">
                    <button
                      type="button"
                      className="ta-view-bill"
                      onClick={() => setSelectedOrder(order)}
                    >
                      View Bill
                    </button>
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
      {selectedOrder && (
        <div
          className="ta-bill-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedOrder(null);
          }}
        >
          <section
            className="ta-bill-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ta-bill-title"
          >
            <div className="ta-bill-header">
              <div>
                <span className="ta-eyebrow">ORDER DETAILS</span>
                <h2 id="ta-bill-title">Order bill</h2>
                <p>#{selectedOrder.order_number || String(selectedOrder.id).slice(0, 8)}</p>
              </div>
              <button type="button" className="ta-bill-close" onClick={() => setSelectedOrder(null)} aria-label="Close bill">×</button>
            </div>

            <div className="ta-bill-restaurant">
              <strong>{selectedOrder.restaurant?.name || "Restaurant"}</strong>
              {(selectedOrder.restaurant?.area || selectedOrder.restaurant?.city) && (
                <span>{[selectedOrder.restaurant.area, selectedOrder.restaurant.city].filter(Boolean).join(", ")}</span>
              )}
            </div>

            <div className="ta-bill-info">
              <div><span>Customer</span><strong>{selectedOrder.customer_name || "Guest"}</strong></div>
              <div><span>Phone</span><strong>{selectedOrder.customer_phone || "—"}</strong></div>
              <div><span>Order type</span><strong>{String(selectedOrder.order_type || "Order").replace(/_/g, " ")}</strong></div>
              <div><span>Date</span><strong>{selectedOrder.created_at ? new Date(selectedOrder.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: TIME_ZONE }) : "—"}</strong></div>
              <div><span>Payment</span><strong>{String(selectedOrder.payment_method || "COD").toUpperCase()} · {String(selectedOrder.payment_status || "pending").replace(/_/g, " ")}</strong></div>
              {selectedOrder.delivery_address && <div className="ta-bill-wide"><span>Delivery address</span><strong>{selectedOrder.delivery_address}</strong></div>}
            </div>

            <div className="ta-bill-items-wrap">
              <h3>Items ordered</h3>
              {(selectedOrder.order_items || []).length > 0 ? (
                <div className="ta-bill-table">
                  <div className="ta-bill-row ta-bill-table-head"><span>Item</span><span>Qty</span><span>Price</span><span>Amount</span></div>
                  {selectedOrder.order_items.map((item) => (
                    <div className="ta-bill-row" key={item.id}>
                      <span>{item.product_name || "Item"}</span>
                      <span>{Number(item.quantity || 0)}</span>
                      <span>{money(Number(item.unit_price || 0))}</span>
                      <strong>{money(Number(item.line_total ?? Number(item.quantity || 0) * Number(item.unit_price || 0)))}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="ta-bill-no-items">Item details are not available for this order.</p>
              )}
            </div>

            <div className="ta-bill-totals">
              <div><span>Subtotal</span><strong>{money(Number(selectedOrder.subtotal ?? selectedOrder.total_amount ?? 0))}</strong></div>
              {Number(selectedOrder.delivery_fee || 0) > 0 && <div><span>Delivery fee</span><strong>{money(Number(selectedOrder.delivery_fee))}</strong></div>}
              {Number(selectedOrder.platform_fee || 0) > 0 && <div><span>Platform fee</span><strong>{money(Number(selectedOrder.platform_fee))}</strong></div>}
              <div className="ta-bill-grand-total"><span>Total</span><strong>{money(Number(selectedOrder.total_amount || 0))}</strong></div>
            </div>
            {selectedOrder.notes && <div className="ta-bill-notes"><span>Notes</span><p>{selectedOrder.notes}</p></div>}
            <button type="button" className="ta-bill-done" onClick={() => setSelectedOrder(null)}>Close bill</button>
          </section>
        </div>
      )}

      <style jsx global>{`

        .ta-order-actions{display:flex;justify-content:flex-end;margin:0 0 12px}
        .ta-view-bill{border:1px solid #171717;border-radius:9px;background:#fff;color:#171717;padding:9px 15px;font-size:12px;font-weight:800;cursor:pointer;transition:background .18s ease,color .18s ease}
        .ta-view-bill:hover{background:#171717;color:#fff}
        .ta-bill-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.58);display:flex;align-items:center;justify-content:center;padding:18px;overflow-y:auto}
        .ta-bill-modal{width:min(100%,620px);max-height:min(90vh,900px);overflow-y:auto;background:#fff;color:#171717;border-radius:18px;padding:24px;box-shadow:0 24px 80px rgba(0,0,0,.25)}
        .ta-bill-header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:1px solid #e9e9e9;padding-bottom:16px}
        .ta-bill-header h2{font-size:25px;line-height:1.15;margin:5px 0}
        .ta-bill-header p{margin:0;color:#777;font-size:12px}
        .ta-bill-close{border:0;background:#f2f2f2;border-radius:50%;width:34px;height:34px;font-size:23px;line-height:1;cursor:pointer}
        .ta-bill-restaurant{padding:16px 0 12px;display:grid;gap:4px}
        .ta-bill-restaurant strong{font-size:16px}
        .ta-bill-restaurant span,.ta-bill-info span,.ta-bill-notes>span{font-size:11px;color:#777}
        .ta-bill-info{display:grid;grid-template-columns:1fr 1fr;gap:14px;padding:14px;background:#f7f7f7;border-radius:12px}
        .ta-bill-info>div{display:grid;gap:4px;min-width:0}
        .ta-bill-info strong{font-size:12px;line-height:1.5;overflow-wrap:anywhere;text-transform:capitalize}
        .ta-bill-wide{grid-column:1/-1}
        .ta-bill-items-wrap{padding:20px 0 12px}
        .ta-bill-items-wrap h3{font-size:14px;margin:0 0 12px}
        .ta-bill-table{width:100%}
        .ta-bill-row{display:grid;grid-template-columns:minmax(0,1.8fr) .45fr .9fr .9fr;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid #eee;font-size:11px}
        .ta-bill-row>span:first-child{overflow-wrap:anywhere}
        .ta-bill-row>span:not(:first-child),.ta-bill-row>strong{text-align:right}
        .ta-bill-table-head{color:#777;font-size:10px;font-weight:800;text-transform:uppercase}
        .ta-bill-no-items{font-size:12px;color:#777}
        .ta-bill-totals{display:grid;gap:9px;border-top:1px solid #e8e8e8;padding-top:14px}
        .ta-bill-totals>div{display:flex;justify-content:space-between;gap:12px;font-size:12px}
        .ta-bill-grand-total{border-top:1px dashed #ccc;padding-top:12px;margin-top:3px;font-size:16px!important;font-weight:900}
        .ta-bill-notes{margin-top:16px;padding:12px;background:#f7f7f7;border-radius:10px}
        .ta-bill-notes p{font-size:12px;white-space:pre-wrap;margin:5px 0 0}
        .ta-bill-done{width:100%;margin-top:18px;min-height:43px;border:0;border-radius:10px;background:#171717;color:#fff;font-weight:800;cursor:pointer}
        @media(max-width:520px){.ta-bill-modal{padding:17px;border-radius:14px}.ta-bill-info{gap:11px;padding:12px}.ta-bill-row{grid-template-columns:minmax(0,1.5fr) .35fr .8fr .8fr;gap:5px;font-size:10px}.ta-bill-header h2{font-size:22px}}
        .ta-order-meta>div{min-width:0}
        .ta-payment-collect{
          display:inline-flex;align-items:center;justify-content:center;gap:7px;
          min-height:36px;margin-top:9px;padding:0 13px;border:1px solid #171717;
          border-radius:9px;background:#171717;color:#fff;font-size:11px;
          font-weight:800;line-height:1;cursor:pointer;
          box-shadow:0 3px 0 rgba(0,0,0,.12);
          transition:background .18s ease,border-color .18s ease,transform .18s ease,opacity .18s ease;
        }
        .ta-payment-collect:hover:not(:disabled){background:#3a3a3a;border-color:#3a3a3a;transform:translateY(-1px)}
        .ta-payment-collect:active:not(:disabled){transform:translateY(0)}
        .ta-payment-collect:focus-visible{outline:3px solid #a3a3a3;outline-offset:3px}
        .ta-payment-collect:disabled{opacity:.55;cursor:not-allowed;box-shadow:none}
        @media(max-width:640px){
          .ta-order-meta>div:has(.ta-payment-collect){grid-column:1/-1;padding:12px;border:1px solid #e8e8e8;border-radius:12px;background:#fafafa}
          .ta-payment-collect{width:100%;min-height:42px;font-size:12px}
        }
        @media(prefers-reduced-motion:reduce){.ta-payment-collect{transition:none}}
      `}</style>
    </main>
  );
}
