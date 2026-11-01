"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ChefHat, CheckCircle2, Clock3, LoaderCircle, RefreshCw } from "lucide-react";

type KitchenItem = {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  special_instructions: string | null;
};

type KitchenOrder = {
  id: string;
  order_number: number;
  total_amount: number;
  created_at: string;
  status: string;
  notes: string | null;
  restaurant_tables: { table_code: string } | null;
  order_items: KitchenItem[];
};

const zone = "Asia/Kolkata";
const money = (n: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
}).format(n);

export default function KitchenPage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState("");
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [completed, setCompleted] = useState<KitchenOrder[]>([]);
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

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
        .select("id,order_number,total_amount,created_at,status,notes,restaurant_tables(table_code),order_items(id,product_name,quantity,unit_price,line_total,special_instructions)")
        .eq("restaurant_id", profile.restaurant_id)
        .eq("order_type", "dine_in")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const rows = (data || []) as unknown as KitchenOrder[];
      setOrders(rows.filter((o) => !["completed", "delivered", "cancelled", "rejected"].includes(o.status)));
      setCompleted(rows.filter((o) => ["completed", "delivered"].includes(o.status)));
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

  async function complete(order: KitchenOrder) {
    if (!supabase || busy) return;
    setBusy(order.id);
    setMessage("");
    const { error } = await supabase.from("orders")
      .update({ status: "completed" })
      .eq("id", order.id)
      .eq("restaurant_id", restaurantId)
      .eq("order_type", "dine_in");
    if (error) setMessage("Could not complete KOT: " + error.message);
    else await load();
    setBusy("");
  }

  const visible = tab === "active" ? orders : completed;

  return (
    <main className="container ta-manage-page" style={{ maxWidth: 980 }}>
      <Link href="/restaurant-admin" className="ta-back-link"><ArrowLeft size={15} /> Dashboard</Link>
      <header className="ta-manage-heading">
        <div>
          <span className="ta-eyebrow">DINE-IN · KITCHEN WORKSPACE</span>
          <h1>Kitchen tickets<span>.</span></h1>
          <p>Every table order appears as its own KOT.</p>
        </div>
        <button className="ta-refresh-button" onClick={() => void load(true)} disabled={loading || refreshing}>
          <RefreshCw size={15} /> Refresh
        </button>
      </header>
      {message && <div className="ta-manage-message" role="status">{message}</div>}
      <div style={{ display: "flex", gap: 10, margin: "22px 0" }}>
        <button className="ta-filter-select" onClick={() => setTab("active")} aria-pressed={tab === "active"}>Active · {orders.length}</button>
        <button className="ta-filter-select" onClick={() => setTab("completed")} aria-pressed={tab === "completed"}>Completed · {completed.length}</button>
      </div>
      {loading ? (
        <div className="ta-menu-empty"><LoaderCircle size={28} /><h3>Loading kitchen tickets...</h3></div>
      ) : visible.length === 0 ? (
        <div className="ta-menu-empty"><ChefHat size={32} /><h3>{tab === "active" ? "No active KOTs" : "No completed KOTs"}</h3><p>New dine-in orders will appear here automatically.</p></div>
      ) : (
        <section style={{ display: "grid", gap: 16 }}>
          {visible.map((order) => (
            <article key={order.id} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 18, background: "#fff", color: "#111" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", borderBottom: "1px solid #eee", paddingBottom: 13 }}>
                <div>
                  <span style={{ fontSize: 11, letterSpacing: 1.5, color: "#777", fontWeight: 700 }}>KITCHEN ORDER TICKET</span>
                  <h2 style={{ fontSize: 27, margin: "4px 0", fontWeight: 800 }}>#{order.order_number}</h2>
                  <strong style={{ fontSize: 15 }}>TABLE {order.restaurant_tables?.table_code || "—"}</strong>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}><Clock3 size={14} />{new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: zone })}</span>
              </div>
              <div style={{ display: "grid", gap: 12, padding: "15px 0" }}>
                {(order.order_items || []).map((item) => (
                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
                    <div>
                      <strong style={{ fontSize: 16 }}>{item.quantity} × {item.product_name}</strong>
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
                  {busy === order.id ? <LoaderCircle size={16} /> : <CheckCircle2 size={16} />} Complete
                </button>}
                {tab === "completed" && <span style={{ color: "#28734c", fontWeight: 700, fontSize: 13 }}>Completed</span>}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
