
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ShieldCheck,
  Store,
  Package,
  ClipboardList,
  LogOut,
  Trash2,
  TrendingUp,
  IndianRupee,
  Users,
  RefreshCw,
} from "lucide-react";

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  area: string | null;
  city: string | null;
  status: string;
  created_at: string;
  qr_enabled: boolean;
};

type Order = {
  id: string;
  order_number: string | null;
  restaurant_id: string;
  status: string;
  total_amount: number | string;
  created_at: string;
  order_type: string;
  payment_status: string;
};

const COMMISSION_RATE = 0.10;

function isDelivered(status: string) {
  const value = status?.toLowerCase();
  return value === "delivered" || value === "completed";
}

function isToday(date: string) {
  if (!date) return false;

  const orderDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date(date));

  const todayDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
  }).format(new Date());

  return orderDay === todayDay;
}

function money(amount: number) {
  return `₹${amount.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [stats, setStats] = useState({
    restaurants: 0,
    products: 0,
    orders: 0,
    customers: 0,
    today: 0,
    totalRevenue: 0,
    todayRevenue: 0,
    todayCommission: 0,
  });

  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);

  async function load() {
    if (!supabase) {
      setMsg("Supabase is not configured.");
      setLoading(false);
      return;
    }

    setRefreshing(true);
    setMsg("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/auth?next=/thoam-admin");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.role !== "admin") {
        setMsg(
          "Access denied. This account does not have the Tho'am admin role."
        );
        return;
      }

      const [restaurantResult, productResult, customerResult] =
        await Promise.all([
          supabase
            .from("restaurants")
            .select(
              "id,name,slug,area,city,status,created_at,qr_enabled"
            )
            .order("created_at", { ascending: false }),

          supabase.from("products").select("id,restaurant_id"),

          supabase.from("profiles").select("id,role"),
        ]);

      if (restaurantResult.error) throw restaurantResult.error;
      if (productResult.error) throw productResult.error;
      if (customerResult.error) throw customerResult.error;

      const allRestaurants = (restaurantResult.data ||
        []) as Restaurant[];

      // Fetch every order in pages.
      const fetchedOrders: Order[] = [];
      const pageSize = 1000;
      let from = 0;

      while (true) {
        const { data, error } = await supabase
          .from("orders")
          .select(
            "id,order_number,restaurant_id,status,total_amount,created_at,order_type,payment_status"
          )
          .order("created_at", { ascending: false })
          .range(from, from + pageSize - 1);

        if (error) throw error;

        const page = (data || []) as Order[];

        fetchedOrders.push(...page);

        if (page.length < pageSize) break;

        from += pageSize;
      }

      const deliveredOrders = fetchedOrders.filter((order) =>
        isDelivered(order.status)
      );

      const todayOrders = fetchedOrders.filter((order) =>
        isToday(order.created_at)
      );

      const todayDeliveredOrders = todayOrders.filter((order) =>
        isDelivered(order.status)
      );

      const totalRevenue = deliveredOrders.reduce(
        (sum, order) => sum + Number(order.total_amount || 0),
        0
      );

      const todayRevenue = todayDeliveredOrders.reduce(
        (sum, order) => sum + Number(order.total_amount || 0),
        0
      );

      setRestaurants(allRestaurants);
      setAllOrders(fetchedOrders);
      setOrders(fetchedOrders.slice(0, 100));

      setStats({
        restaurants: allRestaurants.length,
        products: productResult.data?.length || 0,
        orders: fetchedOrders.length,
        customers:
          customerResult.data?.filter(
            (profile) => profile.role === "customer"
          ).length || 0,
        today: todayOrders.length,
        totalRevenue,
        todayRevenue,
        todayCommission: todayRevenue * COMMISSION_RATE,
      });
    } catch (error: any) {
      setMsg(error?.message || "Unable to load platform data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function updateRestaurant(id: string, status: string) {
    if (!supabase) return;

    const { error } = await supabase
      .from("restaurants")
      .update({ status })
      .eq("id", id);

    if (error) {
      setMsg(error.message);
    } else {
      await load();
    }
  }

  async function removeRestaurant(r: Restaurant) {
    if (!supabase) return;

    const confirmed = confirm(
      `Permanently delete "${r.name}"?\n\nThis cannot be undone. Historical orders or related products may prevent deletion if your database has foreign-key restrictions.\n\nContinue?`
    );

    if (!confirmed) return;

    setDeletingId(r.id);
    setMsg("");

    try {
      const { error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", r.id);

      if (error) throw error;

      await load();
    } catch (error: any) {
      setMsg(
        error?.message ||
          "Could not delete this restaurant. Check related database records."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function signout() {
    await supabase?.auth.signOut();
    router.push("/");
  }

  // Restaurant-wise revenue from all fetched orders.
  function getRestaurantRevenue(restaurantId: string) {
    const restaurantOrders = allOrders.filter(
      (order) =>
        order.restaurant_id === restaurantId &&
        isDelivered(order.status)
    );

    const total = restaurantOrders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0
    );

    const today = restaurantOrders
      .filter((order) => isToday(order.created_at))
      .reduce(
        (sum, order) => sum + Number(order.total_amount || 0),
        0
      );

    return {
      total,
      today,
      commission: today * COMMISSION_RATE,
    };
  }

  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/">
          Tho<span>’</span>am<span className="wordmark-dot">.</span>
        </Link>

        <span className="status">SUPER ADMIN</span>

        <div className="header-actions">
          <button
            className="admin-refresh"
            onClick={load}
            disabled={refreshing}
            title="Refresh dashboard"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "spinning" : ""}
            />
          </button>

          <button
            className="button button-light small"
            onClick={signout}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main className="container admin-container">
        <div className="page-head admin-page-head">
          <div className="eyebrow">PLATFORM OPERATIONS</div>
          <h1>Tho'am control centre.</h1>
          <p className="muted">
            Manage restaurant partners, monitor platform revenue and review
            order activity.
          </p>
        </div>

        {msg && (
          <div className="admin-message">
            <ShieldCheck size={18} />
            <span>{msg}</span>
          </div>
        )}

        {loading ? (
          <div className="empty">Loading platform data…</div>
        ) : msg.includes("Access denied") ? (
          <div className="panel admin-access-panel">
            <ShieldCheck size={30} />
            <h2>Admin access required</h2>
            <p className="muted">{msg}</p>
            <p className="footer-note">
              Set your profile role to admin through the protected SQL
              instructions in README. Never expose a service-role key in
              browser code.
            </p>
          </div>
        ) : (
          <>
            {/* PLATFORM STATS */}
            <section className="admin-stats-grid">
              <div className="admin-stat-card">
                <div className="admin-stat-top">
                  <span>Restaurants</span>
                  <Store size={18} />
                </div>
                <strong>{stats.restaurants}</strong>
                <small>Registered partners</small>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-top">
                  <span>Total products</span>
                  <Package size={18} />
                </div>
                <strong>{stats.products}</strong>
                <small>Platform menu items</small>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-top">
                  <span>Today's orders</span>
                  <ClipboardList size={18} />
                </div>
                <strong>{stats.today}</strong>
                <small>Orders created today</small>
              </div>

              <div className="admin-stat-card">
                <div className="admin-stat-top">
                  <span>Customers</span>
                  <Users size={18} />
                </div>
                <strong>{stats.customers}</strong>
                <small>Registered customers</small>
              </div>
            </section>

            {/* REVENUE OVERVIEW */}
            <section className="admin-revenue-section">
              <div className="admin-section-title">
                <div>
                  <div className="eyebrow">PLATFORM REVENUE</div>
                  <h2>Revenue overview</h2>
                </div>

                <span className="admin-live-label">
                  <span /> Delivered orders only
                </span>
              </div>

              <div className="admin-revenue-grid">
                <div className="admin-revenue-card">
                  <div className="revenue-icon">
                    <TrendingUp size={19} />
                  </div>
                  <span>Total restaurant revenue</span>
                  <strong>{money(stats.totalRevenue)}</strong>
                  <small>All delivered / completed orders</small>
                </div>

                <div className="admin-revenue-card">
                  <div className="revenue-icon">
                    <IndianRupee size={19} />
                  </div>
                  <span>Today's revenue</span>
                  <strong>{money(stats.todayRevenue)}</strong>
                  <small>Today's delivered / completed orders</small>
                </div>

                <div className="admin-revenue-card commission-card">
                  <div className="revenue-icon">
                    <ShieldCheck size={19} />
                  </div>
                  <span>Today's 10% commission</span>
                  <strong>{money(stats.todayCommission)}</strong>
                  <small>10% of today's delivered revenue</small>
                </div>
              </div>
            </section>

            {/* FEATURE CARDS */}
            <section className="admin-feature-grid">
              <article className="admin-feature-card">
                <Store size={21} />
                <h3>Restaurants</h3>
                <p>Review, approve, suspend and manage partners.</p>
              </article>

              <article className="admin-feature-card">
                <ClipboardList size={21} />
                <h3>Orders</h3>
                <p>
                  Review delivery and QR dine-in orders across the platform.
                </p>
              </article>

              <article className="admin-feature-card">
                <Package size={21} />
                <h3>Products</h3>
                <p>Monitor platform menu products and availability.</p>
              </article>
            </section>

            {/* RESTAURANTS */}
            <section className="admin-section">
              <div className="admin-section-heading">
                <div>
                  <div className="eyebrow">PARTNER OPERATIONS</div>
                  <h2>Restaurants</h2>
                  <p>
                    Restaurant-wise revenue and commission overview.
                  </p>
                </div>

                <span className="admin-pending">
                  {restaurants.filter((r) => r.status === "pending").length}{" "}
                  pending
                </span>
              </div>

              {restaurants.length === 0 ? (
                <div className="empty">
                  No restaurant registrations yet.
                </div>
              ) : (
                <div className="admin-table-panel">
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Restaurant</th>
                          <th>Location</th>
                          <th>Status</th>
                          <th>QR</th>
                          <th>Total revenue</th>
                          <th>Today's revenue</th>
                          <th>Today's 10%</th>
                          <th>Actions</th>
                        </tr>
                      </thead>

                      <tbody>
                        {restaurants.map((r) => {
                          const revenue = getRestaurantRevenue(r.id);

                          return (
                            <tr key={r.id}>
                              <td>
                                <div className="restaurant-name">
                                  <strong>{r.name}</strong>
                                  <small>/{r.slug}</small>
                                </div>
                              </td>

                              <td>
                                {[r.area, r.city]
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </td>

                              <td>
                                <span
                                  className={`admin-status status-${r.status}`}
                                >
                                  {r.status}
                                </span>
                              </td>

                              <td>
                                <span
                                  className={
                                    r.qr_enabled
                                      ? "qr-enabled"
                                      : "qr-disabled"
                                  }
                                >
                                  {r.qr_enabled ? "Enabled" : "Off"}
                                </span>
                              </td>

                              <td className="revenue-cell">
                                {money(revenue.total)}
                              </td>

                              <td className="revenue-cell">
                                {money(revenue.today)}
                              </td>

                              <td className="commission-cell">
                                {money(revenue.commission)}
                              </td>

                              <td>
                                <div className="admin-actions">
                                  <button
                                    className="admin-action approve"
                                    onClick={() =>
                                      updateRestaurant(r.id, "approved")
                                    }
                                  >
                                    Approve
                                  </button>

                                  <button
                                    className="admin-action suspend"
                                    onClick={() =>
                                      updateRestaurant(r.id, "suspended")
                                    }
                                  >
                                    Suspend
                                  </button>

                                  <button
                                    className="admin-action archive"
                                    onClick={() =>
                                      updateRestaurant(r.id, "suspended")
                                    }
                                  >
                                    Archive
                                  </button>

                                  <button
                                    className="admin-action delete"
                                    onClick={() => removeRestaurant(r)}
                                    disabled={deletingId === r.id}
                                  >
                                    <Trash2 size={13} />
                                    {deletingId === r.id
                                      ? "Deleting..."
                                      : "Delete"}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="admin-note">
                Commission is calculated as 10% of today's delivered order
                revenue. This page calculates commission but does not collect
                or transfer payments.
              </p>
            </section>

            {/* RECENT ORDERS */}
            <section className="admin-section recent-section">
              <div className="admin-section-heading">
                <div>
                  <div className="eyebrow">PLATFORM ACTIVITY</div>
                  <h2>Recent orders</h2>
                  <p>Latest 20 orders across all restaurants.</p>
                </div>
              </div>

              {orders.length === 0 ? (
                <div className="empty">No orders yet.</div>
              ) : (
                <div className="admin-table-panel">
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Order</th>
                          <th>Restaurant</th>
                          <th>Type</th>
                          <th>Status</th>
                          <th>Amount</th>
                          <th>Created</th>
                        </tr>
                      </thead>

                      <tbody>
                        {orders.slice(0, 20).map((o) => (
                          <tr key={o.id}>
                            <td>
                              <strong>
                                {o.order_number || o.id.slice(0, 8)}
                              </strong>
                            </td>

                            <td>
                              {restaurants.find(
                                (r) => r.id === o.restaurant_id
                              )?.name || "—"}
                            </td>

                            <td>{o.order_type || "—"}</td>

                            <td>
                              <span
                                className={`admin-status status-${o.status}`}
                              >
                                {o.status}
                              </span>
                            </td>

                            <td className="revenue-cell">
                              {money(Number(o.total_amount || 0))}
                            </td>

                            <td>
                              {new Date(o.created_at).toLocaleString(
                                "en-IN",
                                { timeZone: "Asia/Kolkata" }
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {/* INTERNAL PREMIUM CSS */}
      <style jsx global>{`
        .admin-container {
          padding-bottom: 70px;
        }

        .admin-page-head {
          padding-top: 42px;
          padding-bottom: 28px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .admin-refresh {
          width: 36px;
          height: 36px;
          border: 1px solid #e5e5e5;
          border-radius: 10px;
          background: #fff;
          color: #111;
          display: grid;
          place-items: center;
          cursor: pointer;
        }

        .admin-refresh:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .spinning {
          animation: admin-spin 1s linear infinite;
        }

        @keyframes admin-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .admin-message {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 16px;
          margin: 0 0 22px;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          background: #fafafa;
          color: #333;
          font-size: 13px;
          line-height: 1.6;
        }

        .admin-access-panel {
          padding: 30px;
        }

        .admin-access-panel h2 {
          margin: 14px 0 8px;
        }

        .admin-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .admin-stat-card {
          padding: 20px;
          border: 1px solid #e9e9e9;
          border-radius: 15px;
          background: #fff;
          min-width: 0;
        }

        .admin-stat-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          color: #777;
          font-size: 12px;
        }

        .admin-stat-top :global(svg) {
          color: #999;
        }

        .admin-stat-card strong {
          display: block;
          margin-top: 17px;
          color: #111;
          font-size: 29px;
          font-weight: 750;
          letter-spacing: -1.2px;
        }

        .admin-stat-card small {
          display: block;
          margin-top: 5px;
          color: #999;
          font-size: 11px;
        }

        .admin-revenue-section {
          margin-top: 38px;
        }

        .admin-section-title,
        .admin-section-heading {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          gap: 16px;
          margin-bottom: 17px;
        }

        .admin-section-title h2,
        .admin-section-heading h2 {
          margin: 5px 0 0;
          font-size: 22px;
          letter-spacing: -0.7px;
        }

        .admin-section-heading p {
          margin: 6px 0 0;
          color: #888;
          font-size: 12px;
        }

        .admin-live-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: #777;
          font-size: 11px;
        }

        .admin-live-label span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #222;
        }

        .admin-revenue-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .admin-revenue-card {
          padding: 21px;
          border: 1px solid #e9e9e9;
          border-radius: 15px;
          background: #fff;
          min-width: 0;
        }

        .revenue-icon {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 1px solid #eee;
          border-radius: 11px;
          color: #111;
          margin-bottom: 17px;
        }

        .admin-revenue-card > span {
          display: block;
          color: #777;
          font-size: 12px;
        }

        .admin-revenue-card > strong {
          display: block;
          margin-top: 9px;
          font-size: 27px;
          letter-spacing: -1px;
          color: #111;
          overflow-wrap: anywhere;
        }

        .admin-revenue-card > small {
          display: block;
          margin-top: 7px;
          color: #999;
          font-size: 11px;
        }

        .commission-card {
          background: #111;
          border-color: #111;
        }

        .commission-card .revenue-icon {
          color: #fff;
          border-color: #333;
          background: #1d1d1d;
        }

        .commission-card > span,
        .commission-card > small {
          color: #aaa;
        }

        .commission-card > strong {
          color: #fff;
        }

        .admin-feature-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          margin-top: 28px;
        }

        .admin-feature-card {
          padding: 20px;
          border: 1px solid #e9e9e9;
          border-radius: 14px;
          background: #fff;
        }

        .admin-feature-card > :global(svg) {
          color: #555;
        }

        .admin-feature-card h3 {
          margin: 13px 0 6px;
          font-size: 15px;
        }

        .admin-feature-card p {
          margin: 0;
          color: #888;
          font-size: 12px;
          line-height: 1.6;
        }

        .admin-section {
          margin-top: 42px;
        }

        .admin-pending {
          padding: 7px 11px;
          border: 1px solid #e8e8e8;
          border-radius: 30px;
          color: #555;
          font-size: 11px;
          white-space: nowrap;
        }

        .admin-table-panel {
          border: 1px solid #e9e9e9;
          border-radius: 14px;
          background: #fff;
          overflow: hidden;
        }

        .admin-table-scroll {
          width: 100%;
          overflow-x: auto;
        }

        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          white-space: nowrap;
          font-size: 12px;
        }

        .admin-table th {
          padding: 14px 15px;
          background: #fafafa;
          color: #888;
          font-size: 10px;
          font-weight: 650;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #eee;
        }

        .admin-table td {
          padding: 15px;
          border-bottom: 1px solid #f0f0f0;
          color: #555;
          vertical-align: middle;
        }

        .admin-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .admin-table tbody tr:hover {
          background: #fcfcfc;
        }

        .restaurant-name {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .restaurant-name strong {
          color: #111;
          font-size: 12px;
        }

        .restaurant-name small {
          color: #999;
          font-size: 10px;
        }

        .admin-status {
          display: inline-flex;
          align-items: center;
          padding: 5px 8px;
          border: 1px solid #e8e8e8;
          border-radius: 20px;
          color: #555;
          background: #fafafa;
          font-size: 10px;
          text-transform: capitalize;
        }

        .status-approved,
        .status-delivered,
        .status-completed {
          background: #f2f2f2;
          color: #111;
          border-color: #ddd;
        }

        .status-pending,
        .status-placed {
          background: #fff;
          color: #555;
          border-color: #ccc;
        }

        .status-suspended,
        .status-cancelled,
        .status-rejected {
          background: #f7f7f7;
          color: #777;
          border-color: #e5e5e5;
        }

        .qr-enabled,
        .qr-disabled {
          font-size: 11px;
          color: #555;
        }

        .revenue-cell {
          color: #111 !important;
          font-weight: 650;
          font-variant-numeric: tabular-nums;
        }

        .commission-cell {
          color: #111 !important;
          font-weight: 750;
          font-variant-numeric: tabular-nums;
        }

        .admin-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .admin-action {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          min-height: 29px;
          padding: 0 9px;
          border: 1px solid #e5e5e5;
          border-radius: 7px;
          background: #fff;
          color: #333;
          font-size: 10px;
          cursor: pointer;
          transition: 0.2s ease;
        }

        .admin-action:hover {
          border-color: #999;
          background: #f7f7f7;
        }

        .admin-action:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .admin-action.delete {
          color: #111;
          border-color: #ddd;
        }

        .admin-action.delete:hover {
          color: #fff;
          border-color: #111;
          background: #111;
        }

        .admin-note {
          margin: 12px 2px 0;
          color: #999;
          font-size: 11px;
          line-height: 1.6;
        }

        .recent-section {
          padding-top: 0;
        }

        @media (max-width: 900px) {
          .admin-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .admin-revenue-grid {
            grid-template-columns: 1fr 1fr;
          }

          .commission-card {
            grid-column: span 2;
          }
        }

        @media (max-width: 600px) {
          .admin-page-head {
            padding-top: 25px;
          }

          .admin-stats-grid {
            gap: 9px;
          }

          .admin-stat-card {
            padding: 15px;
          }

          .admin-stat-card strong {
            font-size: 24px;
          }

          .admin-revenue-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }

          .commission-card {
            grid-column: auto;
          }

          .admin-revenue-card {
            padding: 17px;
          }

          .admin-revenue-card > strong {
            font-size: 24px;
          }

          .admin-feature-grid {
            grid-template-columns: 1fr;
            gap: 9px;
          }

          .admin-feature-card {
            padding: 16px;
          }

          .admin-section-title,
          .admin-section-heading {
            align-items: flex-start;
          }

          .admin-section-title h2,
          .admin-section-heading h2 {
            font-size: 20px;
          }

          .admin-live-label {
            font-size: 10px;
          }

          .header-actions {
            gap: 6px;
          }
        }
      `}</style>
    </>
  );
}
