
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, QrCode, Plus, Printer, ShieldAlert,
  Store, ExternalLink, Copy, Check, LoaderCircle,
  Bell, CheckCircle2, Clock3,
} from "lucide-react";

type RestaurantTable = {
  id: string;
  restaurant_id: string;
  table_code: string;
  is_active: boolean;
};

type TableNeed = {
  id: string;
  restaurant_id: string;
  table_id: string;
  table_code: string;
  need_type: string;
  message: string | null;
  status: string;
  created_at: string;
};

export default function QRPage() {
  const router = useRouter();

  const [rid, setRid] = useState("");
  const [slug, setSlug] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [needs, setNeeds] = useState<TableNeed[]>([]);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [updatingNeedId, setUpdatingNeedId] = useState("");
  const [qrEnabled, setQrEnabled] = useState(false);
  const [copiedId, setCopiedId] = useState("");

  const load = useCallback(async () => {
    if (!supabase) {
      setMsg("Supabase is not configured. Check your environment variables.");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/auth?role=owner&next=/restaurant-admin/qr");
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

      setRid(profile.restaurant_id);

      const { data: restaurant, error: restaurantError } = await supabase
        .from("restaurants")
        .select("name,slug,qr_enabled")
        .eq("id", profile.restaurant_id)
        .maybeSingle();

      if (restaurantError) throw restaurantError;
      if (!restaurant) throw new Error("Restaurant not found or access denied.");

      setRestaurantName(restaurant.name || "Your restaurant");
      setSlug(restaurant.slug || "");
      setQrEnabled(Boolean(restaurant.qr_enabled));

      const [tablesResult, needsResult] = await Promise.all([
        supabase
          .from("restaurant_tables")
          .select("*")
          .eq("restaurant_id", profile.restaurant_id)
          .order("table_code"),

        supabase
          .from("table_needs")
          .select("*")
          .eq("restaurant_id", profile.restaurant_id)
          .neq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      if (tablesResult.error) throw tablesResult.error;
      if (needsResult.error) throw needsResult.error;

      setTables((tablesResult.data || []) as RestaurantTable[]);
      setNeeds((needsResult.data || []) as TableNeed[]);
      setMsg("");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Unable to load QR tables.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

 
// Realtime: New table requests
useEffect(() => {
  const client = supabase;

  if (!client || !rid) return;

  const channel = client
    .channel(`qr-table-needs-${rid}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "table_needs",
        filter: `restaurant_id=eq.${rid}`,
      },
      () => {
        void load();
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}, [rid, load]);

  async function completeNeed(need: TableNeed) {
    if (!supabase || updatingNeedId) return;

    setUpdatingNeedId(need.id);

    const { error } = await supabase
      .from("table_needs")
      .update({ status: "completed" })
      .eq("id", need.id)
      .eq("restaurant_id", rid);

    if (error) {
      setMsg(`Could not complete request: ${error.message}`);
    } else {
      setNeeds((current) =>
        current.filter((item) => item.id !== need.id)
      );
    }

    setUpdatingNeedId("");
  }

  async function create() {
    if (!supabase || !rid || !code.trim() || saving) return;

    if (!qrEnabled) {
      setMsg("QR ordering is disabled for this restaurant.");
      return;
    }

    setSaving(true);
    setMsg("");

    const { error } = await supabase.from("restaurant_tables").insert({
      restaurant_id: rid,
      table_code: code.trim(),
      is_active: true,
    });

    if (error) {
      setMsg(`Could not create table: ${error.message}`);
    } else {
      setCode("");
      setMsg("Table created successfully.");
      await load();
    }

    setSaving(false);
  }

  async function toggle(table: RestaurantTable) {
    if (!supabase || busyId) return;

    setBusyId(table.id);
    setMsg("");

    const { error } = await supabase
      .from("restaurant_tables")
      .update({ is_active: !table.is_active })
      .eq("id", table.id)
      .eq("restaurant_id", rid);

    if (error) setMsg(error.message);
    else {
      setTables((current) =>
        current.map((item) =>
          item.id === table.id
            ? { ...item, is_active: !item.is_active }
            : item
        )
      );
    }

    setBusyId("");
  }

  function getUrl(table: RestaurantTable) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/qr/${slug}/${encodeURIComponent(table.table_code)}`;
  }

  function viewQr(table: RestaurantTable) {
    const menuUrl = getUrl(table);
    if (!menuUrl) return;

    const qrUrl = new URL("https://api.qrserver.com/v1/create-qr-code/");
    qrUrl.searchParams.set("size", "400x400");
    qrUrl.searchParams.set("margin", "12");
    qrUrl.searchParams.set("data", menuUrl);

    window.open(qrUrl.toString(), "_blank", "noopener,noreferrer");
  }

  async function copyLink(table: RestaurantTable) {
    try {
      await navigator.clipboard.writeText(getUrl(table));
      setCopiedId(table.id);
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      setMsg("Could not copy link. Open the table link and copy it manually.");
    }
  }

  const activeTables = tables.filter((table) => table.is_active).length;
  const pendingNeeds = needs.filter((need) => need.status !== "completed");

  return (
    <main className="container ta-manage-page ta-qr-page">
      <Link href="/restaurant-admin" className="ta-back-link">
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <header className="ta-manage-heading">
        <div>
          <span className="ta-eyebrow">DINE-IN EXPERIENCE</span>
          <h1>QR ordering<span>.</span></h1>
          <p>One table. One QR code. A simpler way to order.</p>
        </div>
        <div className="ta-manage-heading-icon"><QrCode size={29} /></div>
      </header>

      {msg && (
        <div className="ta-manage-message" role="status">
          {msg}
          <button onClick={() => setMsg("")} aria-label="Dismiss message">×</button>
        </div>
      )}

      {loading ? (
        <div className="ta-menu-empty">
          <LoaderCircle size={28} className="ta-refreshing" />
          <h3>Loading your tables...</h3>
        </div>
      ) : !rid ? (
        <section className="ta-qr-disabled">
          <ShieldAlert size={30} />
          <h2>Setup needed</h2>
          <p>{msg || "Your account is not linked to a restaurant."}</p>
          <Link href="/restaurant-admin" className="ta-form-submit">
            Back to dashboard
          </Link>
        </section>
      ) : (
        <>
          {/* TABLE NEEDS */}
          <section className="qr-needs-section">
            <div className="qr-needs-heading">
              <div>
                <span className="ta-eyebrow">CUSTOMER REQUESTS</span>
                <h2>Table needs<span>.</span></h2>
                <p>Requests sent by customers from their table QR menu.</p>
              </div>
              <div className="qr-needs-count">
                <Bell size={18} />
                <strong>{pendingNeeds.length}</strong>
              </div>
            </div>

            {pendingNeeds.length === 0 ? (
              <div className="qr-needs-empty">
                <CheckCircle2 size={27} />
                <strong>All caught up</strong>
                <p>No pending table requests.</p>
              </div>
            ) : (
              <div className="qr-needs-list">
                {pendingNeeds.map((need) => (
                  <article className="qr-need-card" key={need.id}>
                    <div className="qr-need-top">
                      <span className="qr-need-table">
                        <Store size={14} /> Table {need.table_code}
                      </span>
                      <span className="qr-need-pending">
                        <span /> Pending
                      </span>
                    </div>

                    <h3>{need.need_type}</h3>

                    {need.message && (
                      <p className="qr-need-message">{need.message}</p>
                    )}

                    <div className="qr-need-bottom">
                      <span className="qr-need-time">
                        <Clock3 size={13} />
                        {new Date(need.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>

                      <button
                        className="qr-need-complete"
                        disabled={updatingNeedId === need.id}
                        onClick={() => void completeNeed(need)}
                      >
                        {updatingNeedId === need.id ? (
                          <LoaderCircle size={15} className="ta-refreshing" />
                        ) : (
                          <CheckCircle2 size={15} />
                        )}
                        Completed
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="ta-qr-hero">
            <div className="ta-qr-hero-copy">
              <span className="ta-eyebrow">TABLE MANAGEMENT</span>
              <h2>Let customers order<br />right from their table.</h2>
              <p>Create a unique QR link for each table. Customers scan it to open your restaurant’s digital menu.</p>
              <span className={`ta-qr-enabled ${qrEnabled ? "enabled" : "disabled"}`}>
                <span />
                QR ordering {qrEnabled ? "enabled" : "disabled"}
              </span>
            </div>
            <div className="ta-qr-hero-art" aria-hidden="true">
              <div className="ta-qr-frame"><QrCode size={94} strokeWidth={1.2} /></div>
              <span className="ta-qr-art-caption">SCAN. BROWSE. ORDER.</span>
            </div>
          </section>

          <section className="ta-product-summary">
            <div><span>Total tables</span><strong>{tables.length}</strong></div>
            <div><span>Active tables</span><strong>{activeTables}</strong></div>
            <div><span>Inactive tables</span><strong>{tables.length - activeTables}</strong></div>
          </section>

          <section className="ta-manage-panel ta-create-table">
            <div className="ta-panel-heading">
              <div>
                <span className="ta-eyebrow">NEW TABLE</span>
                <h2>Create a table QR</h2>
              </div>
              <div className="ta-panel-icon"><Plus size={20} /></div>
            </div>

            <p className="ta-create-description">Add a unique table name, such as Table-01 or Window-02.</p>

            <form
              className="ta-create-table-form"
              onSubmit={(event) => {
                event.preventDefault();
                void create();
              }}
            >
              <label className="ta-field">
                Table name or code
                <input
                  required
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="e.g. Table-01"
                  maxLength={60}
                />
              </label>

              <button className="ta-form-submit" disabled={saving || !code.trim() || !qrEnabled}>
                {saving ? <LoaderCircle size={16} className="ta-refreshing" /> : <Plus size={16} />}
                {saving ? "Creating..." : "Create table"}
              </button>
            </form>

            {!qrEnabled && (
              <p className="ta-qr-warning">
                QR ordering is disabled for this restaurant. Enable <code>qr_enabled</code> before creating tables.
              </p>
            )}
          </section>

          <section className="ta-qr-tables-section">
            <div className="ta-menu-heading">
              <div>
                <span className="ta-eyebrow">YOUR RESTAURANT</span>
                <h2>{restaurantName}<span> · {tables.length} tables</span></h2>
              </div>
              <button className="ta-refresh-button" onClick={() => void load()}>
                <Store size={15} /> Refresh
              </button>
            </div>

            {tables.length === 0 ? (
              <div className="ta-menu-empty">
                <QrCode size={32} />
                <h3>No tables created yet.</h3>
                <p>Create your first table above to start preparing QR links.</p>
              </div>
            ) : (
              <div className="ta-qr-grid">
                {tables.map((table) => (
                  <article className="ta-qr-card" key={table.id}>
                    <div className="ta-qr-card-top">
                      <div className="ta-qr-card-icon"><QrCode size={24} /></div>
                      <span className={`ta-product-status ${table.is_active ? "available" : "unavailable"}`}>
                        <span />{table.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <span className="ta-eyebrow">TABLE CODE</span>
                    <h3>{table.table_code}</h3>
                    <p className="ta-qr-card-description">Scan this table’s QR code to open the linked menu.</p>

                    <div className="ta-qr-link-box">
                      <span>{getUrl(table)}</span>
                      <button onClick={() => void copyLink(table)} aria-label={`Copy ${table.table_code} link`}>
                        {copiedId === table.id ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>

                    <div className="ta-qr-actions">
                      <button
                        className="ta-availability-button"
                        disabled={busyId === table.id}
                        onClick={() => void toggle(table)}
                      >
                        {busyId === table.id ? <LoaderCircle size={14} className="ta-refreshing" /> : table.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        className="ta-qr-open-button"
                        disabled={!table.is_active || !qrEnabled}
                        onClick={() => viewQr(table)}
                      >
                        <ExternalLink size={14} /> View QR
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="ta-qr-print-note">
            <Printer size={17} />
            <div>
              <strong>Ready to print your QR codes?</strong>
              <p>Open each active QR code and print the QR image for the corresponding table.</p>
            </div>
            <button onClick={() => window.print()}><Printer size={15} /> Print page</button>
          </div>
        </>
      )}

      <style jsx>{`
        .qr-needs-section {
          margin: 28px 0;
          padding: 22px;
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 18px;
          color: #111;
        }
        .qr-needs-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }
        .qr-needs-heading h2 {
          margin: 7px 0;
          font-size: 25px;
          letter-spacing: -1px;
        }
        .qr-needs-heading h2 span { color: #777; }
        .qr-needs-heading p { margin: 0; color: #777; font-size: 13px; }
        .qr-needs-count {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 12px 16px;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
        }
        .qr-needs-count strong { font-size: 20px; }
        .qr-needs-list { display: grid; gap: 12px; }
        .qr-need-card {
          padding: 17px;
          border: 1px solid #e9e9e9;
          border-radius: 14px;
          background: #fff;
        }
        .qr-need-top, .qr-need-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        .qr-need-table {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12px;
          font-weight: 700;
        }
        .qr-need-pending {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #8a5a00;
          font-size: 11px;
          font-weight: 700;
        }
        .qr-need-pending span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #d99a22;
        }
        .qr-need-card h3 { margin: 14px 0 5px; font-size: 17px; }
        .qr-need-message { margin: 0 0 15px; color: #666; font-size: 13px; white-space: pre-wrap; }
        .qr-need-time {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: #777;
          font-size: 11px;
        }
        .qr-need-complete {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 10px 14px;
          border: 0;
          border-radius: 9px;
          background: #111;
          color: white;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
        }
        .qr-need-complete:disabled { opacity: .5; cursor: wait; }
        .qr-needs-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 30px 12px;
          color: #555;
          text-align: center;
        }
        .qr-needs-empty strong { color: #111; }
        .qr-needs-empty p { margin: 0; font-size: 13px; }
        @media (max-width: 520px) {
          .qr-needs-section { padding: 16px; }
          .qr-needs-heading h2 { font-size: 21px; }
          .qr-need-bottom { align-items: flex-start; flex-direction: column; }
          .qr-need-complete { width: 100%; }
        }
      `}</style>
    </main>
  );
}
