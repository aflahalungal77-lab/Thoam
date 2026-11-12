"use client";

import { useLanguage } from "@/components/LanguageProvider";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Check, ChevronRight, Clock3, MapPin, PackageCheck, RefreshCw, ShoppingBag, X, CreditCard, Utensils, Truck, CircleCheck } from "lucide-react";

const TZ = "Asia/Kolkata";
type OrderHistoryEntry = { order_id: string; new_status: string; created_at: string; note?: string | null };
type Order = {
  id: string; order_number: number | null; status: string; total_amount: number | string;
  created_at: string; updated_at?: string; order_type: string; payment_status: string;
  delivery_address?: string | null;
  restaurant?: { name?: string; area?: string; city?: string } | null;
  order_items?: Array<{ id: string; product_name: string; quantity: number; line_total: number | string }>;
  history?: Array<{ new_status: string; created_at: string; note?: string | null }>;
};
const steps = [
  { key: "placed", label: "Order placed", detail: "Your order has been received", icon: ShoppingBag },
  { key: "preparing", label: "Preparing", detail: "The restaurant is preparing your food", icon: Utensils },
  { key: "ready", label: "Ready", detail: "Your order is packed and ready", icon: PackageCheck },
  { key: "out_for_delivery", label: "Out for delivery", detail: "Your order is on its way", icon: Truck },
  { key: "delivered", label: "Delivered", detail: "Enjoy your meal!", icon: CircleCheck },
];
const norm = (s?: string) => {
  const v = String(s || "placed").toLowerCase();
  return v === "accepted" ? "preparing" : v === "completed" ? "delivered" : v;
};
const money = (v: number | string) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(v || 0));
const dateTime = (v?: string) => {
  if (!v) return "Not updated yet";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "Not available" : d.toLocaleString("en-IN", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};
const shortDate = (v?: string) => v ? new Date(v).toLocaleDateString("en-IN", { timeZone: TZ, day: "numeric", month: "short" }) : "—";
const label = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const currentStep = (s: string, isDineIn = false) => {
  const v = norm(s);
  if (["cancelled", "rejected"].includes(v)) return -1;
  if (isDineIn && v === "delivered") return 3;
  const i = steps.findIndex((x) => x.key === v);
  return i < 0 ? 0 : i;
};

export default function MyOrders() {
  const { t } = useLanguage();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [msg, setMsg] = useState("Loading your orders…");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (manual = false) => {
    if (!supabase) { setMsg("Connect Supabase to see your orders."); setLoading(false); return; }
    if (manual) setRefreshing(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { router.replace("/auth?next=/my-orders"); return; }
      const { data, error } = await supabase.from("orders")
        .select("id,order_number,status,total_amount,created_at,updated_at,order_type,payment_status,delivery_address,restaurant:restaurants(name,area,city),order_items(id,product_name,quantity,line_total)")
        .eq("customer_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data || []) as unknown as Order[];
      const ids = rows.map((o) => o.id);
      let historyByOrder: Record<string, Order["history"]> = {};
      if (ids.length) {
        const { data: history } = await supabase.from("order_status_history")
          .select("order_id,new_status,created_at,note").in("order_id", ids).order("created_at", { ascending: true });
        historyByOrder = ((history || []) as OrderHistoryEntry[]).reduce((acc: Record<string, OrderHistoryEntry[]>, item) => {
          (acc[item.order_id] ||= []).push(item); return acc;
        }, {});
      }
      const enriched = rows.map((o) => ({ ...o, history: historyByOrder[o.id] || [] }));
      setOrders(enriched);
      setSelected((old) => old ? enriched.find((o) => o.id === old.id) || null : null);
      setMsg(enriched.length ? "" : "Your next favourite meal is just a few taps away.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Unable to load your orders.");
    } finally { setLoading(false); setRefreshing(false); }
  }, [router]);

  useEffect(() => {
    void load();
    if (!supabase) return;
    const channel = supabase.channel("customer-order-tracking")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void load(true); })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_status_history" }, () => { void load(true); })
      .subscribe();
    const fallback = window.setInterval(() => { void load(true); }, 25000);
    return () => { window.clearInterval(fallback); void supabase?.removeChannel(channel); };
  }, [load]);

  const activeCount = useMemo(() => orders.filter((o) => !["delivered", "completed", "cancelled", "rejected"].includes(String(o.status).toLowerCase())).length, [orders]);

  return <>
    <Header />
    <main className="container thoam-myorders">
      <header className="mo-heading">
        <div><span className="mo-eyebrow">{t("YOUR THO'AM ACCOUNT")}</span><h1>{t("My orders")}<span>.</span></h1><p>{t("Every order, every update — all in one place.")}</p></div>
        <button className="mo-refresh" onClick={() => void load(true)} disabled={refreshing || loading}><RefreshCw size={15} className={refreshing ? "mo-spin" : ""} /> {t("Refresh")}</button>
      </header>

      {!loading && orders.length > 0 && <section className="mo-summary">
        <div className="mo-summary-icon"><ShoppingBag size={19} /></div>
        <div><strong>{orders.length} {orders.length === 1 ? "order" : "orders"}</strong><span>{activeCount ? activeCount + " currently in progress" : "You're all caught up"}</span></div>
        <div className="mo-summary-total"><span>{t("Order history")}</span><strong>{orders.length.toString().padStart(2, "0")}</strong></div>
      </section>}

      {msg && <div className={loading ? "mo-loading" : "mo-empty"}>
        {loading ? <span className="mo-loader" /> : <div className="mo-empty-icon"><ShoppingBag size={25} /></div>}
        <h2>{loading ? "Getting your orders" : orders.length ? "Something needs attention" : "No orders yet"}</h2><p>{msg}</p>
        {!loading && orders.length === 0 && <Link href="/restaurants" className="mo-browse">{t("Explore restaurants")} <ArrowRight size={16} /></Link>}
        {!loading && orders.length > 0 && <button className="mo-browse" onClick={() => void load(true)}>{t("Try again")}</button>}
      </div>}

      {orders.length > 0 && <section className="mo-list-section">
        <div className="mo-section-title"><div><span className="mo-eyebrow">{t("RECENT ACTIVITY")}</span><h2>{t("Your orders")}</h2></div><span>{orders.length} {t("total")}</span></div>
        <div className="mo-order-list">{orders.map((o) => {
          const s = norm(o.status);
          const cancelled = ["cancelled", "rejected"].includes(s);
          const done = s === "delivered";
          return <button type="button" className="mo-order-card" key={o.id} onClick={() => setSelected(o)}>
            <div className="mo-card-top">
              <div className="mo-card-brand"><span className="mo-card-icon"><ShoppingBag size={18} /></span><div><small>{t("ORDER ID")}</small><strong>#{o.order_number || o.id.slice(0, 8).toUpperCase()}</strong></div></div>
              <span className={"mo-status-pill " + (cancelled ? "is-cancelled" : done ? "is-done" : "is-active")}><i />{cancelled ? label(s) : done ? "Delivered" : label(s)}</span>
            </div>
            <div className="mo-card-main"><div className="mo-restaurant"><strong>{o.restaurant?.name || "Tho'am restaurant"}</strong><span>{o.order_type === "dine_in" ? "Dine-in order" : "Delivery order"} · {shortDate(o.created_at)}</span></div>
              <div className="mo-card-total"><strong>{money(o.total_amount)}</strong><span>{o.order_items?.length || 0} items</span></div></div>
            <div className="mo-card-bottom"><span className="mo-card-date"><Clock3 size={13} /> {t("Placed")} {dateTime(o.created_at)}</span><span className="mo-track-link">{t("Track order")} <ChevronRight size={16} /></span></div>
            {!cancelled && <div className="mo-mini-progress"><span style={{ width: Math.max(8, (currentStep(s, o.order_type === "dine_in") + 1) / 5 * 100) + "%" }} /></div>}
          </button>;
        })}</div>
      </section>}
    </main>

    {selected && <div className="mo-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
      <section className="mo-drawer" role="dialog" aria-modal="true" aria-labelledby="mo-dialog-title">
        <header className="mo-drawer-head"><div><span className="mo-eyebrow">{t("ORDER TRACKING")}</span><h2 id="mo-dialog-title">#{selected.order_number || selected.id.slice(0, 8).toUpperCase()}</h2><p>{selected.restaurant?.name || "Tho'am restaurant"}</p></div>
          <button className="mo-close" onClick={() => setSelected(null)} aria-label={t("Close tracking")}><X size={19} /></button></header>
        <div className="mo-drawer-scroll">
          {["cancelled", "rejected"].includes(norm(selected.status)) ? <div className="mo-cancelled"><span><X size={18} /></span><div><strong>Order {label(norm(selected.status)).toLowerCase()}</strong><p>{t("Please contact the restaurant if you need more information.")}</p></div></div> :
            <div className="mo-live-banner"><span className="mo-live-dot" /><div><strong>{norm(selected.status) === "delivered" ? "Order completed" : "Live order updates"}</strong><p>{norm(selected.status) === "delivered" ? "Your order has reached its destination." : "This timeline updates when the restaurant changes your order status."}</p></div></div>}
          <div className="mo-timeline">{steps.filter((x) => selected.order_type !== "dine_in" || x.key !== "out_for_delivery").map((step, index, arr) => {
            const idx = currentStep(selected.status, selected.order_type === "dine_in");
            const isDone = idx >= index && idx >= 0;
            const isCurrent = idx === index;
            const history = selected.history?.find((h) => norm(h.new_status) === step.key);
            const time = step.key === "placed" ? selected.created_at : history?.created_at || (isCurrent ? selected.updated_at : undefined);
            const Icon = step.icon;
            return <div className={"mo-step " + (isDone ? "is-done " : "") + (isCurrent ? "is-current" : "")} key={step.key}>
              <div className="mo-step-rail"><span className="mo-step-icon">{isDone ? <Check size={16} /> : <Icon size={16} />}</span>{index < arr.length - 1 && <i />}</div>
              <div className="mo-step-copy"><div className="mo-step-title"><strong>{step.label}</strong>{isCurrent && <em>{t("Current status")}</em>}</div><p>{step.detail}</p><small>{time ? dateTime(time) : isDone ? t("Update time not recorded") : t("Waiting for update")}</small></div>
            </div>;
          })}</div>
          <div className="mo-detail-card"><h3>{t("Order details")}</h3>
            <div className="mo-detail-row"><span><Clock3 size={14} /> {t("Order placed")}</span><strong>{dateTime(selected.created_at)}</strong></div>
            <div className="mo-detail-row"><span><CreditCard size={14} /> {t("Payment · Cash on delivery")}</span><strong>{selected.payment_status === "collected" ? t("Cash collected") : selected.payment_status === "refunded" ? t("Refunded") : t("Pay on arrival")}</strong></div>
            {selected.order_type === "delivery" && selected.delivery_address && <div className="mo-detail-row"><span><MapPin size={14} /> {t("Delivery address")}</span><strong>{selected.delivery_address}</strong></div>}
            <div className="mo-detail-total"><span>{t("Total amount")}</span><strong>{money(selected.total_amount)}</strong></div>
          </div>
          {!!selected.order_items?.length && <div className="mo-detail-card"><h3>{t("Items in this order")}</h3>{selected.order_items.map((item) => <div className="mo-item-row" key={item.id}><span>{item.quantity} × {item.product_name}</span><strong>{money(item.line_total)}</strong></div>)}</div>}
          <p className="mo-update-note"><RefreshCw size={12} /> {t("Order status refreshes automatically.")}</p>
        </div>
        <footer className="mo-drawer-footer"><button onClick={() => void load(true)} disabled={refreshing}><RefreshCw size={14} className={refreshing ? "mo-spin" : ""} /> {t("Refresh tracking")}</button><button onClick={() => setSelected(null)}>{t("Done")}</button></footer>
      </section>
    </div>}

    <style jsx global>{`
      .thoam-myorders{max-width:940px;padding-bottom:100px;color:#171717}
      .mo-heading{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:52px 0 27px}
      .mo-eyebrow{display:block;color:#85857d;font-size:9px;font-weight:850;letter-spacing:2px}
      .mo-heading h1{margin:9px 0 7px;font-size:clamp(38px,6vw,57px);line-height:1;letter-spacing:-2.8px;font-weight:850}
      .mo-heading h1 span{color:#b8b8af}.mo-heading p{margin:0;color:#85857d;font-size:13px;line-height:1.7}
      .mo-refresh{display:inline-flex;align-items:center;gap:8px;padding:11px 15px;border:1px solid #e8e8e2;border-radius:10px;background:#fff;color:#34342f;font-size:11px;font-weight:750;cursor:pointer}
      .mo-refresh:disabled{opacity:.55;cursor:wait}
      .mo-summary{display:flex;align-items:center;gap:13px;padding:17px 19px;border:1px solid #e9e9e3;border-radius:15px;background:linear-gradient(110deg,#fafaf7,#fff);margin-bottom:34px}
      .mo-summary-icon{display:grid;place-items:center;width:43px;height:43px;border-radius:12px;background:#171717;color:#fff}
      .mo-summary>div:nth-child(2){display:grid;gap:4px}.mo-summary>div:nth-child(2) strong{font-size:13px}.mo-summary>div:nth-child(2) span,.mo-summary-total span{font-size:10px;color:#888}
      .mo-summary-total{display:grid;gap:3px;margin-left:auto;text-align:right}.mo-summary-total strong{font-size:20px;letter-spacing:-.7px}
      .mo-section-title{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:15px}.mo-section-title h2{margin:6px 0 0;font-size:25px;letter-spacing:-1px}.mo-section-title>span{color:#888;font-size:11px}
      .mo-order-list{display:grid;gap:12px}
      .mo-order-card{display:block;width:100%;padding:18px 19px 15px;border:1px solid #e9e9e3;border-radius:15px;background:#fff;text-align:left;color:inherit;cursor:pointer;transition:border-color .2s,box-shadow .2s,transform .2s}
      .mo-order-card:hover{border-color:#c9c9c0;box-shadow:0 10px 30px #1717170a;transform:translateY(-2px)}
      .mo-card-top,.mo-card-brand,.mo-card-main,.mo-card-bottom{display:flex;align-items:center;justify-content:space-between;gap:12px}.mo-card-brand{justify-content:flex-start}
      .mo-card-icon{display:grid;place-items:center;width:39px;height:39px;border-radius:12px;background:#f2f2ee;color:#24241f}
      .mo-card-brand>div{display:grid;gap:4px}.mo-card-brand small{font-size:8px;letter-spacing:1.4px;color:#999;font-weight:850}.mo-card-brand strong{font-size:13px}
      .mo-status-pill{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:30px;background:#f4f4f0;color:#555;font-size:9px;font-weight:800;text-transform:capitalize}
      .mo-status-pill i{width:6px;height:6px;border-radius:50%;background:#a0a098}
      .mo-status-pill.is-active{background:#f2f5ef;color:#496b3c}.mo-status-pill.is-active i{background:#67944f;box-shadow:0 0 0 3px #67944f20}
      .mo-status-pill.is-done{background:#edf5ef;color:#287345}.mo-status-pill.is-done i{background:#39865a}
      .mo-status-pill.is-cancelled{background:#f8eeee;color:#a54a4a}.mo-status-pill.is-cancelled i{background:#bd6565}
      .mo-card-main{padding:17px 0 14px;border-bottom:1px solid #f0f0ec}.mo-restaurant{display:grid;gap:5px;min-width:0}.mo-restaurant strong{font-size:14px;overflow-wrap:anywhere}.mo-restaurant span{font-size:10px;color:#898981;text-transform:capitalize}
      .mo-card-total{display:grid;gap:4px;text-align:right;flex-shrink:0}.mo-card-total strong{font-size:17px;letter-spacing:-.4px}.mo-card-total span{font-size:9px;color:#92928b}
      .mo-card-bottom{padding-top:12px}.mo-card-date{display:inline-flex;align-items:center;gap:6px;color:#92928b;font-size:9px}.mo-track-link{display:inline-flex;align-items:center;gap:3px;color:#222;font-size:10px;font-weight:850}
      .mo-mini-progress{height:3px;margin-top:15px;border-radius:9px;background:#efefeb;overflow:hidden}.mo-mini-progress span{display:block;height:100%;border-radius:9px;background:#20201c;transition:width .3s ease}
      .mo-loading,.mo-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:300px;padding:35px 20px;text-align:center}
      .mo-loading h2,.mo-empty h2{margin:17px 0 6px;font-size:19px;letter-spacing:-.5px}.mo-loading p,.mo-empty p{max-width:400px;margin:0;color:#898981;font-size:12px;line-height:1.7}
      .mo-empty-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:#f1f1ed;color:#34342e}
      .mo-loader{width:28px;height:28px;border:3px solid #e8e8e2;border-top-color:#222;border-radius:50%;animation:mo-rotate .8s linear infinite}
      .mo-browse{display:inline-flex;align-items:center;gap:8px;margin-top:18px;padding:12px 16px;border:0;border-radius:9px;background:#171717;color:white;font-size:11px;font-weight:800;cursor:pointer;text-decoration:none}
      .mo-overlay{position:fixed;z-index:1000;inset:0;display:flex;justify-content:flex-end;background:rgba(15,15,13,.48);backdrop-filter:blur(4px);animation:mo-fade .18s ease}
      .mo-drawer{display:flex;flex-direction:column;width:min(510px,100%);height:100%;background:#fff;box-shadow:-20px 0 70px #0002;animation:mo-enter .25s ease}
      .mo-drawer-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;padding:27px 27px 21px;border-bottom:1px solid #eeeeea}
      .mo-drawer-head h2{margin:7px 0 4px;font-size:27px;letter-spacing:-1px}.mo-drawer-head p{margin:0;color:#85857d;font-size:11px}
      .mo-close{display:grid;place-items:center;width:38px;height:38px;border:1px solid #e9e9e4;border-radius:11px;background:white;color:#333;cursor:pointer}
      .mo-drawer-scroll{flex:1;overflow-y:auto;padding:22px 27px 30px}
      .mo-live-banner{display:flex;gap:11px;padding:14px;border:1px solid #e7ece4;border-radius:12px;background:#f8faf6}
      .mo-live-dot{flex-shrink:0;width:8px;height:8px;margin:4px 0 0;border-radius:50%;background:#53844a;box-shadow:0 0 0 4px #53844a18}
      .mo-live-banner strong{font-size:12px}.mo-live-banner p{margin:4px 0 0;color:#858b80;font-size:10px;line-height:1.6}
      .mo-cancelled{display:flex;gap:11px;padding:14px;border:1px solid #f0dddd;border-radius:12px;background:#fff8f8}.mo-cancelled>span{display:grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#f7e6e6;color:#a44b4b}.mo-cancelled strong{font-size:12px}.mo-cancelled p{margin:4px 0 0;color:#947d7d;font-size:10px}
      .mo-timeline{padding:24px 4px 18px}.mo-step{display:flex;gap:14px;min-height:82px}.mo-step:last-child{min-height:60px}
      .mo-step-rail{position:relative;display:flex;flex-direction:column;align-items:center;width:31px;flex-shrink:0}
      .mo-step-icon{z-index:1;display:grid;place-items:center;width:31px;height:31px;border:1px solid #e7e7e1;border-radius:50%;background:#fff;color:#a1a19a;transition:all .2s}
      .mo-step-rail>i{width:1px;flex:1;min-height:43px;margin:4px 0;background:#e8e8e2}
      .mo-step.is-done .mo-step-icon{border-color:#20201c;background:#20201c;color:white}.mo-step.is-done .mo-step-rail>i{background:#333}
      .mo-step-copy{flex:1;padding:2px 0 18px}.mo-step-title{display:flex;align-items:center;gap:9px;flex-wrap:wrap}
      .mo-step-title strong{font-size:12px;color:#9b9b94}.mo-step.is-done .mo-step-title strong{color:#24241f}
      .mo-step-title em{padding:4px 7px;border-radius:20px;background:#f0f4ec;color:#5c794b;font-size:8px;font-style:normal;font-weight:850}
      .mo-step-copy p{margin:5px 0;color:#999990;font-size:10px}.mo-step-copy small{color:#aaa99f;font-size:9px}.mo-step.is-current .mo-step-copy small{color:#5d7650;font-weight:750}
      .mo-detail-card{margin-top:15px;padding:17px;border:1px solid #ecece7;border-radius:13px;background:#fff}.mo-detail-card h3{margin:0 0 14px;font-size:13px}
      .mo-detail-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:9px 0;border-bottom:1px solid #f1f1ed}
      .mo-detail-row span{display:inline-flex;align-items:center;gap:7px;color:#898981;font-size:10px;flex-shrink:0}
      .mo-detail-row strong{max-width:58%;color:#333;font-size:10px;text-align:right;overflow-wrap:anywhere}
      .mo-detail-total{display:flex;justify-content:space-between;align-items:center;padding-top:14px}.mo-detail-total span{color:#777;font-size:11px}.mo-detail-total strong{font-size:18px}
      .mo-item-row{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid #f1f1ed;font-size:10px}.mo-item-row strong{white-space:nowrap}
      .mo-update-note{display:flex;align-items:center;justify-content:center;gap:6px;margin:17px 0 0;color:#a0a098;font-size:9px}
      .mo-drawer-footer{display:flex;justify-content:space-between;gap:10px;padding:15px 27px calc(15px + env(safe-area-inset-bottom));border-top:1px solid #eeeeea;background:#fff}
      .mo-drawer-footer button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:42px;padding:0 15px;border:1px solid #e7e7e2;border-radius:9px;background:white;color:#333;font-size:10px;font-weight:800;cursor:pointer}
      .mo-drawer-footer button:last-child{min-width:90px;border-color:#171717;background:#171717;color:white}.mo-drawer-footer button:disabled{opacity:.5}
      .mo-spin{animation:mo-rotate .8s linear infinite}@keyframes mo-rotate{to{transform:rotate(360deg)}}
      @keyframes mo-fade{from{opacity:0}to{opacity:1}}@keyframes mo-enter{from{transform:translateX(30px);opacity:.8}to{transform:translateX(0);opacity:1}}
      @media(max-width:640px){
        .thoam-myorders{width:min(100% - 28px,940px)}.mo-heading{padding:35px 0 21px;align-items:flex-start}.mo-heading h1{font-size:42px}
        .mo-refresh{padding:9px 11px;font-size:10px}.mo-summary{padding:13px;margin-bottom:27px}
        .mo-order-card{padding:15px 14px 13px;border-radius:13px}.mo-card-main{align-items:flex-start}
        .mo-restaurant strong{font-size:12px}.mo-card-total strong{font-size:15px}.mo-card-date{font-size:8px}.mo-track-link{font-size:9px}
        .mo-drawer{width:100%;height:100dvh}.mo-drawer-head{padding:22px 19px 17px}.mo-drawer-scroll{padding:18px 19px 25px}
        .mo-drawer-footer{padding-left:19px;padding-right:19px}.mo-detail-row{flex-direction:column;gap:6px}.mo-detail-row strong{max-width:100%;text-align:left}
      }
      @media(max-width:370px){.mo-card-bottom{align-items:flex-start;flex-direction:column}.mo-status-pill{font-size:8px;padding:6px 8px}}
      @media(prefers-reduced-motion:reduce){.mo-order-card,.mo-step-icon,.mo-mini-progress{transition:none}.mo-loader,.mo-spin{animation:none}}
    `}</style>
  </>;
}
