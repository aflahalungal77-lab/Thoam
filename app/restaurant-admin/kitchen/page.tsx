"use client";

import { useLanguage } from "@/components/LanguageProvider";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ChefHat, CheckCircle2, Clock3, LoaderCircle, RefreshCw, Search } from "lucide-react";

type KitchenItem = {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  special_instructions: string | null;
};

type BillingSessionOrder = { id: string; order_number?: number | string; total_amount: number | string; subtotal?: number | string; discount_amount?: number | string; order_items?: KitchenItem[] };
type BillingSession = { id: string; billing_code: string; status: string; restaurant_tables?: { table_code?: string } | null; orders?: BillingSessionOrder[] };

type KitchenOrder = {
  id: string;
  order_number: number;
  session_id?: string | null;
  order_sessions?: { billing_code?: string } | null;
  total_amount: number;
  created_at: string;
  status: string;
  notes: string | null;
  restaurant_tables: { table_code: string } | null;
  order_items: KitchenItem[];
};

type KitchenTicket = KitchenOrder & { groupedOrderIds: string[]; groupedCount: number };

function groupKitchenOrders(rows: KitchenOrder[]): KitchenTicket[] {
  const groups = new Map<string, KitchenOrder[]>();
  for (const order of rows) {
    const key = order.session_id || order.id;
    const current = groups.get(key) || [];
    current.push(order);
    groups.set(key, current);
  }

  return Array.from(groups.values()).map((group) => {
    const first = group[0];
    const mergedItems = new Map<string, KitchenItem>();
    for (const order of group) {
      for (const item of order.order_items || []) {
        const key = [item.product_name, item.variant_name || "", item.special_instructions || "", item.unit_price].join("::");
        const existing = mergedItems.get(key);
        if (existing) {
          existing.quantity += Number(item.quantity || 0);
          existing.line_total += Number(item.line_total || 0);
        } else {
          mergedItems.set(key, { ...item, quantity: Number(item.quantity || 0), line_total: Number(item.line_total || 0) });
        }
      }
    }
    return {
      ...first,
      order_number: group.length > 1 ? first.order_number : first.order_number,
      total_amount: group.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      created_at: group.reduce((latest, order) => order.created_at > latest ? order.created_at : latest, first.created_at),
      order_items: Array.from(mergedItems.values()),
      groupedOrderIds: group.map((order) => order.id),
      groupedCount: group.length,
    };
  });
}

const zone = "Asia/Kolkata";
const money = (n: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
}).format(n);

export default function KitchenPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState("");
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [completed, setCompleted] = useState<KitchenOrder[]>([]);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [billingSessions, setBillingSessions] = useState<BillingSession[]>([]);
  const [billingSearch, setBillingSearch] = useState("");
  const [selectedSession, setSelectedSession] = useState<BillingSession | null>(null);

  const load = useCallback(async (manual = false) => {
    if (!supabase) {
      setMessage("Supabase is not configured.");
      setLoading(false);
      return;
    }
    if (manual) setRefreshing(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.replace("/auth?role=owner&next=/restaurant-admin/kitchen");
        return;
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("restaurant_id,role").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!["restaurant_owner", "admin"].includes(profile?.role || "") || !profile?.restaurant_id) {
        setMessage("This account is not linked to a restaurant.");
        return;
      }
      setRestaurantId(profile.restaurant_id);
      const { data, error } = await supabase
        .from("orders")
        .select("id,order_number,session_id,total_amount,created_at,status,notes,restaurant_tables(table_code),order_sessions(billing_code),order_items(id,product_name,variant_name,quantity,unit_price,line_total,special_instructions)")
        .eq("restaurant_id", profile.restaurant_id)
        .eq("order_type", "dine_in")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = (data || []) as unknown as KitchenOrder[];
      setOrders(rows.filter((o) => !["completed", "delivered", "cancelled", "rejected"].includes(o.status)));
      setCompleted(rows.filter((o) => ["completed", "delivered"].includes(o.status)));

      const { data: sessionRows, error: sessionsError } = await supabase
        .from("order_sessions")
        .select("id,billing_code,status,restaurant_tables(table_code),orders(id,order_number,total_amount,subtotal,discount_amount,order_items(id,product_name,variant_name,quantity,unit_price,line_total,special_instructions))")
        .eq("restaurant_id", profile.restaurant_id)
        .eq("status", "open")
        .order("created_at", { ascending: false });
      if (sessionsError) throw sessionsError;
      setBillingSessions((sessionRows || []) as unknown as BillingSession[]);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load kitchen tickets.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!supabase || !restaurantId) return;
    const channel = supabase.channel("kitchen-kot-" + restaurantId)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: "restaurant_id=eq." + restaurantId }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => { void load(); })
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [restaurantId, load]);

  async function complete(order: KitchenTicket) {
    if (!supabase || busy) return;
    setBusy(order.id);
    setMessage("");
    const { error } = await supabase.from("orders")
      .update({ status: "delivered" })
      .in("id", order.groupedOrderIds)
      .eq("restaurant_id", restaurantId)
      .eq("order_type", "dine_in");
    if (error) setMessage("Could not mark order as served: " + error.message);
    else await load();
    setBusy("");
  }

  async function closeBillingSession(id: string) {
    if (!supabase || busy) return;
    const confirmed = window.confirm("Close this table bill only after entering it in Petpooja? The next QR order will receive a new short code.");
    if (!confirmed) return;
    setBusy(id);
    setMessage("");
    try {
      const { error } = await supabase.from("order_sessions")
        .update({ status: "closed", closed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id).eq("restaurant_id", restaurantId).eq("status", "open");
      if (error) throw error;
      setSelectedSession(null);
      await load(true);
      setMessage("Billing session closed. Its short code can now be reused.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not close billing session.");
    } finally {
      setBusy("");
    }
  }

  const visible = groupKitchenOrders(tab === "active" ? orders : completed);
  const visibleBillingSessions = billingSessions.filter((session) =>
    session.billing_code.toLowerCase().includes(billingSearch.trim().toLowerCase())
  );

  return (
    <main className="container ta-manage-page" style={{ maxWidth: 980 }}>
      <Link href="/restaurant-admin" className="ta-back-link"><ArrowLeft size={15} /> {t("Dashboard")}</Link>
      <header className="ta-manage-heading">
        <div>
          <span className="ta-eyebrow">{t("DINE-IN · KITCHEN WORKSPACE")}</span>
          <h1>{t("Kitchen tickets")}<span>.</span></h1>
          <p>Live kitchen tickets, table billing codes and service handoff in one workspace.</p>
        </div>
        <button className="ta-refresh-button" onClick={() => void load(true)} disabled={loading || refreshing}>
          <RefreshCw size={15} /> Refresh
        </button>
      </header>
      {message && <div className="ta-manage-message" role="status">{message}</div>}

      <section className="kot-billing-panel">
        <div className="kot-panel-heading">
          <div>
            <span className="kot-kicker">TABLE BILLING</span>
            <h2>Find a bill <span>({billingSessions.length} open)</span></h2>
            <p>Enter the 4-character code from the customer&apos;s QR order.</p>
          </div>
          <div className="kot-code-mark"><span>QUICK SEARCH</span><strong>AB<span>00</span></strong></div>
        </div>
        <label className="kot-search">
          <Search size={18} />
          <input value={billingSearch} onChange={(event) => setBillingSearch(event.target.value.toUpperCase().slice(0,4))} placeholder="Search code · e.g. MA32" maxLength={4} aria-label="Search billing code" />
          {billingSearch && <button type="button" onClick={() => setBillingSearch("")}>Clear</button>}
        </label>
        {visibleBillingSessions.length ? (
          <div className="kot-billing-grid">
            {visibleBillingSessions.map((session) => {
              const sessionOrders = session.orders || [];
              const total = sessionOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
              return <article className="kot-bill-card" key={session.id}>
                <div className="kot-bill-card-top"><span className="kot-open-dot">OPEN BILL</span><span>{sessionOrders.length} {sessionOrders.length === 1 ? "order" : "orders"}</span></div>
                <strong className="kot-bill-code">{session.billing_code}</strong>
                <span className="kot-bill-table">TABLE {session.restaurant_tables?.table_code || "—"}</span>
                <div className="kot-bill-card-bottom"><strong>{money(total)}</strong><button type="button" onClick={() => setSelectedSession(session)}>View bill <ArrowLeft size={14}/></button></div>
              </article>;
            })}
          </div>
        ) : <div className="kot-billing-empty">{billingSearch ? "No open bill matches this code." : "No open QR table bills right now."}</div>}
      </section>

      <div className="kot-tabs" style={{ display: "flex", gap: 10, margin: "22px 0" }}>
        <button className="ta-filter-select" onClick={() => setTab("active")} aria-pressed={tab === "active"}>{t("Active")} · {orders.length}</button>
        <button className="ta-filter-select" onClick={() => setTab("completed")} aria-pressed={tab === "completed"}>{t("Completed")} · {completed.length}</button>
      </div>
      {loading ? (
        <div className="ta-menu-empty"><LoaderCircle size={28} /><h3>{t("Loading kitchen tickets...")}</h3></div>
      ) : visible.length === 0 ? (
        <div className="ta-menu-empty"><ChefHat size={32} /><h3>{tab === "active" ? t("No active KOTs") : t("No completed KOTs")}</h3><p>{t("New dine-in orders will appear here automatically.")}</p></div>
      ) : (
        <section style={{ display: "grid", gap: 16 }}>
          {visible.map((order) => (
            <article key={order.id} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 18, background: "#fff", color: "#111" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", borderBottom: "1px solid #eee", paddingBottom: 13 }}>
                <div>
                  <span style={{ fontSize: 11, letterSpacing: 1.5, color: "#777", fontWeight: 700 }}>{t("KITCHEN ORDER TICKET")}</span>
                  <h2 style={{ fontSize: 27, margin: "4px 0", fontWeight: 800 }}>{order.order_sessions?.billing_code || `#${order.order_number}`}</h2>
                  {order.groupedCount > 1 && <span style={{ display: "block", marginTop: 4, color: "#718075", fontSize: 11, fontWeight: 700 }}>{order.groupedCount} QR orders combined</span>}
                  <strong style={{ fontSize: 15 }}>TABLE {order.restaurant_tables?.table_code || "—"}</strong>
                  {order.order_sessions?.billing_code && <div style={{ marginTop: 5, color: "#26724a", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>BILL · {order.order_sessions.billing_code}</div>}
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}><Clock3 size={14} />{new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: zone })}</span>
              </div>
              <div style={{ display: "grid", gap: 12, padding: "15px 0" }}>
                {(order.order_items || []).map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                    <div>
                      <strong style={{ fontSize: 16 }}>{item.quantity} × {item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ""}</strong>
                      {item.special_instructions && <p style={{ margin: "5px 0 0", fontSize: 13, color: "#555", background: "#f5f5f5", borderRadius: 8, padding: "7px 9px" }}>Note: {item.special_instructions}</p>}
                    </div>
                    <strong>{money(Number(item.line_total || 0))}</strong>
                  </div>
                ))}
              </div>
              {order.notes && <p style={{ background: "#fafafa", padding: 10, borderRadius: 8, fontSize: 13 }}>Order note: {order.notes}</p>}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, borderTop: "1px solid #eee", paddingTop: 13 }}>
                <strong>Total · {money(Number(order.total_amount || 0))}</strong>
                {tab === "active" && <button onClick={() => void complete(order)} disabled={busy === order.id} className="ta-form-submit" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {busy === order.id ? <LoaderCircle size={16} /> : <CheckCircle2 size={16} />} Served
                </button>}
                {tab === "completed" && <span style={{ color: "#28734c", fontWeight: 700, fontSize: 13 }}>{t("Completed")}</span>}
              </div>
            </article>
          ))}
        </section>
      )}
      {selectedSession && (
        <div className="kot-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSession(null); }}>
          <section className="kot-bill-modal" role="dialog" aria-modal="true" aria-labelledby="kot-bill-title">
            <header className="kot-modal-head">
              <div><span className="kot-kicker">THO&apos;AM · TABLE BILL</span><h2 id="kot-bill-title">{selectedSession.billing_code}</h2><p>Table {selectedSession.restaurant_tables?.table_code || "—"} · {selectedSession.orders?.length || 0} orders</p></div>
              <button type="button" onClick={() => setSelectedSession(null)} aria-label="Close bill">×</button>
            </header>
            <div className="kot-modal-items">
              {(selectedSession.orders || []).map((order) => <div className="kot-modal-order" key={order.id}>
                <strong>Order #{order.order_number || order.id.slice(0,8)}</strong>
                {(order.order_items || []).map((item) => <div className="kot-modal-row" key={item.id}><span>{item.product_name}{item.variant_name ? ` · ${item.variant_name}` : ""} × {item.quantity}</span><strong>{money(Number(item.line_total || 0))}</strong></div>)}
                {Number(order.discount_amount || 0) > 0 && <p>Offer discount −{money(Number(order.discount_amount))}</p>}
              </div>)}
            </div>
            <div className="kot-modal-total"><span>Combined total</span><strong>{money((selectedSession.orders || []).reduce((sum, order) => sum + Number(order.total_amount || 0), 0))}</strong></div>
            <p className="kot-modal-note">Enter this combined bill in Petpooja. After entering it, close this session so the table can start a fresh bill.</p>
            <div className="kot-modal-actions">
              <button className="kot-modal-secondary" type="button" onClick={() => setSelectedSession(null)}>Back to KOT</button>
              <button className="kot-modal-close" type="button" disabled={Boolean(busy)} onClick={() => void closeBillingSession(selectedSession.id)}>{busy === selectedSession.id ? "Closing…" : "Bill entered · Close session"}</button>
            </div>
          </section>
        </div>
      )}
      <style jsx global>{`
        .kot-billing-panel{margin:26px 0 24px;padding:24px;border:1px solid #e7e9e5;border-radius:22px;background:radial-gradient(circle at 100% 0%,#eff7ef 0,transparent 34%),linear-gradient(145deg,#fff,#fafbf8);box-shadow:0 14px 38px rgba(20,35,24,.055)}
        .kot-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:18px}
        .kot-kicker{font-size:10px;font-weight:850;letter-spacing:1.7px;color:#788278}
        .kot-panel-heading h2{margin:6px 0 4px;font-size:23px;letter-spacing:-.7px;color:#17251b}
        .kot-panel-heading h2 span{font-size:13px;font-weight:600;color:#829084}
        .kot-panel-heading p{margin:0;color:#7a857c;font-size:12px}
        .kot-code-mark{padding:12px 16px;border:1px solid #e3e9e1;border-radius:15px;background:#fff;text-align:right}
        .kot-code-mark span{display:block;font-size:9px;font-weight:800;letter-spacing:1.3px;color:#9aa39a}
        .kot-code-mark strong{font-size:23px;letter-spacing:3px;color:#1b4930}.kot-code-mark strong span{display:inline;font-size:inherit;color:#8caa91}
        .kot-search{display:flex;align-items:center;gap:11px;margin:20px 0 14px;padding:0 15px;height:52px;border:1px solid #e2e8e1;border-radius:14px;background:#fff;color:#829084;max-width:480px}
        .kot-search:focus-within{border-color:#548264;box-shadow:0 0 0 3px rgba(69,126,82,.1)}
        .kot-search input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:#1a2a1e;font-size:15px;font-weight:750;letter-spacing:2px}
        .kot-search button{border:0;background:#f1f4f0;border-radius:8px;padding:6px 9px;color:#536256;font-size:11px;font-weight:700}
        .kot-billing-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:11px}
        .kot-bill-card{padding:15px;border:1px solid #e8ece7;border-radius:16px;background:#fff}
        .kot-bill-card-top,.kot-bill-card-bottom{display:flex;align-items:center;justify-content:space-between;gap:10px}
        .kot-bill-card-top{font-size:10px;color:#929b92}
        .kot-open-dot{color:#277449;font-size:9px;font-weight:900;letter-spacing:1px}
        .kot-bill-code{display:block;margin:8px 0 2px;font-size:27px;letter-spacing:2.5px;color:#18281d}
        .kot-bill-table{font-size:10px;font-weight:800;letter-spacing:1.1px;color:#89948a}
        .kot-bill-card-bottom{margin-top:14px;padding-top:12px;border-top:1px solid #eff1ee}
        .kot-bill-card-bottom>strong{font-size:16px;color:#203d29}
        .kot-bill-card-bottom button{display:flex;align-items:center;gap:5px;border:0;border-radius:9px;background:#173d29;color:#fff;padding:8px 11px;font-size:11px;font-weight:750}
        .kot-bill-card-bottom button svg{transform:rotate(135deg)}
        .kot-billing-empty{padding:15px;border:1px dashed #dce3dc;border-radius:12px;color:#8b958b;font-size:12px}
        .kot-tabs button{border-radius:12px!important;padding:10px 15px!important;font-weight:750}
        .kot-modal-backdrop{position:fixed;inset:0;z-index:1000;background:rgba(10,19,13,.55);backdrop-filter:blur(7px);display:grid;place-items:center;padding:18px}
        .kot-bill-modal{width:min(100%,560px);max-height:88vh;overflow:auto;border-radius:22px;background:#fff;padding:23px;box-shadow:0 28px 90px rgba(0,0,0,.22);color:#17251b}
        .kot-modal-head{display:flex;justify-content:space-between;gap:15px;padding-bottom:16px;border-bottom:1px solid #edf0ec}
        .kot-modal-head h2{font-size:31px;letter-spacing:2px;margin:5px 0}
        .kot-modal-head p{margin:0;color:#7d887e;font-size:12px}
        .kot-modal-head button{width:34px;height:34px;border:0;border-radius:50%;background:#f1f4f0;font-size:22px;color:#334337}
        .kot-modal-items{padding:10px 0}
        .kot-modal-order{padding:12px 0;border-bottom:1px solid #edf0ec}
        .kot-modal-order>strong{display:block;margin-bottom:8px;font-size:11px;color:#7c897e}
        .kot-modal-row{display:flex;justify-content:space-between;gap:14px;padding:5px 0;font-size:13px}
        .kot-modal-order p{margin:6px 0 0;text-align:right;font-size:11px;color:#8a938a}
        .kot-modal-total{display:flex;justify-content:space-between;align-items:center;padding:15px 0;font-size:13px;color:#647267}
        .kot-modal-total strong{font-size:24px;color:#183e29}
        .kot-modal-note{padding:12px;border-radius:11px;background:#f5f8f4;color:#69776b;font-size:11px;line-height:1.5}
        .kot-modal-actions{display:grid;grid-template-columns:1fr 1.6fr;gap:9px}.kot-modal-secondary{border:1px solid #e2e8e1;border-radius:12px;background:#fff;color:#354438;padding:13px;font-weight:750}.kot-modal-close{width:100%;border:0;border-radius:12px;background:#173d29;color:#fff;padding:13px;font-weight:800}
        @media(max-width:600px){.kot-billing-panel{padding:17px;border-radius:17px}.kot-code-mark{display:none}.kot-panel-heading h2{font-size:20px}.kot-bill-modal{padding:18px}}
      `}</style>
    </main>
  );
}
