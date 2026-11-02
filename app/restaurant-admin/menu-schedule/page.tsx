"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Clock3, Plus, Trash2, LoaderCircle } from "lucide-react";

type Product = { id: string; name: string; is_available: boolean };
type Schedule = {
  id: string; product_id: string; weekdays: number[];
  starts_at: string; ends_at: string; is_enabled: boolean;
};

const DAYS = [
  { label: "Sun", value: 0 }, { label: "Mon", value: 1 },
  { label: "Tue", value: 2 }, { label: "Wed", value: 3 },
  { label: "Thu", value: 4 }, { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

export default function MenuSchedulePage() {
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [productId, setProductId] = useState("");
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("11:00");
  const [days, setDays] = useState<number[]>([0,1,2,3,4,5,6]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    if (!supabase) { setMessage("Supabase is not configured."); setLoading(false); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/auth?role=owner&next=/restaurant-admin/menu-schedule"); return; }

    const { data: profile, error: profileError } = await supabase
      .from("profiles").select("restaurant_id,role").eq("id", user.id).maybeSingle();
    if (profileError || !profile?.restaurant_id ||
      !["restaurant_owner", "admin"].includes(profile.role)) {
      setMessage("This account is not authorised to manage a restaurant menu.");
      setLoading(false); return;
    }

    setRestaurantId(profile.restaurant_id);
    const [productResult, scheduleResult] = await Promise.all([
      supabase.from("products").select("id,name,is_available")
        .eq("restaurant_id", profile.restaurant_id).order("name"),
      supabase.from("product_menu_schedules")
        .select("id,product_id,weekdays,starts_at,ends_at,is_enabled")
        .eq("restaurant_id", profile.restaurant_id)
        .order("starts_at"),
    ]);
    if (productResult.error || scheduleResult.error) {
      setMessage(productResult.error?.message ?? scheduleResult.error?.message ?? "Could not load schedules.");
    } else {
      setProducts(productResult.data ?? []);
      setSchedules((scheduleResult.data ?? []) as Schedule[]);
      if (!productId && productResult.data?.[0]) setProductId(productResult.data[0].id);
    }
    setLoading(false);
  }, [router, productId]);

  useEffect(() => { void load(); }, [load]);

  function toggleDay(day: number) {
    setDays((current) => current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort());
  }

  async function addSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !restaurantId || !productId || saving) return;
    if (days.length === 0 || start >= end) {
      setMessage("Choose at least one day. End time must be later than start time.");
      return;
    }
    setSaving(true); setMessage("");
    const { error } = await supabase.from("product_menu_schedules").insert({
      restaurant_id: restaurantId, product_id: productId,
      weekdays: days, starts_at: start, ends_at: end, is_enabled: true,
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Time window added.");
      await load();
    }
    setSaving(false);
  }

  async function removeSchedule(id: string) {
    if (!supabase || busyId) return;
    setBusyId(id); setMessage("");
    const { error } = await supabase.from("product_menu_schedules")
      .delete().eq("id", id).eq("restaurant_id", restaurantId);
    if (error) setMessage(error.message);
    else setSchedules((current) => current.filter((row) => row.id !== id));
    setBusyId("");
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Deleted product";

  return (
    <main className="container ta-manage-page" style={{ maxWidth: 1050 }}>
      <Link href="/restaurant-admin/products" className="ta-back-link">
        <ArrowLeft size={15} /> Product management
      </Link>
      <header className="ta-manage-heading">
        <div>
          <span className="ta-eyebrow">SMART MENU CONTROL</span>
          <h1>Time-based menu<span>.</span></h1>
          <p>Show each dish only during the days and hours you choose.</p>
        </div>
        <div className="ta-manage-heading-icon"><Clock3 size={27} /></div>
      </header>

      <div className="ta-manage-message" role="note">
        Times use India Standard Time (IST). Items without an active time window stay visible all day.
        Time windows must start and end on the same day.
      </div>
      {message && <div className="ta-manage-message" role="status">{message}</div>}

      <section className="ta-manage-panel" style={{ padding: 24, marginBottom: 24 }}>
        <div className="ta-panel-heading">
          <div><span className="ta-eyebrow">ADD AVAILABILITY</span><h2>Create a time window</h2></div>
          <div className="ta-panel-icon"><Plus size={20} /></div>
        </div>
        {loading ? <p>Loading menu…</p> : products.length === 0 ? (
          <p>Add products first, then create time windows for them.</p>
        ) : (
          <form onSubmit={addSchedule} className="ta-product-form">
            <label className="ta-field">Food item
              <select value={productId} onChange={(e) => setProductId(e.target.value)} required>
                {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </label>
            <div className="ta-form-row">
              <label className="ta-field">Available from
                <input type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
              </label>
              <label className="ta-field">Available until
                <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </label>
            </div>
            <fieldset className="ta-field" style={{ border: 0, padding: 0 }}>
              <legend>Days</legend>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {DAYS.map((day) => (
                  <label key={day.value} style={{ display: "flex", alignItems: "center", gap: 6, border: "1px solid #ddd", borderRadius: 20, padding: "8px 12px" }}>
                    <input type="checkbox" checked={days.includes(day.value)} onChange={() => toggleDay(day.value)} />
                    {day.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="ta-form-submit" disabled={saving || !productId}>
              {saving ? <LoaderCircle size={17} className="ta-refreshing" /> : <Plus size={17} />}
              {saving ? "Saving…" : "Add time window"}
            </button>
          </form>
        )}
      </section>

      <section className="ta-manage-panel" style={{ padding: 24 }}>
        <div className="ta-panel-heading">
          <div><span className="ta-eyebrow">CURRENT RULES</span><h2>Scheduled items</h2></div>
        </div>
        {loading ? <p>Loading schedules…</p> : schedules.length === 0 ? (
          <p>No time windows configured. All available products remain visible all day.</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {schedules.map((row) => (
              <article key={row.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, border: "1px solid #e7e7e2", borderRadius: 14, padding: 15 }}>
                <div>
                  <strong>{productName(row.product_id)}</strong>
                  <p style={{ color: "#777", fontSize: 13, marginTop: 5 }}>
                    {row.weekdays.map((day) => DAYS.find((item) => item.value === day)?.label).filter(Boolean).join(", ")}
                    {" · "}{String(row.starts_at).slice(0,5)}–{String(row.ends_at).slice(0,5)} IST
                  </p>
                </div>
                <button type="button" className="ta-delete-button" onClick={() => void removeSchedule(row.id)} disabled={busyId === row.id} aria-label="Delete time window">
                  {busyId === row.id ? <LoaderCircle size={15} className="ta-refreshing" /> : <Trash2 size={15} />}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
