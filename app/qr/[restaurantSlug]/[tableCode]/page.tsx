
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
  HandHelping,
  Send,
  X,
} from "lucide-react";

type PlacedOrder = {
  id?: string;
  order_number?: number | string;
  total_amount?: number | string;
  status?: string;
};

type NeedType =
  | "Tissue / Napkin"
  | "Additional food"
  | "Message to kitchen"
  | "Other";

export default function QRMenu() {
  const params = useParams<{
    restaurantSlug: string;
    tableCode: string;
  }>();

  const restaurantSlug = params.restaurantSlug;
  const tableCode = decodeURIComponent(params.tableCode);

  const [r, setR] = useState<Restaurant | null>(null);
  const [tableId, setTableId] = useState("");

  const [items, setItems] = useState<FoodProduct[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});

  const [notes, setNotes] = useState("");
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [placedOrder, setPlacedOrder] =
    useState<PlacedOrder | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  // Table assistance states
  const [needsOpen, setNeedsOpen] = useState(false);
  const [needType, setNeedType] =
    useState<NeedType>("Tissue / Napkin");
  const [needMessage, setNeedMessage] = useState("");
  const [sendingNeed, setSendingNeed] = useState(false);
  const [needStatus, setNeedStatus] = useState("");
  const [needSuccess, setNeedSuccess] = useState(false);

  // Load restaurant, table and menu
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setStatus("Supabase is not configured.");
        setLoading(false);
        return;
      }

      try {
        const { data: rest, error: restaurantError } =
          await supabase
            .from("restaurants")
            .select("id,name,slug,description,qr_enabled")
            .eq("slug", restaurantSlug)
            .eq("status", "approved")
            .eq("qr_enabled", true)
            .maybeSingle();

        if (restaurantError) throw restaurantError;

        if (!rest) {
          if (!cancelled) {
            setStatus(
              "QR ordering is unavailable for this restaurant."
            );
          }
          return;
        }

        const { data: table, error: tableError } =
          await supabase
            .from("restaurant_tables")
            .select("id,table_code,is_active")
            .eq("restaurant_id", rest.id)
            .eq("table_code", tableCode)
            .eq("is_active", true)
            .maybeSingle();

        if (tableError) throw tableError;

        if (!table) {
          if (!cancelled) {
            setStatus(
              "This table QR code is inactive or invalid."
            );
          }
          return;
        }

        const { data: products, error: productsError } =
          await supabase
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
          setTableId(table.id);
          setItems((products ?? []) as FoodProduct[]);
        }
      } catch (error) {
        console.error("QR menu load failed:", error);

        if (!cancelled) {
          setStatus(
            "Could not load the menu. Please refresh the page."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [restaurantSlug, tableCode]);

  // Menu categories
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

  // Search and category filtering
  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.description || "")
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesCategory =
      category === "All" || item.category === category;

    return matchesSearch && matchesCategory;
  });

  const selectedItems = items.filter(
    (p) => (qty[p.id] || 0) > 0
  );

  const total = selectedItems.reduce(
    (sum, p) =>
      sum + Number(p.price) * (qty[p.id] || 0),
    0
  );

  const cartCount = selectedItems.reduce(
    (sum, item) => sum + (qty[item.id] || 0),
    0
  );

  function changeQty(id: string, amount: number) {
    setQty((current) => ({
      ...current,
      [id]: Math.min(
        50,
        Math.max(0, (current[id] || 0) + amount)
      ),
    }));
  }

  // Send table assistance request
  async function sendTableNeed() {
    const client = supabase;

    if (!client || !r || !tableId || sendingNeed) {
      return;
    }

    setSendingNeed(true);
    setNeedStatus("");
    setNeedSuccess(false);

    try {
      const { error } = await client
        .from("table_needs")
        .insert({
          restaurant_id: r.id,
          table_id: tableId,
          table_code: tableCode,
          need_type: needType,
          message: needMessage.trim() || null,
          status: "pending",
        });

      if (error) throw error;

      setNeedSuccess(true);
      setNeedMessage("");
      setNeedStatus(
        "Your request has been sent to the restaurant."
      );
    } catch (error) {
      console.error("Table request failed:", error);

      setNeedStatus(
        "Could not send your request. Please try again."
      );
    } finally {
      setSendingNeed(false);
    }
  }

  // Place food order
  async function order() {
    if (!r || submitting || !selectedItems.length) {
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
          notes: notes.trim(),
          items: selectedItems.map((p) => ({
            productId: p.id,
            quantity: qty[p.id],
            specialInstructions: (itemNotes[p.id] || "").trim(),
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(
          result.error || "Could not place your order."
        );
        return;
      }

      const created = result.order as PlacedOrder;

      setPlacedOrder(created);
      setQty({});
      setNotes("");\n      setItemNotes({});
      setStatus("");

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error("QR order request failed:", error);
      setStatus("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="premium-menu">
      {/* HEADER */}
      <header className="premium-menu-header">
        <a
          className="premium-brand"
          href="/"
          aria-label="Tho'am home"
        >
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

      {/* LOADING */}
      {loading ? (
        <section className="premium-state">
          <LoaderCircle
            className="premium-spinner"
            size={34}
          />
          <h2>Preparing your menu</h2>
          <p>
            Just a moment. Something delicious is on its way.
          </p>
        </section>
      ) : !r ? (
        /* ERROR */
        <section className="premium-state premium-error">
          <CircleAlert size={36} />
          <h2>Menu unavailable</h2>
          <p>
            {status ||
              "This restaurant's QR menu is unavailable."}
          </p>

          <button
            className="premium-button premium-button-black"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </section>
      ) : placedOrder ? (
        /* ORDER SUCCESS */
        <section className="premium-success">
          <div className="success-icon">
            <CheckCircle2 size={42} strokeWidth={1.5} />
          </div>

          <span className="premium-kicker">
            KOT CREATED
          </span>

          <h1>You're all set.</h1>

          <p className="success-description">
            Your KOT has been sent to{" "}
            <strong>{r.name}</strong>. Sit back and enjoy your
            time.
          </p>

          <div className="success-receipt">
            <div className="receipt-row">
              <span>Restaurant</span>
              <strong>{r.name}</strong>
            </div>

            {placedOrder.order_number != null && (
              <div className="receipt-row">
                <span>KOT number</span>
                <strong>
                  #{placedOrder.order_number}
                </strong>
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
                ₹
                {Number(
                  placedOrder.total_amount ?? total
                ).toFixed(2)}
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
          {/* HERO */}
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
                Explore the menu, pick your favourites, and
                order directly from your table.
              </p>

              <div className="hero-meta">
                <span>
                  <UtensilsCrossed size={15} />
                  Freshly prepared
                </span>

                <span>
                  <Clock3 size={15} />
                  Easy ordering
                </span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-visual-ring" />

              <div className="hero-plate">
                <UtensilsCrossed
                  size={70}
                  strokeWidth={1}
                />
              </div>

              <span className="hero-sticker">
                MADE WITH CARE
              </span>
            </div>

            <div className="hero-bottom">
              <span className="hero-bottom-label">
                NOW SERVING
              </span>

              <strong>{r.name}</strong>

              <span className="hero-table">
                <span className="live-dot" />
                Table {tableCode}
              </span>
            </div>
          </section>

          <section className="premium-menu-content">
            {/* TABLE ASSISTANCE */}
            <section className="table-assistance">
              <div className="assistance-copy">
                <span className="assistance-icon">
                  <HandHelping size={22} />
                </span>

                <div>
                  <span className="assistance-label">
                    TABLE ASSISTANCE
                  </span>

                  <h3>Need anything?</h3>

                  <p>
                    We're here to help. Request directly from
                    your table.
                  </p>
                </div>
              </div>

              <button
                className="assistance-open"
                onClick={() => {
                  setNeedsOpen((current) => !current);
                  setNeedStatus("");
                  setNeedSuccess(false);
                }}
              >
                {needsOpen ? (
                  <>
                    Close request <X size={16} />
                  </>
                ) : (
                  <>
                    Request assistance{" "}
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              {needsOpen && (
                <div className="assistance-form">
                  <div className="assistance-form-heading">
                    <span className="premium-kicker">
                      TABLE {tableCode}
                    </span>

                    <h3>How can we help?</h3>
                  </div>

                  <div className="need-options">
                    {(
                      [
                        "Tissue / Napkin",
                        "Additional food",
                        "Message to kitchen",
                        "Other",
                      ] as NeedType[]
                    ).map((type) => (
                      <button
                        key={type}
                        type="button"
                        className={`need-option ${
                          needType === type
                            ? "selected"
                            : ""
                        }`}
                        onClick={() => setNeedType(type)}
                      >
                        <span className="need-option-dot" />
                        {type}
                      </button>
                    ))}
                  </div>

                  <label className="need-message-label">
                    Additional message{" "}
                    <span>(Optional)</span>

                    <textarea
                      value={needMessage}
                      onChange={(e) =>
                        setNeedMessage(e.target.value)
                      }
                      maxLength={300}
                      rows={3}
                      placeholder="Tell us what you need..."
                    />
                  </label>

                  {needStatus && (
                    <p
                      className={`need-feedback ${
                        needSuccess ? "success" : "error"
                      }`}
                      role="status"
                    >
                      {needSuccess ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <CircleAlert size={17} />
                      )}

                      {needStatus}
                    </p>
                  )}

                  {needSuccess ? (
                    <button
                      className="need-submit"
                      onClick={() => {
                        setNeedsOpen(false);
                        setNeedStatus("");
                        setNeedSuccess(false);
                      }}
                    >
                      Done <CheckCircle2 size={17} />
                    </button>
                  ) : (
                    <button
                      className="need-submit"
                      onClick={sendTableNeed}
                      disabled={sendingNeed || !tableId}
                    >
                      {sendingNeed ? (
                        <>
                          <LoaderCircle
                            className="premium-spinner"
                            size={18}
                          />
                          Sending request...
                        </>
                      ) : (
                        <>
                          Send request <Send size={17} />
                        </>
                      )}
                    </button>
                  )}

                  <p className="need-privacy">
                    Your request will be sent directly to the
                    restaurant.
                  </p>
                </div>
              )}
            </section>

            {/* MENU HEADING */}
            <div className="menu-heading">
              <div>
                <span className="premium-kicker">
                  THE GOOD STUFF
                </span>

                <h2>
                  Explore the menu<span>.</span>
                </h2>

                <p>Find something you’ll love.</p>
              </div>

              <div className="menu-count">
                <strong>
                  {items.length.toString().padStart(2, "0")}
                </strong>
                <span>ITEMS</span>
              </div>
            </div>

            {/* SEARCH */}
            <label className="premium-search">
              <Search size={19} />

              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search dishes..."
                aria-label="Search dishes"
              />

              <span className="search-shortcut">MENU</span>
            </label>

            {/* CATEGORIES */}
            <div
              className="premium-categories"
              aria-label="Menu categories"
            >
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

            {/* PRODUCTS */}
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
                <p>
                  Try a different search or category.
                </p>

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
                            <UtensilsCrossed
                              size={35}
                              strokeWidth={1.2}
                            />
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
                          title={
                            p.is_veg
                              ? "Vegetarian"
                              : "Non-vegetarian"
                          }
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
                          {p.description ||
                            "Prepared fresh, just for you."}
                        </p>

                        <div className="premium-food-bottom">
                          <strong className="premium-food-price">
                            ₹{Number(p.price).toFixed(0)}
                          </strong>

                          {count === 0 ? (
                            <button
                              className="premium-add-button"
                              onClick={() =>
                                changeQty(p.id, 1)
                              }
                              aria-label={`Add ${p.name} to your order`}
                            >
                              ADD <Plus size={15} />
                            </button>
                          ) : (
                            <div className="premium-quantity">
                              <button
                                onClick={() =>
                                  changeQty(p.id, -1)
                                }
                                aria-label={`Remove one ${p.name}`}
                              >
                                <Minus size={14} />
                              </button>

                              <strong>{count}</strong>

                              <button
                                onClick={() =>
                                  changeQty(p.id, 1)
                                }
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

            {/* CHECKOUT */}
            {cartCount > 0 && (
              <section
                className="premium-checkout"
                id="checkout"
              >
                <div className="checkout-heading">
                  <div className="checkout-icon">
                    <ShoppingBag size={21} />
                  </div>

                  <div>
                    <span className="premium-kicker">
                      ALMOST THERE
                    </span>

                    <h2>Your order</h2>

                    <p>
                      {cartCount}{" "}
                      {cartCount === 1 ? "item" : "items"}{" "}
                      selected
                    </p>
                  </div>

                  <strong className="checkout-total">
                    ₹{total.toFixed(2)}
                  </strong>
                </div>

                <div className="checkout-items">
                  {selectedItems.map((p) => (
                    <div
                      className="checkout-item"
                      key={p.id}
                    >
                      <div>
                        <strong>{p.name}</strong>

                        <span>
                          ₹{Number(p.price).toFixed(2)} ×{" "}
                          {qty[p.id]}
                        </span>
                      </div>

                      <strong>
                        ₹
                        {(
                          Number(p.price) * qty[p.id]
                        ).toFixed(2)}
                      </strong>
                    </div>
                  ))}
                </div>

                <div className="checkout-form">
                  <div className="checkout-form-heading">
                    <span className="premium-kicker">KITCHEN NOTES</span>
                    <p>Add an instruction to any dish if needed. No personal details required.</p>
                  </div>

                  {selectedItems.map((p) => (
                    <label className="premium-field notes-field" key={p.id}>
                      <span>{p.name} · Special instruction</span>
                      <textarea
                        maxLength={300}
                        value={itemNotes[p.id] || ""}
                        onChange={(e) => setItemNotes((current) => ({ ...current, [p.id]: e.target.value }))}
                        placeholder="Less spicy, no onions, etc. (optional)"
                        rows={2}
                      />
                    </label>
                  ))}

                  <label className="premium-field notes-field">
                    <span>Order note (optional)</span>

                    <textarea
                      maxLength={500}
                      value={notes}
                      onChange={(e) =>
                        setNotes(e.target.value)
                      }
                      placeholder="Any note for the whole order (optional)"
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
                      <span>
                        Cash payment · No online payment needed
                      </span>
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
                    By placing your order, you confirm the items
                    and total shown above.
                  </p>
                </div>
              </section>
            )}
          </section>
        </>
      )}

      {/* FOOTER */}
      <footer className="premium-menu-footer">
        <a className="premium-footer-brand" href="/">
          THO’AM<span>.</span>
        </a>

        <span>Good food. Good moments.</span>

        <span className="footer-table">
          TABLE {tableCode}
        </span>
      </footer>

      {/* STICKY CART */}
      {r && !loading && !placedOrder && cartCount > 0 && (
        <button
          className="premium-sticky-cart"
          onClick={() =>
            document
              .getElementById("checkout")
              ?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              })
          }
        >
          <span className="sticky-cart-count">
            {cartCount}
          </span>

          <span>
            <strong>View your order</strong>
            <small>
              {cartCount}{" "}
              {cartCount === 1 ? "item" : "items"}
            </small>
          </span>

          <strong className="sticky-cart-total">
            ₹{total.toFixed(2)}
          </strong>

          <ArrowRight size={19} />
        </button>
      )}

      {/* INTERNAL CSS */}
      <style jsx>{`

@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap');

.premium-menu {
  --red: #176b49;
  --red-dark: #104b35;
  --red-soft: #eaf5ee;
  --black: #101713;
  --muted: #777f79;
  --border: #e5ebe6;
  --surface: #f6f9f6;
  --white: #ffffff;

  min-height: 100vh;
  padding-bottom: 35px;
  background: #fff;
  color: var(--black);
  font-family: 'DM Sans', sans-serif;
  -webkit-font-smoothing: antialiased;
}

.premium-menu * {
  box-sizing: border-box;
}

.premium-menu button,
.premium-menu input,
.premium-menu textarea {
  font: inherit;
}

.premium-menu button {
  -webkit-tap-highlight-color: transparent;
}

.premium-menu button:focus-visible,
.premium-menu a:focus-visible,
.premium-menu input:focus-visible,
.premium-menu textarea:focus-visible {
  outline: 3px solid #176b4945;
  outline-offset: 3px;
}

/* HEADER */

.premium-menu-header {
  height: 76px;
  padding: 0 7%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border);
  background: #ffffffed;
  backdrop-filter: blur(16px);
  position: relative;
  z-index: 5;
}

.premium-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--black);
  text-decoration: none;
  font-family: 'Manrope', sans-serif;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -1.2px;
}

.premium-brand-mark {
  width: 43px;
  height: 43px;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, #21865c, #0b3828);
  color: white;
  border-radius: 13px;
  box-shadow: 0 7px 20px #176b4935;
}

.premium-brand small {
  display: block;
  margin-top: 4px;
  color: var(--muted);
  font-size: 8px;
  letter-spacing: 1.7px;
}

.premium-table-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--muted);
  font-size: 9px;
  letter-spacing: 1.3px;
}

.premium-table-badge strong {
  display: block;
  margin-top: 4px;
  color: var(--black);
  font-size: 12px;
}

.live-dot {
  width: 8px;
  height: 8px;
  display: inline-block;
  flex-shrink: 0;
  border-radius: 50%;
  background: #20a36b;
  box-shadow: 0 0 0 4px #20a36b18;
}

/* TYPOGRAPHY */

.premium-kicker {
  color: var(--red);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
}

.premium-hero {
  position: relative;
  overflow: hidden;
  width: 86%;
  min-height: 410px;
  margin: 26px auto 55px;
  padding: 65px 7%;
  display: flex;
  align-items: center;
  background:
    radial-gradient(ellipse at 85% 20%, #23885a55, transparent 35%),
    radial-gradient(ellipse at 15% 100%, #164c3655, transparent 45%),
    linear-gradient(125deg, #080e0b 0%, #102b20 48%, #07110c 100%);
  color: white;
  border: 1px solid #ffffff12;
  border-radius: 22px;
  box-shadow: 0 25px 65px #071b1230;
}

.premium-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background-image: linear-gradient(#ffffff08 1px, transparent 1px),
                    linear-gradient(90deg, #ffffff08 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: linear-gradient(to right, transparent, black);
  pointer-events: none;
}

.premium-hero::after {
  content: "";
  position: absolute;
  right: -100px;
  top: -180px;
  width: 420px;
  height: 420px;
  border: 1px solid #ffffff18;
  border-radius: 50%;
  box-shadow: 0 0 0 35px #ffffff07, 0 0 0 70px #ffffff04;
}

.hero-copy {
  max-width: 570px;
  position: relative;
  z-index: 2;
}

.hero-copy .premium-kicker {
  color: #8be0b0;
}

.hero-copy h1 {
  margin: 26px 0 22px;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(45px, 6vw, 78px);
  line-height: .99;
  letter-spacing: -4.5px;
  font-weight: 800;
}

.hero-copy h1 span {
  background: linear-gradient(90deg, #a3e8bc, #43b77c);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.hero-copy > p {
  max-width: 420px;
  color: #c1d0c6;
  font-size: 14px;
  line-height: 1.9;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 23px;
  margin-top: 28px;
  color: #d8e5dc;
  font-size: 11px;
}

.hero-meta span {
  display: flex;
  align-items: center;
  gap: 8px;
}

.hero-visual {
  position: absolute;
  top: 50%;
  right: 9%;
  width: 240px;
  height: 240px;
  display: grid;
  place-items: center;
  transform: translateY(-50%);
  z-index: 1;
}

.hero-visual-ring {
  position: absolute;
  width: 225px;
  height: 225px;
  border: 1px solid #a4e8bf40;
  border-radius: 50%;
  box-shadow: 0 0 0 22px #ffffff08;
}

.hero-plate {
  width: 165px;
  height: 165px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: linear-gradient(145deg, #fff, #dcece1);
  color: #176b49;
  box-shadow: 0 20px 55px #0008;
}

.hero-sticker {
  position: absolute;
  right: -4px;
  bottom: 10px;
  padding: 11px 15px;
  background: linear-gradient(135deg, #2b9a68, #105238);
  color: white;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
  transform: rotate(-6deg);
  box-shadow: 0 7px 20px #0004;
}

.hero-bottom {
  position: absolute;
  right: 7%;
  bottom: 21px;
  left: 7%;
  display: flex;
  align-items: center;
  gap: 15px;
  padding-top: 15px;
  border-top: 1px solid #ffffff25;
  font-size: 11px;
}

.hero-bottom-label {
  color: #9aafa2;
  font-size: 9px;
  letter-spacing: 1px;
}

.hero-table {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  color: #dce9e0;
}

/* MAIN CONTENT */

.premium-menu-content {
  width: 86%;
  max-width: 1180px;
  margin: auto;
}

/* TABLE ASSISTANCE */

.table-assistance {
  margin-bottom: 55px;
  padding: 25px;
  border: 1px solid #dfeae2;
  border-radius: 16px;
  background: linear-gradient(125deg, #ffffff, #f0f7f2);
  box-shadow: 0 12px 35px #102b2010;
}

.assistance-copy {
  display: flex;
  align-items: center;
  gap: 16px;
}

.assistance-icon {
  width: 53px;
  height: 53px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(145deg, #1d7651, #0b3828);
  color: white;
  box-shadow: 0 7px 18px #176b4930;
}

.assistance-label {
  color: var(--red);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.8px;
}

.assistance-copy h3 {
  margin: 6px 0;
  font-family: 'Manrope', sans-serif;
  font-size: 20px;
  letter-spacing: -.7px;
}

.assistance-copy p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.6;
}

.assistance-open {
  min-height: 45px;
  margin-top: 20px;
  padding: 0 19px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(120deg, #1d7651, #0d4933);
  color: white;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 6px 16px #176b4925;
  transition: .25s;
}

.assistance-open:hover {
  background: linear-gradient(120deg, #23885d, #10583c);
  transform: translateY(-2px);
  box-shadow: 0 10px 22px #176b4935;
}

.assistance-form {
  margin-top: 25px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
  animation: fadeUp .25s ease;
}

.assistance-form-heading h3 {
  margin: 9px 0 20px;
  font-family: 'Manrope', sans-serif;
  font-size: 24px;
  letter-spacing: -.8px;
}

.need-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px;
}

.need-option {
  min-height: 52px;
  padding: 13px;
  display: flex;
  align-items: center;
  gap: 11px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: white;
  color: var(--black);
  text-align: left;
  font-size: 12px;
  cursor: pointer;
  transition: .2s;
}

.need-option:hover {
  border-color: #8bb9a0;
  background: #f6fbf7;
}

.need-option.selected {
  border-color: var(--red);
  background: var(--red-soft);
  color: var(--red-dark);
  font-weight: 800;
}

.need-option-dot {
  width: 11px;
  height: 11px;
  flex-shrink: 0;
  border: 1px solid #aaa;
  border-radius: 50%;
}

.need-option.selected .need-option-dot {
  border-color: var(--red);
  background: var(--red);
  box-shadow: inset 0 0 0 2px white;
}

.need-message-label {
  display: block;
  margin-top: 20px;
  font-size: 12px;
  font-weight: 800;
}

.need-message-label span {
  color: var(--muted);
  font-weight: 400;
}

.need-message-label textarea {
  width: 100%;
  min-height: 90px;
  display: block;
  margin-top: 10px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 9px;
  outline: none;
  resize: vertical;
  background: white;
  color: var(--black);
  font-size: 13px;
  line-height: 1.6;
  transition: .2s;
}

.need-message-label textarea:focus {
  border-color: var(--red);
  box-shadow: 0 0 0 3px #176b4915;
}

.need-submit {
  width: 100%;
  min-height: 49px;
  margin-top: 15px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(120deg, #17231c, #0c3e2b);
  color: white;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: .2s;
}

.need-submit:hover:not(:disabled) {
  background: linear-gradient(120deg, #176b49, #0d4933);
}

.need-submit:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.need-feedback {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 15px 0;
  padding: 13px;
  border-radius: 8px;
  font-size: 12px;
}

.need-feedback.success {
  background: #effaf4;
  color: #16764b;
}

.need-feedback.error {
  background: #fff1f1;
  color: #a81729;
}

.need-privacy {
  margin-top: 15px;
  color: var(--muted);
  font-size: 10px;
  text-align: center;
}

/* MENU HEADING */

.menu-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  margin-bottom: 30px;
}

.menu-heading h2 {
  margin: 10px 0;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(30px, 4vw, 44px);
  letter-spacing: -2px;
}

.menu-heading h2 span {
  color: var(--red);
}

.menu-heading p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
}

.menu-count {
  text-align: right;
}

.menu-count strong {
  display: block;
  font-family: 'Manrope', sans-serif;
  font-size: 34px;
  letter-spacing: -1.5px;
}

.menu-count span {
  color: var(--muted);
  font-size: 9px;
  letter-spacing: 2px;
}

/* SEARCH */

.premium-search {
  height: 57px;
  margin-bottom: 20px;
  padding: 0 18px;
  display: flex;
  align-items: center;
  gap: 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  transition: .2s;
}

.premium-search:focus-within {
  border-color: var(--red);
  background: white;
  box-shadow: 0 0 0 4px #176b4910;
}

.premium-search input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  font-size: 13px;
}

.search-shortcut {
  color: #9aa49c;
  font-size: 9px;
  letter-spacing: 1px;
}

/* CATEGORIES */

.premium-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin-bottom: 30px;
}

.premium-category {
  min-height: 39px;
  padding: 0 17px;
  border: 1px solid var(--border);
  border-radius: 30px;
  background: white;
  color: #555;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: .2s;
}

.premium-category:hover {
  border-color: var(--red);
  color: var(--red);
}

.premium-category.active {
  border-color: #102b20;
  background: linear-gradient(120deg, #17231c, #0e4933);
  color: white;
  box-shadow: 0 5px 14px #102b2025;
}

/* FOOD CARDS */

.premium-food-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
}

.premium-food-card {
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: white;
  transition: transform .25s, box-shadow .25s, border-color .25s;
}

.premium-food-card:hover {
  transform: translateY(-5px);
  border-color: #c7d9cc;
  box-shadow: 0 18px 40px #102b2012;
}

.premium-food-card.is-selected {
  border-color: var(--red);
  box-shadow: 0 0 0 2px #176b4910;
}

.premium-food-image {
  position: relative;
  height: 205px;
  overflow: hidden;
  background: #edf3ee;
}

.premium-food-photo {
  object-fit: cover;
  transition: transform .5s;
}

.premium-food-card:hover .premium-food-photo {
  transform: scale(1.045);
}

.food-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #8ba495;
}

.food-placeholder span {
  font-size: 8px;
  letter-spacing: 2px;
}

.food-index {
  position: absolute;
  top: 13px;
  left: 13px;
  padding: 7px 10px;
  border-radius: 5px;
  background: #101713dd;
  color: white;
  font-size: 9px;
}

.food-type-badge {
  position: absolute;
  top: 13px;
  right: 13px;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 7px 10px;
  border-radius: 6px;
  background: white;
  font-size: 9px;
  font-weight: 900;
  box-shadow: 0 3px 10px #00000012;
}

.food-type-badge.veg {
  color: #16844d;
}

.food-type-badge.nonveg {
  color: #a83a35;
}

.premium-food-info {
  padding: 19px;
}

.premium-food-category {
  color: var(--red);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1.3px;
}

.premium-food-info h3 {
  margin: 10px 0 8px;
  font-family: 'Manrope', sans-serif;
  font-size: 17px;
  letter-spacing: -.5px;
  line-height: 1.4;
}

.premium-food-description {
  min-height: 36px;
  margin: 0;
  color: var(--muted);
  font-size: 11px;
  line-height: 1.7;
}

.premium-food-bottom {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 20px;
}

.premium-food-price {
  font-family: 'Manrope', sans-serif;
  font-size: 20px;
  letter-spacing: -.5px;
}

.premium-add-button {
  min-height: 39px;
  padding: 0 15px;
  display: flex;
  align-items: center;
  gap: 8px;
  border: 0;
  border-radius: 7px;
  background: linear-gradient(120deg, #21865c, #105238);
  color: white;
  font-size: 10px;
  font-weight: 800;
  cursor: pointer;
  box-shadow: 0 5px 13px #176b4925;
  transition: .2s;
}

.premium-add-button:hover {
  background: linear-gradient(120deg, #27986a, #176b49);
  transform: translateY(-2px);
}

.premium-quantity {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}

.premium-quantity strong {
  min-width: 17px;
  text-align: center;
  font-size: 12px;
}

.premium-quantity button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 6px;
  background: white;
  color: var(--black);
  cursor: pointer;
}

.premium-quantity button:hover:not(:disabled) {
  background: var(--red);
  color: white;
}

.premium-quantity button:disabled {
  opacity: .4;
  cursor: not-allowed;
}

/* CHECKOUT */

.premium-checkout {
  margin-top: 60px;
  padding: 30px;
  border: 1px solid #dfe9e1;
  border-radius: 16px;
  background: linear-gradient(145deg, #fff, #f7faf7);
  box-shadow: 0 15px 45px #102b200b;
}

.checkout-heading {
  display: flex;
  align-items: center;
  gap: 15px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--border);
}

.checkout-icon {
  width: 47px;
  height: 47px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 11px;
  background: linear-gradient(145deg, #1d7651, #0b3828);
  color: white;
}

.checkout-heading h2 {
  margin: 6px 0;
  font-family: 'Manrope', sans-serif;
  font-size: 22px;
}

.checkout-heading p {
  margin: 0;
  color: var(--muted);
  font-size: 11px;
}

.checkout-total {
  margin-left: auto;
  font-family: 'Manrope', sans-serif;
  font-size: 24px;
}

.checkout-items {
  padding: 19px 0;
  border-bottom: 1px solid var(--border);
}

.checkout-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 15px;
  padding: 11px 0;
  font-size: 12px;
}

.checkout-item div span {
  display: block;
  margin-top: 5px;
  color: var(--muted);
}

.checkout-form {
  padding-top: 24px;
}

.checkout-form-heading p {
  color: var(--muted);
  font-size: 12px;
}

.checkout-field-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-top: 22px;
}

.premium-field {
  display: flex;
  flex-direction: column;
  gap: 9px;
  font-size: 11px;
  font-weight: 800;
}

.premium-field input,
.premium-field textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px;
  outline: 0;
  background: var(--surface);
  color: var(--black);
  font-size: 13px;
  transition: .2s;
}

.premium-field input:focus,
.premium-field textarea:focus {
  border-color: var(--red);
  background: white;
  box-shadow: 0 0 0 3px #176b4910;
}

.notes-field {
  margin-top: 19px;
}

.checkout-payment {
  display: flex;
  align-items: center;
  gap: 13px;
  margin: 23px 0;
  padding: 17px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: #f1f7f2;
}

.cash-symbol {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: white;
  color: #176b49;
  font-weight: 900;
}

.checkout-payment strong,
.checkout-payment span {
  display: block;
}

.checkout-payment div:nth-child(2) span {
  margin-top: 5px;
  color: var(--muted);
  font-size: 10px;
}

.cash-badge {
  margin-left: auto;
  color: #16844d;
  font-size: 9px;
  font-weight: 900;
}

/* BUTTONS */

.premium-button {
  min-height: 49px;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 0;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  transition: .2s;
}

.premium-button-black {
  background: linear-gradient(120deg, #17231c, #0c4933);
  color: white;
  box-shadow: 0 7px 18px #102b2025;
}

.premium-button-black:hover:not(:disabled) {
  background: linear-gradient(120deg, #21865c, #105238);
  transform: translateY(-2px);
}

.premium-button-outline {
  border: 1px solid var(--black);
  background: white;
  color: var(--black);
}

.place-order-button {
  width: 100%;
}

.place-order-button:disabled {
  opacity: .5;
  cursor: not-allowed;
}

.place-order-button span {
  margin-left: auto;
}

.checkout-terms,
.premium-footnote {
  margin-top: 16px;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.6;
  text-align: center;
}

.premium-notice {
  display: flex;
  align-items: center;
  gap: 9px;
  margin: 15px 0;
  padding: 13px;
  border-radius: 8px;
  background: var(--red-soft);
  color: var(--red-dark);
  font-size: 12px;
}

/* EMPTY / LOADING / SUCCESS */

.premium-empty,
.premium-state {
  padding: 70px 20px;
  color: var(--muted);
  text-align: center;
}

.premium-empty h3,
.premium-state h2 {
  margin: 15px 0 8px;
  color: var(--black);
  font-family: 'Manrope', sans-serif;
}

.premium-state p,
.premium-empty p {
  font-size: 12px;
  line-height: 1.7;
}

.premium-state .premium-button {
  margin: 20px auto 0;
}

.premium-error svg {
  color: var(--red);
}

.premium-success {
  max-width: 570px;
  margin: 70px auto;
  padding: 35px;
  text-align: center;
}

.success-icon {
  margin-bottom: 22px;
  color: #16844d;
}

.premium-success h1 {
  margin: 15px 0;
  font-family: 'Manrope', sans-serif;
  font-size: 48px;
  letter-spacing: -2.5px;
}

.success-description {
  color: var(--muted);
  font-size: 13px;
  line-height: 1.8;
}

.success-receipt {
  margin: 28px 0;
  padding: 22px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  text-align: left;
}

.receipt-row,
.receipt-total {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 13px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}

.receipt-row span,
.receipt-total span {
  color: var(--muted);
}

.receipt-total {
  border: 0;
  padding-bottom: 0;
  font-size: 14px;
}

.success-back {
  margin: auto;
}

/* FOOTER */

.premium-menu-footer {
  width: 86%;
  margin: 65px auto 0;
  padding: 24px 0;
  display: flex;
  align-items: center;
  gap: 16px;
  border-top: 1px solid var(--border);
  color: var(--muted);
  font-size: 10px;
}

.premium-footer-brand {
  color: var(--black);
  font-family: 'Manrope', sans-serif;
  font-size: 18px;
  font-weight: 900;
  text-decoration: none;
  letter-spacing: -.7px;
}

.premium-footer-brand span {
  color: var(--red);
}

.footer-table {
  margin-left: auto;
}

/* STICKY CART */

.premium-sticky-cart {
  position: fixed;
  z-index: 20;
  bottom: 18px;
  left: 50%;
  width: min(520px, calc(100% - 30px));
  min-height: 66px;
  padding: 13px 18px;
  display: flex;
  align-items: center;
  gap: 13px;
  transform: translateX(-50%);
  border: 1px solid #ffffff20;
  border-radius: 12px;
  background: linear-gradient(115deg, #17231c, #0b3b29);
  color: white;
  box-shadow: 0 12px 40px #0004;
  cursor: pointer;
  text-align: left;
  transition: .2s;
}

.premium-sticky-cart:hover {
  background: linear-gradient(115deg, #21865c, #105238);
}

.sticky-cart-count {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  background: linear-gradient(145deg, #36a875, #176b49);
  font-size: 12px;
  font-weight: 900;
}

.premium-sticky-cart small {
  display: block;
  margin-top: 4px;
  color: #c1d0c6;
  font-size: 10px;
}

.sticky-cart-total {
  margin-left: auto;
  font-size: 14px;
}

/* ANIMATIONS */

.premium-spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* TABLET */

@media (max-width: 900px) {
  .hero-visual {
    right: 2%;
    opacity: .35;
  }

  .premium-food-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 15px;
  }

  .premium-food-image {
    height: 165px;
  }
}

/* MOBILE */

@media (max-width: 600px) {
  .premium-menu-header {
    height: 66px;
    padding: 0 17px;
  }

  .premium-brand {
    font-size: 20px;
  }

  .premium-brand-mark {
    width: 39px;
    height: 39px;
  }

  .premium-hero {
    width: calc(100% - 26px);
    min-height: 390px;
    margin: 14px auto 38px;
    padding: 35px 22px 85px;
    border-radius: 16px;
  }

  .hero-copy h1 {
    font-size: clamp(43px, 12vw, 55px);
    letter-spacing: -3px;
  }

  .hero-copy > p {
    max-width: 275px;
    font-size: 12px;
  }

  .hero-meta {
    gap: 12px;
    font-size: 10px;
  }

  .hero-visual {
    top: 45%;
    right: -75px;
    opacity: .2;
  }

  .hero-bottom {
    right: 20px;
    left: 20px;
    font-size: 9px;
  }

  .premium-menu-content,
  .premium-menu-footer {
    width: calc(100% - 26px);
  }

  .table-assistance {
    padding: 18px;
    margin-bottom: 40px;
  }

  .assistance-copy {
    align-items: flex-start;
  }

  .assistance-copy h3 {
    font-size: 17px;
  }

  .need-options {
    grid-template-columns: 1fr;
  }

  .need-option {
    min-height: 49px;
  }

  .menu-heading h2 {
    font-size: 30px;
    letter-spacing: -1.3px;
  }

  .premium-food-grid {
    gap: 11px;
  }

  .premium-food-image {
    height: 130px;
  }

  .premium-food-info {
    padding: 12px;
  }

  .premium-food-category {
    font-size: 8px;
  }

  .premium-food-info h3 {
    font-size: 13px;
  }

  .premium-food-description {
    min-height: 34px;
    font-size: 10px;
  }

  .premium-food-price {
    font-size: 16px;
  }

  .premium-add-button {
    min-height: 35px;
    padding: 0 10px;
    font-size: 9px;
  }

  .premium-quantity {
    gap: 7px;
  }

  .premium-quantity button {
    width: 27px;
    height: 27px;
  }

  .food-type-badge {
    padding: 5px 6px;
    font-size: 7px;
  }

  .premium-checkout {
    margin-top: 40px;
    padding: 18px;
    border-radius: 12px;
  }

  .checkout-heading h2 {
    font-size: 19px;
  }

  .checkout-total {
    font-size: 18px;
  }

  .checkout-field-grid {
    grid-template-columns: 1fr;
  }

  .premium-success {
    margin: 35px auto;
    padding: 20px;
  }

  .premium-success h1 {
    font-size: 39px;
  }

  .premium-menu-footer {
    margin-top: 45px;
    flex-wrap: wrap;
  }

  .premium-menu-footer > span:nth-child(2) {
    display: none;
  }

  .premium-sticky-cart {
    bottom: 12px;
    min-height: 62px;
    padding: 11px 14px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .premium-menu *,
  .premium-menu *::before,
  .premium-menu *::after {
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}
      `}</style>
    </main>
  );
}
