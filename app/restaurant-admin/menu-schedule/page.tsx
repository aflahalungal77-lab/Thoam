"use client";

import { useLanguage } from "@/components/LanguageProvider";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CalendarDays, Check, Clock3, LoaderCircle, Pencil,
  Plus, Power, RefreshCw, Search, Trash2, X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Product = { id: string; name: string; is_available: boolean };
type Schedule = {
  id: string;
  product_id: string;
  weekdays: number[];
  starts_at: string;
  ends_at: string;
  is_enabled: boolean;
};

const DAYS = [
  { label: "Sun", value: 0 }, { label: "Mon", value: 1 },
  { label: "Tue", value: 2 }, { label: "Wed", value: 3 },
  { label: "Thu", value: 4 }, { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
];

function indiaClock() {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit",
    minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { weekday: days[values.weekday] ?? 0, time: `${values.hour}:${values.minute}` };
}

const hhmm = (value: string) => String(value || "").slice(0, 5);

export default function MenuSchedulePage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [restaurantId, setRestaurantId] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [productId, setProductId] = useState("");
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("11:00");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [enabled, setEnabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [clock, setClock] = useState({ weekday: -1, time: "--:--" });

  const load = useCallback(async () => {
    if (!supabase) {
      setMessageType("error");
      setMessage("Supabase is not configured. Check the application environment.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.replace("/auth?role=owner&next=/restaurant-admin/menu-schedule");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles").select("restaurant_id,role").eq("id", user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!profile?.restaurant_id || !["restaurant_owner", "admin"].includes(profile.role)) {
        setMessageType("error");
        setMessage("This account is not authorised to manage a restaurant menu.");
        return;
      }

      const rid = profile.restaurant_id as string;
      setRestaurantId(rid);
      const [
        { data: restaurant, error: restaurantError },
        { data: productRows, error: productError },
        { data: scheduleRows, error: scheduleError },
      ] = await Promise.all([
        supabase.from("restaurants").select("name").eq("id", rid).maybeSingle(),
        supabase.from("products").select("id,name,is_available").eq("restaurant_id", rid).order("name"),
        supabase.from("product_menu_schedules")
          .select("id,product_id,weekdays,starts_at,ends_at,is_enabled")
          .eq("restaurant_id", rid).order("starts_at"),
      ]);
      if (restaurantError) throw restaurantError;
      if (productError) throw productError;
      if (scheduleError) throw scheduleError;

      const nextProducts = (productRows || []) as Product[];
      setRestaurantName(restaurant?.name || "Your restaurant");
      setProducts(nextProducts);
      setSchedules((scheduleRows || []) as Schedule[]);
      setProductId((current) =>
        current && nextProducts.some((product) => product.id === current)
          ? current : nextProducts[0]?.id || ""
      );
    } catch (error) {
      console.error("Menu schedule load failed:", error);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not load menu schedules.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refreshClock = () => setClock(indiaClock());
    refreshClock();
    const timer = window.setInterval(refreshClock, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleSchedules = useMemo(() => {
    const query = search.trim().toLowerCase();
    return schedules.filter((row) =>
      !query || (products.find((p) => p.id === row.product_id)?.name || "Deleted product")
        .toLowerCase().includes(query)
    );
  }, [schedules, products, search]);

  const activeCount = schedules.filter((row) => row.is_enabled).length;
  const pausedCount = schedules.length - activeCount;

  function resetForm() {
    setEditingId(null);
    setStart("07:00");
    setEnd("11:00");
    setDays([0, 1, 2, 3, 4, 5, 6]);
    setEnabled(true);
    setMessage("");
  }

  function toggleDay(day: number) {
    setDays((current) => current.includes(day)
      ? current.filter((value) => value !== day)
      : [...current, day].sort((a, b) => a - b));
  }

  function edit(row: Schedule) {
    setEditingId(row.id);
    setProductId(row.product_id);
    setStart(hhmm(row.starts_at));
    setEnd(hhmm(row.ends_at));
    setDays(row.weekdays || []);
    setEnabled(row.is_enabled);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || !restaurantId || !productId || saving) return;
    if (!days.length) {
      setMessageType("error"); setMessage("Select at least one serving day."); return;
    }
    const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!validTime(start) || !validTime(end) || start >= end) {
      setMessageType("error");
      setMessage("Choose a valid time range. End time must be later than start time.");
      return;
    }

    if (enabled) {
      const overlap = schedules.some((row) => {
        if (row.id === editingId || row.product_id !== productId || !row.is_enabled) return false;
        const sameDay = (row.weekdays || []).some((day) => days.includes(day));
        return sameDay && start < hhmm(row.ends_at) && hhmm(row.starts_at) < end;
      });
      if (overlap) {
        setMessageType("error");
        setMessage("This product already has an overlapping enabled schedule on one or more selected days.");
        return;
      }
    }

    setSaving(true); setMessage("");
    try {
      const values = {
        restaurant_id: restaurantId, product_id: productId, weekdays: days,
        starts_at: start, ends_at: end, is_enabled: enabled,
        updated_at: new Date().toISOString(),
      };
      const result = editingId
        ? await supabase.from("product_menu_schedules").update(values)
            .eq("id", editingId).eq("restaurant_id", restaurantId)
        : await supabase.from("product_menu_schedules").insert(values);
      if (result.error) throw result.error;
      const successMessage = editingId ? "Schedule updated successfully." : "Schedule created successfully.";
      resetForm();
      await load();
      setMessageType("success");
      setMessage(successMessage);
    } catch (error) {
      console.error("Menu schedule save failed:", error);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not save this schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: Schedule) {
    if (!supabase || busyId) return;
    setBusyId(row.id); setMessage("");
    try {
      const { error } = await supabase.from("product_menu_schedules")
        .update({ is_enabled: !row.is_enabled, updated_at: new Date().toISOString() })
        .eq("id", row.id).eq("restaurant_id", restaurantId);
      if (error) throw error;
      setSchedules((current) => current.map((item) =>
        item.id === row.id ? { ...item, is_enabled: !item.is_enabled } : item
      ));
      setMessageType("success");
      setMessage(row.is_enabled ? "Schedule paused." : "Schedule activated.");
    } catch (error) {
      console.error("Menu schedule status update failed:", error);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not update schedule status.");
    } finally { setBusyId(""); }
  }

  async function remove(row: Schedule) {
    if (!supabase || busyId) return;
    const name = products.find((p) => p.id === row.product_id)?.name || "this product";
    if (!window.confirm(`Delete the serving schedule for "${name}"?`)) return;
    setBusyId(row.id); setMessage("");
    try {
      const { error } = await supabase.from("product_menu_schedules")
        .delete().eq("id", row.id).eq("restaurant_id", restaurantId);
      if (error) throw error;
      setSchedules((current) => current.filter((item) => item.id !== row.id));
      if (editingId === row.id) resetForm();
      setMessageType("success");
      setMessage("Schedule deleted. The product will follow its normal availability settings.");
    } catch (error) {
      console.error("Menu schedule delete failed:", error);
      setMessageType("error");
      setMessage(error instanceof Error ? error.message : "Could not delete this schedule.");
    } finally { setBusyId(""); }
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name || "Deleted product";
  const isLive = (row: Schedule) => row.is_enabled &&
    (row.weekdays || []).includes(clock.weekday) &&
    clock.time >= hhmm(row.starts_at) && clock.time < hhmm(row.ends_at);
  const dayLabels = (values: number[]) => DAYS.filter((day) => values.includes(day.value))
    .map((day) => day.label).join(" · ");

  return (
    <main className="ms-page">
      <div className="ms-shell">
        <Link href="/restaurant-admin" className="ms-back"><ArrowLeft size={16} /> {t("Dashboard")}</Link>

        <header className="ms-header">
          <div>
            <span className="ms-eyebrow">{t("THO’AM · SMART MENU CONTROL")}</span>
            <h1>{t("Menu")} <span>{t("Schedule")}.</span></h1>
            <p>{t("Control exactly when each dish appears on your restaurant menu.")}</p>
            <div className="ms-clock"><span /> {t("India Standard Time")} <strong>{clock.time} IST</strong></div>
          </div>
          <div className="ms-header-icon"><CalendarDays size={28} /></div>
        </header>

        {message && (
          <div className={`ms-alert ${messageType === "error" ? "is-error" : "is-success"}`} role="status">
            {messageType === "error" ? <X size={17} /> : <Check size={17} />}
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")} aria-label="Dismiss message"><X size={16} /></button>
          </div>
        )}

        <section className="ms-stats">
          <article><span>{t("Total schedules")}</span><strong>{schedules.length}</strong><small>{t("Across your menu")}</small></article>
          <article><span>{t("Enabled rules")}</span><strong>{activeCount}</strong><small>{t("Automatically applied")}</small></article>
          <article><span>{t("Paused rules")}</span><strong>{pausedCount}</strong><small>{t("Not affecting visibility")}</small></article>
        </section>

        <section className="ms-layout">
          <div className="ms-panel ms-editor">
            <div className="ms-panel-heading">
              <div><span className="ms-eyebrow">{editingId ? t("UPDATE RULE") : t("CREATE A RULE")}</span><h2>{editingId ? t("Edit schedule") : t("New time window")}</h2></div>
              <span className="ms-heading-icon"><Clock3 size={20} /></span>
            </div>

            {loading ? (
              <div className="ms-loading"><LoaderCircle size={21} /> {t("Loading restaurant settings…")}</div>
            ) : products.length === 0 ? (
              <div className="ms-empty-editor">
                <CalendarDays size={27} /><strong>{t("Add products first")}</strong>
                <p>Your dishes will appear here after you add them to {restaurantName}.</p>
                <Link href="/restaurant-admin/products">{t("Open product management")}</Link>
              </div>
            ) : (
              <form onSubmit={save} className="ms-form">
                <label className="ms-field"><span>{t("Food item")}</span>
                  <select value={productId} onChange={(event) => setProductId(event.target.value)} required>
                    {products.map((product) => <option key={product.id} value={product.id}>
                      {product.name}{product.is_available ? "" : " · Hidden in product settings"}
                    </option>)}
                  </select>
                  <small>Choose the product this serving window controls.</small>
                </label>

                <div className="ms-time-grid">
                  <label className="ms-field"><span>{t("Available from")}</span>
                    <input type="time" value={start} onChange={(event) => setStart(event.target.value)} required />
                  </label>
                  <label className="ms-field"><span>{t("Available until")}</span>
                    <input type="time" value={end} onChange={(event) => setEnd(event.target.value)} required />
                  </label>
                </div>

                <fieldset className="ms-days"><legend>{t("Serving days")}</legend>
                  <p>{t("Select the days when this time window should apply.")}</p>
                  <div className="ms-day-grid">
                    {DAYS.map((day) => <button type="button" key={day.value}
                      className={days.includes(day.value) ? "ms-day is-selected" : "ms-day"}
                      onClick={() => toggleDay(day.value)} aria-pressed={days.includes(day.value)}>
                      {days.includes(day.value) && <Check size={12} />}{day.label}
                    </button>)}
                  </div>
                </fieldset>

                <label className="ms-enable">
                  <span className="ms-enable-icon"><Power size={17} /></span>
                  <span><strong>{t("Enable this schedule")}</strong><small>{t("Enabled schedules control customer menu visibility.")}</small></span>
                  <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
                </label>

                <div className="ms-actions">
                  {editingId && <button type="button" className="ms-button ms-quiet" onClick={resetForm}><X size={16} /> {t("Cancel")}</button>}
                  <button type="submit" className="ms-button ms-primary" disabled={saving || !productId}>
                    {saving ? <LoaderCircle size={17} className="ms-spin" /> : editingId ? <Check size={17} /> : <Plus size={17} />}
                    {saving ? "Saving…" : editingId ? "Save changes" : "Create schedule"}
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="ms-panel ms-rules">
            <div className="ms-rules-heading">
              <div><span className="ms-eyebrow">YOUR RESTAURANT · {restaurantName.toUpperCase()}</span>
                <h2>{t("Serving rules")}</h2>
                <p>{t("Products without an enabled schedule stay visible all day when product availability is on.")}</p>
              </div>
              <button type="button" className="ms-refresh" onClick={() => void load()} disabled={loading} aria-label="Refresh schedules"><RefreshCw size={17} className={loading ? "ms-spin" : ""} /></button>
            </div>

            <label className="ms-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search scheduled products…")} /></label>

            {loading ? <div className="ms-loading"><LoaderCircle size={21} /> {t("Loading schedules…")}</div> :
              visibleSchedules.length === 0 ? (
                <div className="ms-empty-rules"><div className="ms-empty-icon"><CalendarDays size={25} /></div>
                  <h3>{schedules.length ? t("No matching schedules") : t("Your schedule is clear")}</h3>
                  <p>{schedules.length ? t("Try another product name.") : t("Create your first time window. Until then, all available products stay visible throughout the day.")}</p>
                  {!schedules.length && <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>{t("Create first schedule")} <Plus size={15} /></button>}
                </div>
              ) : (
                <div className="ms-rule-list">
                  {visibleSchedules.map((row) => {
                    const live = isLive(row);
                    return <article className={row.is_enabled ? "ms-rule" : "ms-rule is-paused"} key={row.id}>
                      <div className="ms-rule-main">
                        <div className="ms-rule-title">
                          <h3>{productName(row.product_id)}</h3>
                          <span className={row.is_enabled ? (live ? "ms-status is-live" : "ms-status is-enabled") : "ms-status is-paused"}>
                            <span />{row.is_enabled ? (live ? t("Live now") : t("Enabled")) : t("Paused")}
                          </span>
                        </div>
                        <div className="ms-rule-time"><Clock3 size={15} /><strong>{hhmm(row.starts_at)} – {hhmm(row.ends_at)}</strong><span>IST</span></div>
                        <div className="ms-rule-days"><CalendarDays size={14} /> {dayLabels(row.weekdays || []) || t("No days selected")}</div>
                      </div>
                      <div className="ms-rule-actions">
                        <button type="button" className="ms-icon-button" onClick={() => edit(row)} aria-label={`Edit ${productName(row.product_id)} schedule`} title={t("Edit")}><Pencil size={16} /></button>
                        <button type="button" className="ms-icon-button" onClick={() => void toggle(row)} disabled={busyId === row.id} aria-label={row.is_enabled ? t("Pause schedule") : t("Enable schedule")} title={row.is_enabled ? "Pause" : "Enable"}>{busyId === row.id ? <LoaderCircle size={16} className="ms-spin" /> : <Power size={16} />}</button>
                        <button type="button" className="ms-icon-button ms-delete" onClick={() => void remove(row)} disabled={busyId === row.id} aria-label={`Delete ${productName(row.product_id)} schedule`} title={t("Delete")}>{busyId === row.id ? <LoaderCircle size={16} className="ms-spin" /> : <Trash2 size={16} />}</button>
                      </div>
                    </article>;
                  })}
                </div>
              )}
          </div>
        </section>

        <footer className="ms-footer"><span><strong>THO’AM.</strong> {t("Smart menu operations")}</span><span>{t("Schedule timezone · Asia/Kolkata")}</span></footer>
      </div>

      <style jsx>{`
        .ms-page{min-height:100vh;background:#f6f6f3;color:#171717;padding:34px 24px 60px}
        .ms-shell{width:min(1240px,100%);margin:0 auto}
        .ms-back{display:inline-flex;align-items:center;gap:8px;color:#65655f;text-decoration:none;font-size:13px;font-weight:650;margin-bottom:26px}
        .ms-back:hover{color:#111}
        .ms-header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:8px 0 26px}
        .ms-eyebrow{display:block;color:#888880;font-size:10px;font-weight:800;letter-spacing:1.8px}
        .ms-header h1{margin:10px 0 8px;font-size:clamp(32px,5vw,48px);line-height:1.04;letter-spacing:-2.4px;font-weight:850}
        .ms-header h1 span{color:#77776f}
        .ms-header p{margin:0;color:#777770;font-size:14px;line-height:1.6}
        .ms-header-icon{width:64px;height:64px;display:grid;place-items:center;border:1px solid #e2e2dc;border-radius:20px;background:#fff;box-shadow:0 8px 28px #00000008}
        .ms-clock{display:inline-flex;align-items:center;gap:8px;margin-top:17px;padding:8px 11px;border:1px solid #e6e6df;border-radius:30px;background:#fff;color:#66665f;font-size:11px}
        .ms-clock>span,.ms-status>span{width:7px;height:7px;border-radius:50%;background:#23845d;display:inline-block;box-shadow:0 0 0 3px #e2f2e9}
        .ms-clock strong{color:#171717;margin-left:3px}
        .ms-alert{display:flex;align-items:center;gap:10px;padding:13px 15px;border:1px solid #d8e8dd;border-radius:13px;background:#f5fbf6;color:#245b38;font-size:13px;margin:0 0 18px}
        .ms-alert.is-error{border-color:#efd5d3;background:#fff8f7;color:#9a302b}
        .ms-alert span{flex:1}.ms-alert button{display:grid;place-items:center;border:0;background:transparent;color:inherit;cursor:pointer}
        .ms-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}
        .ms-stats article{padding:18px 20px;border:1px solid #e8e8e2;border-radius:16px;background:#fff;box-shadow:0 3px 12px #00000006}
        .ms-stats article span{display:block;color:#77776f;font-size:12px;font-weight:600}
        .ms-stats article strong{display:block;margin-top:8px;font-size:28px;line-height:1;font-weight:850;letter-spacing:-1px}
        .ms-stats article small{display:block;margin-top:8px;color:#a09f98;font-size:10px}
        .ms-layout{display:grid;grid-template-columns:minmax(300px,.82fr) minmax(0,1.35fr);gap:18px;align-items:start}
        .ms-panel{border:1px solid #e8e8e2;border-radius:18px;background:#fff;box-shadow:0 5px 22px #00000006;min-width:0}
        .ms-editor,.ms-rules{padding:23px}
        .ms-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:22px}
        .ms-panel-heading h2,.ms-rules-heading h2{margin:6px 0 0;font-size:21px;letter-spacing:-.7px;font-weight:800}
        .ms-heading-icon{width:42px;height:42px;display:grid;place-items:center;border:1px solid #ecece7;border-radius:13px;background:#f8f8f5;color:#333}
        .ms-form{display:grid;gap:18px}.ms-field{display:grid;gap:8px;min-width:0}
        .ms-field>span,.ms-days legend{font-size:12px;font-weight:750;color:#34342f}
        .ms-field small{font-size:10px;color:#999990;line-height:1.5}
        .ms-field select,.ms-field input{width:100%;height:46px;padding:0 12px;border:1px solid #e3e3dd;border-radius:10px;background:#fff;color:#171717;font:inherit;font-size:13px;outline:none}
        .ms-field select:focus,.ms-field input:focus{border-color:#77776f;box-shadow:0 0 0 3px #0000000b}
        .ms-time-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        .ms-days{border:0;padding:0;margin:0;min-width:0}.ms-days legend{padding:0}
        .ms-days p{margin:6px 0 12px;color:#999990;font-size:10px}
        .ms-day-grid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
        .ms-day{height:38px;display:flex;align-items:center;justify-content:center;gap:3px;padding:0 3px;border:1px solid #e7e7e1;border-radius:9px;background:#fff;color:#66665f;font-size:10px;font-weight:700;cursor:pointer}
        .ms-day.is-selected{border-color:#191919;background:#191919;color:#fff}
        .ms-enable{display:flex;align-items:center;gap:11px;padding:13px;border:1px solid #e9e9e3;border-radius:12px;background:#fafaf8;cursor:pointer}
        .ms-enable-icon{width:34px;height:34px;display:grid;place-items:center;border:1px solid #e6e6df;border-radius:10px;background:#fff}
        .ms-enable>span:nth-child(2){flex:1;display:grid;gap:4px}.ms-enable strong{font-size:11px}.ms-enable small{font-size:9px;color:#999990}
        .ms-enable input{width:17px;height:17px;accent-color:#171717}
        .ms-actions{display:flex;justify-content:flex-end;gap:9px}
        .ms-button{min-height:43px;display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:0 15px;border:1px solid #e3e3dd;border-radius:10px;font-size:12px;font-weight:750;cursor:pointer}
        .ms-button:disabled{opacity:.55;cursor:not-allowed}.ms-primary{border-color:#171717;background:#171717;color:#fff}.ms-primary:hover:not(:disabled){background:#383832}.ms-quiet{background:#fff;color:#555}
        .ms-empty-editor{display:grid;justify-items:start;gap:10px;padding:20px 0;color:#777}.ms-empty-editor strong{color:#222;font-size:14px}.ms-empty-editor p{margin:0;font-size:12px;line-height:1.6}.ms-empty-editor a{color:#171717;font-size:12px;font-weight:750}
        .ms-rules-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:18px}
        .ms-rules-heading p{max-width:520px;margin:7px 0 0;color:#898980;font-size:11px;line-height:1.55}
        .ms-refresh{width:38px;height:38px;display:grid;place-items:center;flex-shrink:0;border:1px solid #e8e8e2;border-radius:11px;background:#fff;color:#444;cursor:pointer}
        .ms-refresh:disabled{opacity:.5}
        .ms-search{height:43px;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid #e7e7e1;border-radius:10px;color:#888;margin-bottom:14px}
        .ms-search input{width:100%;height:100%;border:0;outline:0;background:transparent;color:#171717;font:inherit;font-size:12px}
        .ms-rule-list{display:grid;gap:10px}.ms-rule{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px;border:1px solid #eaeae4;border-radius:13px;background:#fff}
        .ms-rule.is-paused{background:#fafaf8}.ms-rule-main{min-width:0;flex:1}
        .ms-rule-title{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.ms-rule-title h3{margin:0;color:#20201c;font-size:13px;font-weight:800;overflow-wrap:anywhere}
        .ms-status{display:inline-flex;align-items:center;gap:6px;padding:4px 7px;border:1px solid #e8e8e2;border-radius:20px;color:#777;font-size:9px;font-weight:750;white-space:nowrap}
        .ms-status>span{width:6px;height:6px;background:#aaa;box-shadow:none}.ms-status.is-live{border-color:#cde8d7;background:#f2fbf5;color:#276341}.ms-status.is-live>span{background:#23845d}
        .ms-status.is-enabled{background:#f7f7f4;color:#555}.ms-status.is-enabled>span{background:#777}.ms-status.is-paused{background:#f5f5f2;color:#999}
        .ms-rule-time{display:flex;align-items:center;gap:7px;margin-top:10px;color:#66665f;font-size:11px}.ms-rule-time strong{color:#222;font-size:12px}.ms-rule-time span{color:#999;font-size:9px}
        .ms-rule-days{display:flex;align-items:center;gap:7px;margin-top:7px;color:#92928a;font-size:10px}
        .ms-rule-actions{display:flex;gap:5px;flex-shrink:0}.ms-icon-button{width:34px;height:34px;display:grid;place-items:center;border:1px solid #e9e9e3;border-radius:9px;background:#fff;color:#555;cursor:pointer}
        .ms-icon-button:hover:not(:disabled){border-color:#bdbdb4;background:#f8f8f5;color:#111}.ms-icon-button:disabled{opacity:.5;cursor:wait}.ms-delete:hover:not(:disabled){border-color:#e5c7c4;background:#fff8f7;color:#a4312b}
        .ms-empty-rules{display:grid;justify-items:center;text-align:center;padding:42px 18px}.ms-empty-icon{width:54px;height:54px;display:grid;place-items:center;border:1px solid #e9e9e3;border-radius:16px;background:#fafaf8;color:#555}
        .ms-empty-rules h3{margin:15px 0 6px;font-size:15px}.ms-empty-rules p{max-width:360px;margin:0;color:#8c8c84;font-size:11px;line-height:1.65}
        .ms-empty-rules button{display:inline-flex;align-items:center;gap:7px;margin-top:16px;padding:9px 12px;border:1px solid #ddd;background:#fff;border-radius:9px;color:#222;font-size:11px;font-weight:750;cursor:pointer}
        .ms-loading{display:flex;align-items:center;gap:10px;padding:26px 4px;color:#777;font-size:12px}
        .ms-spin{animation:ms-spin 1s linear infinite}@keyframes ms-spin{to{transform:rotate(360deg)}}
        .ms-footer{display:flex;justify-content:space-between;gap:12px;padding:20px 2px;color:#999990;font-size:10px}.ms-footer strong{color:#333}
        @media(max-width:900px){.ms-layout{grid-template-columns:1fr}}
        @media(max-width:600px){.ms-page{padding:22px 14px 40px}.ms-back{margin-bottom:18px}.ms-header{align-items:flex-start;padding-bottom:20px}.ms-header-icon{width:48px;height:48px;border-radius:15px}.ms-header h1{font-size:34px;letter-spacing:-1.7px}.ms-header p{font-size:12px}.ms-stats{gap:8px}.ms-stats article{padding:13px 11px;border-radius:12px}.ms-stats article span{font-size:10px}.ms-stats article strong{font-size:23px}.ms-stats article small{font-size:9px}.ms-editor,.ms-rules{padding:16px;border-radius:15px}.ms-day-grid{gap:4px}.ms-day{height:35px;font-size:9px}.ms-rule{align-items:flex-start;padding:12px;gap:8px}.ms-rule-actions{gap:4px}.ms-icon-button{width:31px;height:31px}.ms-footer{flex-direction:column}.ms-alert{align-items:flex-start}}
        @media(prefers-reduced-motion:reduce){.ms-spin{animation:none}}
      `}</style>
    </main>
  );
}
