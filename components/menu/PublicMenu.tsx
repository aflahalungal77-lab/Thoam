
"use client";

import { useMemo, useState } from "react";
import MenuProductCard, {
  type MenuProduct,
} from "./MenuProductCard";
import MenuCart, { type CartItem } from "./MenuCart";
import WhatsAppOrderForm, {
  type CustomerOrderForm,
} from "./WhatsAppOrderForm";
import {
  createWhatsAppOrderMessage,
  getWhatsAppUrl,
} from "@/lib/whatsapp";

interface Props {
  restaurant: {
    id: string;
    name: string;
    slug: string;
    whatsapp_number: string;
    logo_url?: string | null;
    description?: string | null;
    delivery_fee?: number | null;
    is_open?: boolean;
  };
  products: MenuProduct[];
}

export default function PublicMenu({
  restaurant,
  products,
}: Props) {
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          products
            .map((product) => product.category)
            .filter((value): value is string => Boolean(value))
        )
      ),
    ],
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesSearch = product.name
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesCategory =
        category === "All" || product.category === category;

      return matchesSearch && matchesCategory;
    });
  }, [products, search, category]);

  const cartItems = Object.values(cart);

  const subtotal = cartItems.reduce(
    (sum, item) =>
      sum + Number(item.product.price) * item.quantity,
    0
  );

  function addProduct(product: MenuProduct) {
    setCart((previous) => {
      const existing = previous[product.id];

      return {
        ...previous,
        [product.id]: {
          product,
          quantity: (existing?.quantity ?? 0) + 1,
        },
      };
    });
  }

  function removeProduct(productId: string) {
    setCart((previous) => {
      const existing = previous[productId];

      if (!existing || existing.quantity <= 1) {
        const next = { ...previous };
        delete next[productId];
        return next;
      }

      return {
        ...previous,
        [productId]: {
          ...existing,
          quantity: existing.quantity - 1,
        },
      };
    });
  }

  async function submitOrder(form: CustomerOrderForm) {
    setError("");

    if (cartItems.length === 0) {
      setError("Your cart is empty.");
      setShowCheckout(false);
      return;
    }

    if (!restaurant.is_open) {
      setError("This restaurant is currently closed.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/whatsapp-orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          restaurantSlug: restaurant.slug,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          orderType: form.orderType,
          address: form.address,
          notes: form.notes,
          items: cartItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not place your order."
        );
      }

      const message = createWhatsAppOrderMessage({
        orderNumber: result.order.orderNumber,
        restaurantName: restaurant.name,
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        orderType: form.orderType,
        address: form.address,
        notes: form.notes,
        items: result.order.items,
        subtotal: result.order.subtotal,
        deliveryFee: result.order.deliveryFee,
        total: result.order.total,
      });

      const whatsappUrl = getWhatsAppUrl(
        result.order.whatsappNumber,
        message
      );

      window.location.assign(whatsappUrl);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  if (showCheckout) {
    return (
      <main className="thoam-checkout">
        <div className="checkout-inner">
          <button
            type="button"
            className="back-button"
            onClick={() => setShowCheckout(false)}
          >
            <span aria-hidden="true">←</span> Back to Menu
          </button>

          <div className="checkout-heading">
            <p className="eyebrow">ALMOST THERE</p>
            <h1>Complete your order</h1>
            <p>Review your items and enter your details.</p>
          </div>

          <section className="order-summary">
            <h2>Order summary</h2>

            {cartItems.map(({ product, quantity }) => (
              <div className="summary-row" key={product.id}>
                <span>
                  {product.name} <span className="quantity">× {quantity}</span>
                </span>
                <span>
                  ₹{(Number(product.price) * quantity).toFixed(2)}
                </span>
              </div>
            ))}

            <div className="summary-total">
              <span>Subtotal</span>
              <strong>₹{subtotal.toFixed(2)}</strong>
            </div>
          </section>

          {error && (
            <p role="alert" className="menu-error">
              {error}
            </p>
          )}

          <WhatsAppOrderForm
            loading={loading}
            onSubmit={submitOrder}
            onCancel={() => setShowCheckout(false)}
          />
        </div>

        <style jsx>{`
          .thoam-checkout {
            min-height: 100vh;
            padding: 32px 18px 64px;
            background: #f8f7f4;
            color: #191916;
            font-family: Arial, sans-serif;
          }

          .checkout-inner {
            width: 100%;
            max-width: 570px;
            margin: 0 auto;
          }

          .back-button {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 30px;
            padding: 10px 0;
            color: #625f56;
            font-size: 13px;
            font-weight: 700;
          }

          .back-button:hover {
            color: #191916;
          }

          .back-button span {
            font-size: 19px;
          }

          .checkout-heading {
            margin-bottom: 25px;
          }

          .eyebrow {
            margin-bottom: 10px;
            color: #8b8578;
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.22em;
          }

          .checkout-heading h1 {
            font-size: clamp(28px, 5vw, 38px);
            font-weight: 850;
            letter-spacing: -1.4px;
            line-height: 1.12;
          }

          .checkout-heading > p:last-child {
            margin-top: 9px;
            color: #77766f;
            font-size: 13px;
            line-height: 1.7;
          }

          .order-summary {
            margin-bottom: 20px;
            padding: 22px;
            border: 1px solid #e9e5dc;
            border-radius: 19px;
            background: #fff;
            box-shadow: 0 8px 28px rgb(30 25 15 / 4%);
          }

          .order-summary h2 {
            margin-bottom: 18px;
            font-size: 17px;
            font-weight: 800;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-top: 14px;
            color: #4f4c44;
            font-size: 13px;
          }

          .summary-row > span:last-child {
            flex-shrink: 0;
            color: #22221e;
            font-weight: 700;
          }

          .quantity {
            color: #8a867c;
          }

          .summary-total {
            display: flex;
            justify-content: space-between;
            gap: 16px;
            margin-top: 20px;
            padding-top: 17px;
            border-top: 1px solid #ece9e2;
            font-size: 13px;
          }

          .summary-total strong {
            font-size: 18px;
            font-weight: 850;
          }

          .menu-error {
            margin-bottom: 16px;
            padding: 13px 15px;
            border: 1px solid #f0d2ce;
            border-radius: 12px;
            background: #fff5f3;
            color: #a52e25;
            font-size: 13px;
            line-height: 1.6;
          }

          @media (max-width: 480px) {
            .thoam-checkout {
              padding: 22px 14px 42px;
            }

            .order-summary {
              padding: 18px;
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="thoam-menu">
      <header className="restaurant-header">
        <div className="header-inner">
          <div className="brand-row">
            {restaurant.logo_url ? (
              <img
                className="restaurant-logo"
                src={restaurant.logo_url}
                alt={`${restaurant.name} logo`}
              />
            ) : (
              <div className="brand-mark" aria-hidden="true">
                T<span>.</span>
              </div>
            )}

            <div className="brand-copy">
              <p className="brand-name">THO&apos;AM</p>
              <p className="brand-caption">THE FOOD MENU</p>
            </div>
          </div>

          <div className="restaurant-intro">
            <div className="restaurant-copy">
              <p className="section-eyebrow">MADE FOR YOUR CRAVINGS</p>
              <h1>{restaurant.name}</h1>

              {restaurant.description && (
                <p className="restaurant-description">
                  {restaurant.description}
                </p>
              )}

              <div className="restaurant-meta">
                <span
                  className={`status-pill ${
                    restaurant.is_open ? "is-open" : "is-closed"
                  }`}
                >
                  <span className="status-dot" />
                  {restaurant.is_open ? "Open now" : "Currently closed"}
                </span>

                <span className="meta-divider" />

                <span className="menu-label">Freshly listed menu</span>
              </div>
            </div>

            <div className="header-decoration" aria-hidden="true">
              <span className="decoration-circle circle-one" />
              <span className="decoration-circle circle-two" />
              <span className="decoration-letter">T</span>
            </div>
          </div>
        </div>
      </header>

      <div className="menu-layout">
        <section className="menu-content">
          <div className="menu-section-heading">
            <div>
              <p className="section-eyebrow">EXPLORE THE MENU</p>
              <h2>Find your favourite</h2>
            </div>

            <span className="item-count">
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "item" : "items"}
            </span>
          </div>

          <label className="search-box">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="search-icon"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4 4" />
            </svg>

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search dishes..."
              aria-label="Search food"
            />

            {search && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </label>

          <div className="category-list" aria-label="Food categories">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`category-button ${
                  category === item ? "active" : ""
                }`}
                aria-pressed={category === item}
              >
                {item}
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <div className="empty-results">
              <span className="empty-icon" aria-hidden="true">
                ⌕
              </span>
              <h3>No dishes found</h3>
              <p>Try another search or choose a different category.</p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <MenuProductCard
                  key={product.id}
                  product={product}
                  quantity={cart[product.id]?.quantity ?? 0}
                  onAdd={addProduct}
                  onRemove={removeProduct}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="cart-sidebar">
          {error && (
            <p role="alert" className="menu-error">
              {error}
            </p>
          )}

          <MenuCart
            items={cartItems}
            onIncrease={addProduct}
            onDecrease={removeProduct}
            onCheckout={() => {
              if (!restaurant.is_open) {
                setError("This restaurant is currently closed.");
                return;
              }

              setError("");
              setShowCheckout(true);
            }}
          />

          <div className="trust-note">
            <span className="trust-icon" aria-hidden="true">
              ✓
            </span>
            <p>
              <strong>Direct ordering</strong>
              <span>Your order goes straight to the restaurant.</span>
            </p>
          </div>
        </aside>
      </div>

      <footer className="menu-footer">
        <span>THO&apos;AM</span>
        <span>GOOD FOOD. GOOD MOOD.</span>
      </footer>

      <style jsx>{`
        .thoam-menu {
          --ink: #191916;
          --muted: #77766f;
          --border: #eae7df;
          min-height: 100vh;
          background: #f8f7f4;
          color: var(--ink);
          font-family: Arial, Helvetica, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .restaurant-header {
          overflow: hidden;
          border-bottom: 1px solid #e9e5dc;
          background:
            radial-gradient(
              ellipse at 95% 20%,
              rgba(222, 215, 199, 0.36),
              transparent 42%
            ),
            #fff;
        }

        .header-inner {
          max-width: 1180px;
          margin: 0 auto;
          padding: 25px 28px 38px;
        }

        .brand-row {
          display: flex;
          align-items: center;
          gap: 11px;
          padding-bottom: 23px;
          border-bottom: 1px solid #f0eee8;
        }

        .brand-mark,
        .restaurant-logo {
          display: grid;
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 14px;
          background: #191916;
          color: #fff;
          font-size: 22px;
          font-weight: 850;
          object-fit: cover;
        }

        .brand-mark span {
          color: #d4c6a7;
        }

        .brand-copy {
          display: grid;
          gap: 4px;
        }

        .brand-name {
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.17em;
        }

        .brand-caption {
          color: #89857a;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.16em;
        }

        .restaurant-intro {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 220px;
          padding-top: 33px;
        }

        .restaurant-copy {
          position: relative;
          z-index: 1;
          max-width: 690px;
        }

        .section-eyebrow {
          color: #898375;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.2em;
          line-height: 1.6;
        }

        .restaurant-copy h1 {
          margin-top: 12px;
          font-size: clamp(36px, 5vw, 58px);
          font-weight: 850;
          letter-spacing: -2.5px;
          line-height: 1.05;
          overflow-wrap: anywhere;
        }

        .restaurant-description {
          max-width: 520px;
          margin-top: 13px;
          color: #77766f;
          font-size: 14px;
          line-height: 1.8;
        }

        .restaurant-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 13px;
          margin-top: 22px;
        }

        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 12px;
          border: 1px solid #e8e6de;
          border-radius: 999px;
          background: #fff;
          font-size: 11px;
          font-weight: 750;
        }

        .status-pill.is-open {
          color: #386c45;
        }

        .status-pill.is-closed {
          color: #a34237;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: currentColor;
        }

        .meta-divider {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #c7c2b6;
        }

        .menu-label {
          color: #8b877d;
          font-size: 11px;
        }

        .header-decoration {
          position: absolute;
          top: 24px;
          right: 12px;
          width: 220px;
          height: 200px;
          pointer-events: none;
        }

        .decoration-circle {
          position: absolute;
          display: block;
          border: 1px solid rgba(160, 150, 130, 0.2);
          border-radius: 50%;
        }

        .circle-one {
          top: 5px;
          right: 0;
          width: 180px;
          height: 180px;
        }

        .circle-two {
          top: 28px;
          right: 23px;
          width: 134px;
          height: 134px;
          background: rgba(232, 227, 215, 0.3);
        }

        .decoration-letter {
          position: absolute;
          top: 22px;
          right: 40px;
          color: rgba(25, 25, 22, 0.08);
          font-family: Georgia, serif;
          font-size: 145px;
          font-weight: 700;
          line-height: 1;
        }

        .menu-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 320px;
          align-items: start;
          gap: 30px;
          max-width: 1180px;
          margin: 0 auto;
          padding: 36px 28px 65px;
        }

        .menu-content {
          min-width: 0;
        }

        .menu-section-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 21px;
        }

        .menu-section-heading h2 {
          margin-top: 7px;
          font-size: clamp(23px, 3vw, 30px);
          font-weight: 850;
          letter-spacing: -1.1px;
          line-height: 1.2;
        }

        .item-count {
          padding: 7px 10px;
          border: 1px solid #e9e5dc;
          border-radius: 999px;
          background: #fff;
          color: #777268;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 54px;
          padding: 0 16px;
          border: 1px solid #e5e1d8;
          border-radius: 15px;
          background: #fff;
          box-shadow: 0 4px 14px rgb(30 25 15 / 3%);
          transition: border-color 180ms ease, box-shadow 180ms ease;
        }

        .search-box:focus-within {
          border-color: #a9a294;
          box-shadow: 0 0 0 4px rgb(70 65 50 / 5%);
        }

        .search-icon {
          width: 19px;
          height: 19px;
          flex-shrink: 0;
          fill: none;
          stroke: #8d897e;
          stroke-width: 1.7;
          stroke-linecap: round;
        }

        .search-box input {
          width: 100%;
          min-width: 0;
          height: 50px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #191916;
          font: inherit;
          font-size: 13px;
        }

        .search-box input::placeholder {
          color: #a19d93;
        }

        .search-box input::-webkit-search-cancel-button {
          display: none;
        }

        .clear-search {
          display: grid;
          width: 27px;
          height: 27px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 50%;
          background: #f1efe9;
          color: #5e5b52;
          font-size: 20px;
        }

        .category-list {
          display: flex;
          gap: 9px;
          overflow-x: auto;
          margin: 17px 0 25px;
          padding-bottom: 3px;
          scrollbar-width: none;
        }

        .category-list::-webkit-scrollbar {
          display: none;
        }

        .category-button {
          min-height: 40px;
          padding: 0 17px;
          border: 1px solid #e5e1d8;
          border-radius: 999px;
          background: #fff;
          color: #666258;
          font-size: 12px;
          font-weight: 700;
          white-space: nowrap;
          transition: all 180ms ease;
        }

        .category-button:hover {
          border-color: #777268;
          color: #191916;
        }

        .category-button.active {
          border-color: #191916;
          background: #191916;
          color: #fff;
          box-shadow: 0 4px 10px rgb(25 25 22 / 12%);
        }

        .product-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          align-items: stretch;
          gap: 19px;
        }

        .cart-sidebar {
          position: sticky;
          top: 24px;
          min-width: 0;
        }

        .trust-note {
          display: flex;
          align-items: flex-start;
          gap: 11px;
          margin-top: 16px;
          padding: 15px;
          border: 1px solid #ebe7dd;
          border-radius: 15px;
          background: rgba(255, 255, 255, 0.65);
        }

        .trust-icon {
          display: grid;
          width: 25px;
          height: 25px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 50%;
          background: #e9eee5;
          color: #456747;
          font-size: 12px;
          font-weight: 800;
        }

        .trust-note p {
          display: grid;
          gap: 4px;
        }

        .trust-note strong {
          font-size: 11px;
          font-weight: 800;
        }

        .trust-note p span {
          color: #88847a;
          font-size: 11px;
          line-height: 1.6;
        }

        .menu-error {
          margin-bottom: 14px;
          padding: 13px;
          border: 1px solid #f0d2ce;
          border-radius: 12px;
          background: #fff5f3;
          color: #a52e25;
          font-size: 12px;
          line-height: 1.6;
        }

        .empty-results {
          display: grid;
          justify-items: center;
          padding: 55px 20px;
          border: 1px dashed #ded9ce;
          border-radius: 19px;
          background: rgba(255, 255, 255, 0.65);
          text-align: center;
        }

        .empty-icon {
          color: #8a8579;
          font-size: 36px;
        }

        .empty-results h3 {
          margin-top: 12px;
          font-size: 17px;
          font-weight: 800;
        }

        .empty-results p {
          margin-top: 7px;
          color: #858176;
          font-size: 12px;
          line-height: 1.7;
        }

        .empty-results button {
          margin-top: 17px;
          padding: 10px 15px;
          border-radius: 10px;
          background: #191916;
          color: white;
          font-size: 12px;
          font-weight: 700;
        }

        .menu-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          max-width: 1180px;
          margin: 0 auto;
          padding: 22px 28px;
          border-top: 1px solid #e9e5dc;
          color: #8b877d;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.17em;
        }

        .menu-footer span:first-child {
          color: #38372f;
          font-size: 11px;
        }

        @media (min-width: 1200px) {
          .product-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1023px) {
          .menu-layout {
            grid-template-columns: minmax(0, 1fr) 280px;
            gap: 20px;
            padding-inline: 20px;
          }

          .header-inner {
            padding-inline: 20px;
          }

          .product-grid {
            gap: 13px;
          }

          .header-decoration {
            right: -35px;
            opacity: 0.7;
          }
        }

        @media (max-width: 760px) {
          .header-inner {
            padding: 19px 17px 27px;
          }

          .brand-row {
            padding-bottom: 18px;
          }

          .brand-mark,
          .restaurant-logo {
            width: 38px;
            height: 38px;
            border-radius: 12px;
          }

          .restaurant-intro {
            min-height: 0;
            padding-top: 29px;
          }

          .restaurant-copy h1 {
            font-size: clamp(34px, 9vw, 45px);
            letter-spacing: -1.5px;
          }

          .restaurant-description {
            max-width: 90%;
            font-size: 13px;
          }

          .header-decoration {
            top: 35px;
            right: -90px;
            opacity: 0.45;
          }

          .menu-layout {
            grid-template-columns: minmax(0, 1fr);
            gap: 28px;
            padding: 26px 15px 40px;
          }

          .menu-section-heading h2 {
            font-size: 25px;
          }

          .product-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 12px;
          }

          .cart-sidebar {
            position: static;
          }

          .menu-footer {
            padding: 19px 16px;
          }
        }

        @media (max-width: 380px) {
          .product-grid {
            gap: 9px;
          }

          .menu-section-heading h2 {
            font-size: 22px;
          }

          .category-button {
            padding-inline: 14px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .thoam-menu *,
          .thoam-menu *::before,
          .thoam-menu *::after {
            scroll-behavior: auto !important;
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </main>
  );
}
