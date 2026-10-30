"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { FoodProduct, Restaurant } from "@/lib/types";
import {
  Leaf,
  Drumstick,
  ShoppingBag,
  CheckCircle2,
  Minus,
  Plus,
  Clock3,
  UtensilsCrossed,
  ArrowRight,
  LoaderCircle,
  CircleAlert,
  Sparkles,
  Search,
} from "lucide-react";
type PlacedOrder = {
  id?: string;
  order_number?: number | string;
  total_amount?: number | string;
  status?: string;
};

export default function QRMenu() {
  const params = useParams<{
    restaurantSlug: string;
    tableCode: string;
  }>();

  const restaurantSlug = params.restaurantSlug;
  const tableCode = decodeURIComponent(params.tableCode);

  const [r, setR] = useState<Restaurant | null>(null);
  const [items, setItems] = useState<FoodProduct[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setStatus("Supabase is not configured.");
        setLoading(false);
        return;
      }

      try {
        const { data: rest, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id,name,slug,description,qr_enabled")
          .eq("slug", restaurantSlug)
          .eq("status", "approved")
          .eq("qr_enabled", true)
          .maybeSingle();

        if (restaurantError) throw restaurantError;

        if (!rest) {
          if (!cancelled) {
            setStatus("QR ordering is unavailable for this restaurant.");
          }
          return;
        }

        const { data: table, error: tableError } = await supabase
          .from("restaurant_tables")
          .select("id,table_code,is_active")
          .eq("restaurant_id", rest.id)
          .eq("table_code", tableCode)
          .eq("is_active", true)
          .maybeSingle();

        if (tableError) throw tableError;

        if (!table) {
          if (!cancelled) {
            setStatus("This table QR code is inactive or invalid.");
          }
          return;
        }

        const { data: products, error: productsError } = await supabase
          .from("products")
          .select(
            "id,restaurant_id,name,description,price,image_url,category,is_veg,is_available"
          )
          .eq("restaurant_id", rest.id)
          .eq("is_available", true)
          .order("name");

        if (productsError) throw productsError;

        if (!cancelled) {
          setR(rest as Restaurant);
          setItems((products ?? []) as FoodProduct[]);
        }
      } catch (error) {
        console.error("QR menu load failed:", error);

        if (!cancelled) {
          setStatus("Could not load the menu. Please refresh the page.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, tableCode]);

const categories: string[] = [
  "All",
  ...Array.from(
    new Set(
      items
        .map((item) => item.category)
        .filter((value): value is string => Boolean(value))
    )
  ),
];

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || "").toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      category === "All" || item.category === category;

    return matchesSearch && matchesCategory;
  });

  const selectedItems = items.filter((p) => (qty[p.id] || 0) > 0);

  const total = selectedItems.reduce(
    (sum, p) => sum + Number(p.price) * (qty[p.id] || 0),
    0
  );

  const cartCount = selectedItems.reduce(
    (sum, item) => sum + (qty[item.id] || 0),
    0
  );

  function changeQty(id: string, amount: number) {
    setQty((current) => ({
      ...current,
      [id]: Math.min(50, Math.max(0, (current[id] || 0) + amount)),
    }));
  }

  async function order() {
    if (!r || submitting || !selectedItems.length) return;

    if (!customerName.trim()) {
      setStatus("Please enter your name.");
      document.getElementById("qr-name")?.focus();
      return;
    }

    if (customerPhone.replace(/\D/g, "").length < 10) {
      setStatus("Please enter a valid phone number.");
      document.getElementById("qr-phone")?.focus();
      return;
    }

    setSubmitting(true);
    setStatus("");

    try {
      const response = await fetch("/api/qr-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantId: r.id,
          tableCode,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          notes: notes.trim(),
          items: selectedItems.map((p) => ({
            productId: p.id,
            quantity: qty[p.id],
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error || "Could not place your order.");
        return;
      }

      const created = result.order as PlacedOrder;

      setPlacedOrder(created);
      setQty({});
      setNotes("");
      setStatus("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("QR order request failed:", error);
      setStatus("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="premium-menu">
      <header className="premium-menu-header">
        <a className="premium-brand" href="/" aria-label="Tho'am home">
          <span className="premium-brand-mark">T.</span>
          <span>
            Tho’am
            <small>GOOD FOOD. GOOD MOMENTS.</small>
          </span>
        </a>

        <div className="premium-table-badge">
          <span className="live-dot" />
          <span>
            DINE IN
            <strong>TABLE {tableCode}</strong>
          </span>
        </div>
      </header>

      {loading ? (
        <section className="premium-state">
          <LoaderCircle className="premium-spinner" size={34} />
          <h2>Preparing your menu</h2>
          <p>Just a moment. Something delicious is on its way.</p>
        </section>
      ) : !r ? (
        <section className="premium-state premium-error">
          <CircleAlert size={36} />
          <h2>Menu unavailable</h2>
          <p>{status || "This restaurant's QR menu is unavailable."}</p>
          <button
            className="premium-button premium-button-black"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </section>
      ) : placedOrder ? (
        <section className="premium-success">
          <div className="success-icon">
            <CheckCircle2 size={42} strokeWidth={1.5} />
          </div>

          <span className="premium-kicker">ORDER CONFIRMED</span>
          <h1>You're all set.</h1>
          <p className="success-description">
            Your order has been sent to{" "}
            <strong>{r.name}</strong>. Sit back and enjoy your time.
          </p>

          <div className="success-receipt">
            <div className="receipt-row">
              <span>Restaurant</span>
              <strong>{r.name}</strong>
            </div>

            {placedOrder.order_number != null && (
              <div className="receipt-row">
                <span>Order number</span>
                <strong>#{placedOrder.order_number}</strong>
              </div>
            )}

            <div className="receipt-row">
              <span>Table</span>
              <strong>{tableCode}</strong>
            </div>

            <div className="receipt-row">
              <span>Payment</span>
              <strong>Cash at restaurant</strong>
            </div>

            <div className="receipt-total">
              <span>Total amount</span>
              <strong>
                ₹{Number(placedOrder.total_amount ?? total).toFixed(2)}
              </strong>
            </div>
          </div>

          <button
            className="premium-button premium-button-black success-back"
            onClick={() => {
              setPlacedOrder(null);
              setStatus("");
            }}
          >
            Back to menu <ArrowRight size={17} />
          </button>

          <p className="premium-footnote">
            Thank you for choosing Tho’am.
          </p>
        </section>
      ) : (
        <>
          <section className="premium-hero">
            <div className="hero-copy">
              <span className="premium-kicker">
                <Sparkles size={13} /> YOUR TABLE, YOUR MENU
              </span>

              <h1>
                Good food.
                <br />
                <span>Made for you.</span>
              </h1>

              <p>
                Explore the menu, pick your favourites, and order directly
                from your table.
              </p>

              <div className="hero-meta">
                <span>
                  <UtensilsCrossed size={15} /> Freshly prepared
                </span>
                <span>
                  <Clock3 size={15} /> Easy ordering
                </span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-visual-ring" />
              <div className="hero-plate">
                <UtensilsCrossed size={70} strokeWidth={1} />
              </div>
              <span className="hero-sticker">MADE WITH CARE</span>
            </div>

            <div className="hero-bottom">
              <span className="hero-bottom-label">NOW SERVING</span>
              <strong>{r.name}</strong>
              <span className="hero-table">
                <span className="live-dot" /> Table {tableCode}
              </span>
            </div>
          </section>

          <section className="premium-menu-content">
            <div className="menu-heading">
              <div>
                <span className="premium-kicker">THE GOOD STUFF</span>
                <h2>Explore the menu<span>.</span></h2>
                <p>Find something you’ll love.</p>
              </div>

              <div className="menu-count">
                <strong>{items.length.toString().padStart(2, "0")}</strong>
                <span>ITEMS</span>
              </div>
            </div>

            <label className="premium-search">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes..."
                aria-label="Search dishes"
              />
              <span className="search-shortcut">MENU</span>
            </label>

            <div className="premium-categories" aria-label="Menu categories">
              {categories.map((item) => (
                <button
                  key={item}
                  className={`premium-category ${
                    category === item ? "active" : ""
                  }`}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>

            {items.length === 0 ? (
              <div className="premium-empty">
                <UtensilsCrossed size={30} />
                <h3>The menu is being prepared.</h3>
                <p>Please check back in a little while.</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="premium-empty">
                <Search size={30} />
                <h3>No dishes found.</h3>
                <p>Try a different search or category.</p>
                <button
                  className="premium-button premium-button-outline"
                  onClick={() => {
                    setSearch("");
                    setCategory("All");
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="premium-food-grid">
                {filteredItems.map((p, index) => {
                  const count = qty[p.id] || 0;

                  return (
                    <article
                      className={`premium-food-card ${
                        count > 0 ? "is-selected" : ""
                      }`}
                      key={p.id}
                    >
                      <div className="premium-food-image">
                        {p.image_url ? (
                          <Image
                            src={p.image_url}
                            alt={p.name}
                            fill
                            unoptimized
                            sizes="(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 260px"
                            className="premium-food-photo"
                          />
                        ) : (
                          <div className="food-placeholder">
                            <UtensilsCrossed size={35} strokeWidth={1.2} />
                            <span>FRESH & DELICIOUS</span>
                          </div>
                        )}

                        <span className="food-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>

                        <span
                          className={`food-type-badge ${
                            p.is_veg ? "veg" : "nonveg"
                          }`}
                          title={p.is_veg ? "Vegetarian" : "Non-vegetarian"}
                        >
                          {p.is_veg ? (
                            <Leaf size={13} />
                          ) : (
                            <Drumstick size={13} />
                          )}
                          {p.is_veg ? "VEG" : "NON-VEG"}
                        </span>
                      </div>

                      <div className="premium-food-info">
                        <span className="premium-food-category">
                          {p.category || "FROM OUR KITCHEN"}
                        </span>

                        <h3>{p.name}</h3>

                        <p className="premium-food-description">
                          {p.description || "Prepared fresh, just for you."}
                        </p>

                        <div className="premium-food-bottom">
                          <strong className="premium-food-price">
                            ₹{Number(p.price).toFixed(0)}
                          </strong>

                          {count === 0 ? (
                            <button
                              className="premium-add-button"
                              onClick={() => changeQty(p.id, 1)}
                              aria-label={`Add ${p.name} to your order`}
                            >
                              ADD <Plus size={15} />
                            </button>
                          ) : (
                            <div className="premium-quantity">
                              <button
                                onClick={() => changeQty(p.id, -1)}
                                aria-label={`Remove one ${p.name}`}
                              >
                                <Minus size={14} />
                              </button>
                              <strong>{count}</strong>
                              <button
                                onClick={() => changeQty(p.id, 1)}
                                disabled={count >= 50}
                                aria-label={`Add one ${p.name}`}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {cartCount > 0 && (
              <section className="premium-checkout" id="checkout">
                <div className="checkout-heading">
                  <div className="checkout-icon">
                    <ShoppingBag size={21} />
                  </div>
                  <div>
                    <span className="premium-kicker">ALMOST THERE</span>
                    <h2>Your order</h2>
                    <p>
                      {cartCount} {cartCount === 1 ? "item" : "items"} selected
                    </p>
                  </div>
                  <strong className="checkout-total">
                    ₹{total.toFixed(2)}
                  </strong>
                </div>

                <div className="checkout-items">
                  {selectedItems.map((p) => (
                    <div className="checkout-item" key={p.id}>
                      <div>
                        <strong>{p.name}</strong>
                        <span>
                          ₹{Number(p.price).toFixed(2)} × {qty[p.id]}
                        </span>
                      </div>
                      <strong>
                        ₹{(Number(p.price) * qty[p.id]).toFixed(2)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="checkout-form">
                  <div className="checkout-form-heading">
                    <span className="premium-kicker">YOUR DETAILS</span>
                    <p>We’ll use these details for your dine-in order.</p>
                  </div>

                  <div className="checkout-field-grid">
                    <label className="premium-field">
                      <span>Name *</span>
                      <input
                        id="qr-name"
                        autoComplete="name"
                        maxLength={100}
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Your name"
                      />
                    </label>

                    <label className="premium-field">
                      <span>Phone number *</span>
                      <input
                        id="qr-phone"
                        type="tel"
                        autoComplete="tel"
                        maxLength={30}
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Your phone number"
                      />
                    </label>
                  </div>

                  <label className="premium-field notes-field">
                    <span>Special instructions</span>
                    <textarea
                      maxLength={500}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Less spicy, no onions, etc. (optional)"
                      rows={3}
                    />
                  </label>

                  {status && (
                    <p className="premium-notice" role="status">
                      <CircleAlert size={17} />
                      {status}
                    </p>
                  )}

                  <div className="checkout-payment">
                    <div className="cash-symbol">₹</div>
                    <div>
                      <strong>Pay at the restaurant</strong>
                      <span>Cash payment · No online payment needed</span>
                    </div>
                    <span className="cash-badge">CASH</span>
                  </div>

                  <button
                    className="premium-button premium-button-black place-order-button"
                    disabled={total <= 0 || submitting}
                    onClick={order}
                  >
                    {submitting ? (
                      <>
                        <LoaderCircle
                          className="premium-spinner"
                          size={18}
                        />
                        Placing your order...
                      </>
                    ) : (
                      <>
                        Place dine-in order
                        <span>₹{total.toFixed(2)}</span>
                        <ArrowRight size={18} />
                      </>
                    )}
                  </button>

                  <p className="checkout-terms">
                    By placing your order, you confirm the items and total
                    shown above.
                  </p>
                </div>
              </section>
            )}
          </section>
        </>
      )}

      <footer className="premium-menu-footer">
        <a className="premium-footer-brand" href="/">
          THO’AM<span>.</span>
        </a>
        <span>Good food. Good moments.</span>
        <span className="footer-table">TABLE {tableCode}</span>
      </footer>

      {r && !loading && !placedOrder && cartCount > 0 && (
        <button
          className="premium-sticky-cart"
          onClick={() =>
            document
              .getElementById("checkout")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        >
          <span className="sticky-cart-count">{cartCount}</span>
          <span>
            <strong>View your order</strong>
            <small>
              {cartCount} {cartCount === 1 ? "item" : "items"}
            </small>
          </span>
          <strong className="sticky-cart-total">₹{total.toFixed(2)}</strong>
          <ArrowRight size={19} />
        </button>
      )}
    </main>
  );
}