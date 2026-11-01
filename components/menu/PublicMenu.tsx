"use client";

import { useMemo, useState } from "react";
import MenuProductCard, { type MenuProduct } from "./MenuProductCard";
import MenuCart, { type CartItem } from "./MenuCart";
import WhatsAppOrderForm, {
  type CustomerOrderForm,
} from "./WhatsAppOrderForm";
import {
  createWhatsAppOrderMessage,
  getWhatsAppUrl,
} from "@/lib/whatsapp";
import {
  Search,
  ArrowLeft,
  ArrowRight,
  ShoppingBag,
  Utensils,
  Clock3,
  CheckCircle2,
  X,
  Sparkles,
} from "lucide-react";

export interface MenuOffer {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  scope: "order" | "products";
  discount_type: "percentage" | "fixed";
  discount_value: number;
  product_ids: string[] | null;
  min_order_amount: number;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
}

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
  offers: MenuOffer[];
}

export default function PublicMenu({ restaurant, products, offers }: Props) {
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

  const cartCount = cartItems.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

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
        throw new Error(result.error || "Could not place your order.");
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
        <div className="checkout-topbar">
          <button
            type="button"
            className="checkout-back"
            onClick={() => setShowCheckout(false)}
          >
            <ArrowLeft size={17} />
            Back to menu
          </button>

          <span className="checkout-brand">THO'AM.</span>
        </div>

        <div className="checkout-container">
          <div className="checkout-heading">
            <span className="checkout-kicker">
              <span className="checkout-kicker-dot" />
              FINAL STEP
            </span>

            <h1>Complete your order<span>.</span></h1>
            <p>
              A few details and your order will be on its way to the restaurant.
            </p>
          </div>

          <section className="checkout-summary">
            <div className="summary-heading">
              <div>
                <span className="summary-kicker">YOUR SELECTION</span>
                <h2>Order summary</h2>
              </div>

              <span className="summary-count">
                {cartCount} items
              </span>
            </div>

            <div className="summary-items">
              {cartItems.map(({ product, quantity }) => (
                <div className="summary-row" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>Quantity × {quantity}</span>
                  </div>

                  <strong>
                    ₹{(Number(product.price) * quantity).toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="summary-total">
              <span>Subtotal</span>
              <strong>₹{subtotal.toFixed(2)}</strong>
            </div>
          </section>

          {error && (
            <div role="alert" className="checkout-error">
              <X size={17} />
              {error}
            </div>
          )}

          <div className="checkout-form-card">
            <div className="checkout-form-heading">
              <span className="summary-kicker">CUSTOMER DETAILS</span>
              <h2>Where should we reach you?</h2>
            </div>

            <WhatsAppOrderForm
              loading={loading}
              onSubmit={submitOrder}
              onCancel={() => setShowCheckout(false)}
            />
          </div>

          <p className="checkout-secure-note">
            <CheckCircle2 size={15} />
            Your order details will be shared with the restaurant.
          </p>
        </div>

        <style jsx>{`
          .thoam-checkout {
            min-height: 100vh;
            padding: 0 20px 60px;
            background: #f7f7f5;
            color: #171715;
            font-family: Arial, Helvetica, sans-serif;
          }

          .checkout-topbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            max-width: 900px;
            margin: 0 auto;
            padding: 23px 0;
            border-bottom: 1px solid #e9e9e5;
          }

          .checkout-back {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            padding: 10px 0;
            color: #65655e;
            font-size: 13px;
            font-weight: 700;
          }

          .checkout-back:hover {
            color: #171715;
          }

          .checkout-brand {
            font-size: 15px;
            font-weight: 950;
            letter-spacing: .13em;
          }

          .checkout-container {
            width: 100%;
            max-width: 570px;
            margin: 55px auto 0;
          }

          .checkout-kicker {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #77776e;
            font-size: 10px;
            font-weight: 850;
            letter-spacing: .2em;
          }

          .checkout-kicker-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: #24241f;
          }

          .checkout-heading h1 {
            margin-top: 15px;
            font-size: clamp(32px, 6vw, 43px);
            font-weight: 900;
            letter-spacing: -2px;
            line-height: 1.12;
          }

          .checkout-heading h1 span {
            color: #99998f;
          }

          .checkout-heading p {
            margin-top: 11px;
            color: #77776f;
            font-size: 13px;
            line-height: 1.8;
          }

          .checkout-summary,
          .checkout-form-card {
            margin-top: 25px;
            padding: 24px;
            border: 1px solid #e9e9e4;
            border-radius: 20px;
            background: #fff;
            box-shadow: 0 8px 30px rgb(0 0 0 / 3%);
          }

          .summary-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 22px;
          }

          .summary-kicker {
            color: #8b8b80;
            font-size: 9px;
            font-weight: 850;
            letter-spacing: .17em;
          }

          .summary-heading h2,
          .checkout-form-heading h2 {
            margin-top: 7px;
            font-size: 18px;
            font-weight: 850;
            letter-spacing: -.5px;
          }

          .summary-count {
            padding: 8px 11px;
            border: 1px solid #e9e9e5;
            border-radius: 30px;
            color: #77776f;
            font-size: 11px;
            font-weight: 700;
          }

          .summary-items {
            display: grid;
            gap: 17px;
          }

          .summary-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            gap: 15px;
            font-size: 13px;
          }

          .summary-row div {
            display: grid;
            gap: 5px;
          }

          .summary-row div strong {
            font-size: 13px;
            font-weight: 750;
          }

          .summary-row div span {
            color: #8b8b82;
            font-size: 11px;
          }

          .summary-row > strong {
            flex-shrink: 0;
            font-size: 13px;
          }

          .summary-total {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
            margin-top: 22px;
            padding-top: 19px;
            border-top: 1px solid #ecece7;
            color: #62625a;
            font-size: 13px;
            font-weight: 700;
          }

          .summary-total strong {
            color: #171715;
            font-size: 21px;
            font-weight: 900;
          }

          .checkout-form-heading {
            margin-bottom: 20px;
          }

          .checkout-error {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-top: 17px;
            padding: 13px 15px;
            border: 1px solid #f0d2ce;
            border-radius: 12px;
            background: #fff5f3;
            color: #a52e25;
            font-size: 12px;
          }

          .checkout-secure-note {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 7px;
            margin-top: 22px;
            color: #85857b;
            font-size: 11px;
          }

          @media (max-width: 480px) {
            .thoam-checkout {
              padding-inline: 15px;
            }

            .checkout-container {
              margin-top: 35px;
            }

            .checkout-summary,
            .checkout-form-card {
              padding: 19px;
              border-radius: 17px;
            }
          }
  
/* PREMIUM MENU POLISH */
.thoam-menu{background:#f5f5f2;--ink:#171715;--muted:#77776f;--border:#e7e7e0}
.restaurant-header{background:radial-gradient(ellipse at 82% 48%,#f0f0eb 0%,#fff 43%);border-bottom-color:#e5e5de}
.header-top{border-bottom-color:#e9e9e3}
.header-brand strong{font-size:15px;letter-spacing:.18em}
.brand-mark,.restaurant-logo{border:1px solid #e4e4dc;box-shadow:0 5px 18px rgb(0 0 0 / 8%)}
.header-tag{background:#fff;box-shadow:0 3px 12px rgb(0 0 0 / 3%)}
.hero-content{min-height:350px}
.hero-copy h1{max-width:760px;text-wrap:balance}
.hero-graphic{opacity:.82}
.hero-graphic-ring{border-color:#deded6}
.hero-graphic-center{background:linear-gradient(145deg,#fff,#e9e9e3);box-shadow:0 18px 45px rgb(0 0 0 / 5%),inset 0 0 30px rgb(0 0 0 / 2%)}
.menu-layout{padding-top:54px}
.menu-section-heading{align-items:center}
.menu-section-heading h2{letter-spacing:-1.9px}
.search-box{min-height:62px;border-color:#e4e4dc;border-radius:16px;box-shadow:0 7px 22px rgb(0 0 0 / 3%)}
.search-box:focus-within{border-color:#77776f;box-shadow:0 0 0 4px rgb(0 0 0 / 4%),0 10px 24px rgb(0 0 0 / 4%)}
.category-button{min-height:43px;padding-inline:20px;border-color:#e4e4dc;background:#fff}
.category-button.active{background:#171715;border-color:#171715}
.cart-sidebar{padding:20px;border-color:#e5e5de;border-radius:22px;box-shadow:0 15px 42px rgb(0 0 0 / 5%)}
.cart-sidebar-heading{margin-bottom:18px}
.trust-card{background:linear-gradient(135deg,#fff,#f6f6f2);border-color:#e7e7e0}
.menu-footer{background:#fff}
.mobile-cart-shortcut{border-radius:17px;box-shadow:0 12px 36px rgb(0 0 0 / 24%)}
.thoam-checkout{background:radial-gradient(ellipse at 50% 0%,#fff 0%,#f5f5f2 65%)}
.checkout-topbar{border-bottom-color:#e5e5de}
.checkout-summary,.checkout-form-card{border-color:#e5e5de;border-radius:22px;box-shadow:0 12px 36px rgb(0 0 0 / 4%)}
.checkout-form-card{padding:24px}
.checkout-heading h1{letter-spacing:-2.2px}
.checkout-secure-note{line-height:1.6}
@media(min-width:1200px){.menu-layout{gap:42px}.product-grid{gap:18px}}
@media(max-width:1023px){.menu-layout{grid-template-columns:minmax(0,1fr) 310px}.cart-sidebar{padding:17px}}
@media(max-width:760px){
 .restaurant-header{padding-inline:16px}
 .hero-content{min-height:250px;padding:34px 0}
 .hero-graphic{right:-150px;opacity:.19}
 .hero-copy{max-width:100%}
 .hero-copy h1{max-width:90%;font-size:clamp(34px,9vw,52px);letter-spacing:-2px}
 .hero-meta{gap:10px;margin-top:20px}
 .hero-bottom{gap:12px;letter-spacing:.1em}
 .menu-layout{padding:30px 14px 44px;gap:25px}
 .menu-section-heading{align-items:flex-end}
 .menu-section-heading h2{font-size:27px}
 .search-box{min-height:55px;border-radius:14px}
 .search-box input{height:53px;font-size:12px}
 .category-header{margin-top:23px}
 .category-button{min-height:39px;padding-inline:15px}
 .cart-sidebar{padding:14px;border-radius:19px}
 .checkout-container{margin-top:30px}
 .checkout-form-card{padding:17px}
}
@media(max-width:390px){
 .header-brand{gap:9px}
 .brand-mark,.restaurant-logo{width:37px;height:37px}
 .header-tag{font-size:7px}
 .hero-copy h1{font-size:34px}
 .hero-bottom{font-size:6px}
 .menu-section-heading h2{font-size:24px}
 .item-count{font-size:8px}
}
@media(prefers-reduced-motion:reduce){.thoam-menu *{scroll-behavior:auto!important}}

      `}</style>
      </main>
    );
  }

  return (
    <main className="thoam-menu">
      {/* HEADER */}
      <header className="restaurant-header">
        <div className="header-top">
          <div className="header-brand">
            {restaurant.logo_url ? (
              <img
                src={restaurant.logo_url}
                alt={`${restaurant.name} logo`}
                className="restaurant-logo"
              />
            ) : (
              <div className="brand-mark">T<span>.</span></div>
            )}

            <div>
              <strong>THO'AM</strong>
              <span>ORDER DIRECTLY</span>
            </div>
          </div>

          <span className="header-tag">
            <Sparkles size={13} />
            DIGITAL MENU
          </span>
        </div>

        <div className="hero-content">
          <div className="hero-copy">
            <span className="hero-eyebrow">
              <span className="hero-eyebrow-line" />
              WELCOME TO
            </span>

            <h1>{restaurant.name}<span>.</span></h1>

            {restaurant.description && (
              <p className="hero-description">
                {restaurant.description}
              </p>
            )}

            <div className="hero-meta">
              <span
                className={`restaurant-status ${
                  restaurant.is_open ? "is-open" : "is-closed"
                }`}
              >
                <span className="status-dot" />
                {restaurant.is_open ? "Open for orders" : "Currently closed"}
              </span>

              <span className="hero-meta-divider" />

              <span className="hero-menu-label">
                <Utensils size={14} />
                Explore our menu
              </span>
            </div>
          </div>

          <div className="hero-graphic" aria-hidden="true">
            <div className="hero-graphic-ring ring-one" />
            <div className="hero-graphic-ring ring-two" />
            <div className="hero-graphic-center">
              <span>T<span>.</span></span>
            </div>
            <div className="hero-graphic-caption">GOOD FOOD, YOUR WAY</div>
          </div>
        </div>

        <div className="hero-bottom">
          <span>MADE FOR YOUR CRAVINGS</span>
          <span>SCROLL TO EXPLORE ↓</span>
        </div>
      </header>

      {/* MENU CONTENT */}
      <div className="menu-layout">
        <section className="menu-content">
          <div className="menu-section-heading">
            <div>
              <span className="section-kicker">THE COLLECTION</span>
              <h2>Explore the menu<span>.</span></h2>
              <p>Find something delicious for today.</p>
            </div>

            <span className="item-count">
              {filteredProducts.length}{" "}
              {filteredProducts.length === 1 ? "ITEM" : "ITEMS"}
            </span>
          </div>

          {/* SEARCH */}
          <label className="search-box">
            <Search size={19} className="search-icon" />

            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search your favourite food..."
              aria-label="Search food"
            />

            {search && (
              <button
                type="button"
                className="clear-search"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </label>

          {/* CATEGORIES */}
          <div className="category-header">
            <span>DISCOVER BY CATEGORY</span>
            <span>{categories.length - 1} categories</span>
          </div>

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

          {/* ACTIVE RESTAURANT OFFERS — display only; checkout pricing remains unchanged */}
          {offers.length > 0 && (
            <section className="public-offers" aria-label="Current restaurant offers">
              <div className="public-offers-heading">
                <span className="public-offers-kicker">LIMITED-TIME DEALS</span>
                <span className="public-offers-count">{offers.length} {offers.length === 1 ? "OFFER" : "OFFERS"}</span>
              </div>
              <div className="public-offers-grid">
                {offers.map((offer) => (
                  <article className="public-offer-card" key={offer.id}>
                    {offer.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="public-offer-image" src={offer.image_url} alt="" />
                    ) : (
                      <div className="public-offer-art" aria-hidden="true"><Sparkles size={22} /></div>
                    )}
                    <div className="public-offer-copy">
                      <span className="public-offer-discount">
                        {offer.discount_type === "percentage"
                          ? `${Number(offer.discount_value)}% OFF`
                          : `₹${Number(offer.discount_value).toFixed(0)} OFF`}
                      </span>
                      <h3>{offer.title}</h3>
                      {offer.description && <p>{offer.description}</p>}
                      <small>
                        {offer.scope === "order" ? "On your order" : "On selected dishes"}
                        {Number(offer.min_order_amount) > 0 ? ` · Min. order ₹${Number(offer.min_order_amount).toFixed(0)}` : ""}
                        {offer.max_discount ? ` · Up to ₹${Number(offer.max_discount).toFixed(0)} off` : ""}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

                    {/* PRODUCTS */}
          {filteredProducts.length === 0 ? (
            <div className="empty-results">
              <div className="empty-symbol">
                <Search size={25} />
              </div>

              <h3>No dishes found</h3>
              <p>
                We couldn't find anything matching your search.
                Try another dish or category.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("All");
                }}
              >
                Clear filters <ArrowRight size={15} />
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

          <div className="menu-bottom-note">
            <span className="menu-bottom-line" />
            <span>MADE WITH CARE. SERVED WITH LOVE.</span>
            <span className="menu-bottom-line" />
          </div>
        </section>

        {/* CART */}
        <aside className="cart-sidebar">
          <div className="cart-sidebar-heading">
            <div>
              <span className="section-kicker">YOUR SELECTION</span>
              <h2>Your cart<span>.</span></h2>
            </div>

            <div className="cart-count">
              <ShoppingBag size={16} />
              {cartCount}
            </div>
          </div>

          {error && (
            <div role="alert" className="menu-error">
              <X size={16} />
              {error}
              <button
                type="button"
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                <X size={14} />
              </button>
            </div>
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

          <div className="trust-card">
            <div className="trust-icon">
              <CheckCircle2 size={18} />
            </div>

            <div>
              <strong>Order directly</strong>
              <p>Your order goes straight to the restaurant.</p>
            </div>
          </div>

          <div className="cart-delivery-note">
            <Clock3 size={14} />
            <span>Order confirmation via WhatsApp</span>
          </div>
        </aside>
      </div>

      {/* FOOTER */}
      <footer className="menu-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <strong>THO'AM<span>.</span></strong>
            <p>Good food. Good moments.</p>
          </div>

          <div className="footer-right">
            <span>POWERED BY THO'AM</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
        </div>
      </footer>

      {/* MOBILE CART SHORTCUT */}
      {cartCount > 0 && (
        <button
          type="button"
          className="mobile-cart-shortcut"
          onClick={() => {
            document.querySelector(".cart-sidebar")?.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }}
        >
          <span className="mobile-cart-icon">
            <ShoppingBag size={18} />
            <span>{cartCount}</span>
          </span>

          <span>View your cart</span>

          <strong>₹{subtotal.toFixed(2)}</strong>
        </button>
      )}

      <style jsx>{`
        
.thoam-menu {
  --ink: #171715;
  --muted: #77776f;
  --border: #e9e9e4;
  --paper: #f8f8f6;
  --white: #ffffff;
  min-height: 100vh;
  overflow: hidden;
  background: var(--paper);
  color: var(--ink);
  font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

.thoam-menu * {
  box-sizing: border-box;
}

.thoam-menu button,
.thoam-menu input {
  font: inherit;
}

.thoam-menu button {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

/* HEADER */

.restaurant-header {
  position: relative;
  overflow: hidden;
  padding: 0 28px;
  background: #fff;
  border-bottom: 1px solid var(--border);
}

.header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 1240px;
  margin: 0 auto;
  padding: 22px 0;
  border-bottom: 1px solid #f0f0eb;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 13px;
}

.brand-mark,
.restaurant-logo {
  display: grid;
  width: 46px;
  height: 46px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 14px;
  background: #171715;
  color: #fff;
  font-size: 23px;
  font-weight: 950;
  object-fit: cover;
  box-shadow: 0 5px 14px rgb(0 0 0 / 10%);
}

.brand-mark span {
  color: #c8c8b9;
}

.header-brand > div:last-child {
  display: grid;
  gap: 5px;
}

.header-brand strong {
  font-size: 14px;
  font-weight: 950;
  letter-spacing: .16em;
}

.header-brand > div:last-child span {
  color: #99998f;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .15em;
}

.header-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 15px;
  border: 1px solid #eaeae4;
  border-radius: 40px;
  background: #fafaf8;
  color: #65655d;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .12em;
  transition: background .2s ease, border-color .2s ease;
}

.header-tag:hover {
  border-color: #c9c9c0;
  background: #f3f3ef;
}

/* HERO */

.hero-content {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 330px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 55px 0;
}

.hero-copy {
  position: relative;
  z-index: 2;
  max-width: 720px;
}

.hero-eyebrow {
  display: flex;
  align-items: center;
  gap: 11px;
  color: #85857b;
  font-size: 10px;
  font-weight: 850;
  letter-spacing: .22em;
}

.hero-eyebrow-line {
  width: 30px;
  height: 1px;
  background: #171715;
}

.hero-copy h1 {
  max-width: 760px;
  margin-top: 19px;
  font-size: clamp(44px, 6vw, 76px);
  font-weight: 950;
  letter-spacing: -4px;
  line-height: 1.01;
  overflow-wrap: anywhere;
}

.hero-copy h1 span,
.menu-section-heading h2 span,
.cart-sidebar-heading h2 span {
  color: #aaa99f;
}

.hero-description {
  max-width: 520px;
  margin-top: 19px;
  color: #77776f;
  font-size: 14px;
  line-height: 1.9;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 28px;
}

.restaurant-status {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  padding: 10px 14px;
  border: 1px solid #e8e8e2;
  border-radius: 40px;
  background: #fff;
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 3px 10px rgb(0 0 0 / 2%);
}

.restaurant-status.is-open {
  color: #347047;
}

.restaurant-status.is-closed {
  color: #a13c32;
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: currentColor;
}

.restaurant-status.is-open .status-dot {
  box-shadow: 0 0 0 4px rgb(52 112 71 / 10%);
}

.restaurant-status.is-closed .status-dot {
  box-shadow: 0 0 0 4px rgb(161 60 50 / 10%);
}

.hero-meta-divider {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #c5c5bb;
}

.hero-menu-label {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #77776e;
  font-size: 11px;
  font-weight: 650;
}

.hero-graphic {
  position: absolute;
  top: 50%;
  right: 30px;
  width: 285px;
  height: 285px;
  transform: translateY(-50%);
  pointer-events: none;
}

.hero-graphic-ring {
  position: absolute;
  border: 1px solid #e7e7e0;
  border-radius: 50%;
}

.ring-one {
  inset: 0;
}

.ring-two {
  inset: 29px;
  background: #fafaf8;
}

.hero-graphic-center {
  position: absolute;
  display: grid;
  inset: 57px;
  place-items: center;
  border: 1px solid #e8e8e1;
  border-radius: 50%;
  background: linear-gradient(145deg, #f6f6f2, #eeeeea);
  box-shadow: inset 0 0 30px rgb(0 0 0 / 2%);
}

.hero-graphic-center > span {
  color: #d0d0c7;
  font-family: Georgia, serif;
  font-size: 120px;
  font-weight: 700;
}

.hero-graphic-center > span span {
  color: #aaa99e;
}

.hero-graphic-caption {
  position: absolute;
  right: 0;
  bottom: 17px;
  left: 0;
  color: #85857c;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: .19em;
  text-align: center;
}

.hero-bottom {
  display: flex;
  justify-content: space-between;
  max-width: 1240px;
  margin: 0 auto;
  padding: 15px 0;
  border-top: 1px solid #eeeeea;
  color: #929288;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: .17em;
}

/* MAIN */

.menu-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 345px;
  align-items: start;
  gap: 38px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 60px 28px 85px;
}

.menu-content {
  min-width: 0;
}

.menu-section-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 15px;
  margin-bottom: 27px;
}

.section-kicker {
  color: #929288;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .2em;
}

.menu-section-heading h2,
.cart-sidebar-heading h2 {
  margin-top: 9px;
  font-size: clamp(28px, 3vw, 37px);
  font-weight: 950;
  letter-spacing: -1.8px;
  line-height: 1.12;
}

.menu-section-heading p {
  margin-top: 9px;
  color: #85857c;
  font-size: 12px;
  line-height: 1.7;
}

.item-count {
  padding: 10px 14px;
  border: 1px solid #e8e8e2;
  border-radius: 40px;
  background: #fff;
  color: #6f6f66;
  font-size: 10px;
  font-weight: 850;
  white-space: nowrap;
}

/* SEARCH */

.search-box {
  display: flex;
  align-items: center;
  gap: 13px;
  min-height: 59px;
  padding: 0 18px;
  border: 1px solid #e8e8e2;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 4px 15px rgb(0 0 0 / 2%);
  transition: border-color .2s ease, box-shadow .2s ease, transform .2s ease;
}

.search-box:focus-within {
  border-color: #aaa99e;
  box-shadow: 0 0 0 4px rgb(0 0 0 / 4%), 0 8px 20px rgb(0 0 0 / 3%);
}

.search-icon {
  flex-shrink: 0;
  color: #85857c;
}

.search-box input {
  width: 100%;
  min-width: 0;
  height: 56px;
  border: 0;
  outline: 0;
  background: transparent;
  color: #171715;
  font: inherit;
  font-size: 13px;
}

.search-box input::placeholder {
  color: #a2a298;
}

.search-box input::-webkit-search-cancel-button {
  display: none;
}

.clear-search {
  display: grid;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  background: #f1f1ed;
  color: #55554d;
  transition: background .2s ease, transform .2s ease;
}

.clear-search:hover {
  background: #e7e7e0;
  transform: rotate(90deg);
}

/* CATEGORIES */

.category-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 29px;
  margin-bottom: 13px;
  color: #929288;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: .14em;
}

.category-list {
  display: flex;
  gap: 9px;
  overflow-x: auto;
  margin-bottom: 30px;
  padding: 2px 0 7px;
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}

.category-list::-webkit-scrollbar {
  display: none;
}

.category-button {
  min-height: 41px;
  padding: 0 18px;
  border: 1px solid #e7e7e0;
  border-radius: 40px;
  background: #fff;
  color: #696960;
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
  transition: color .2s ease, background .2s ease, border-color .2s ease, transform .2s ease, box-shadow .2s ease;
}

.category-button:hover {
  border-color: #171715;
  color: #171715;
  transform: translateY(-1px);
}

.category-button.active {
  border-color: #171715;
  background: #171715;
  color: #fff;
  box-shadow: 0 5px 13px rgb(0 0 0 / 12%);
}

/* ACTIVE OFFER DISPLAY */
.public-offers{margin:26px 0 30px;padding:18px;border:1px solid #e7e7e0;border-radius:20px;background:linear-gradient(135deg,#fff,#f3f3ee);box-shadow:0 10px 28px rgb(0 0 0 / 4%)}
.public-offers-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px}
.public-offers-kicker{font-size:9px;font-weight:900;letter-spacing:.2em;color:#77776f}
.public-offers-count{font-size:8px;font-weight:850;letter-spacing:.12em;color:#88887f}
.public-offers-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr));gap:12px}
.public-offer-card{display:flex;align-items:center;gap:13px;min-width:0;padding:11px;border:1px solid #e9e9e3;border-radius:15px;background:#fff}
.public-offer-image,.public-offer-art{width:82px;height:82px;flex-shrink:0;border-radius:11px;object-fit:cover}
.public-offer-art{display:grid;place-items:center;background:#171715;color:#fff}
.public-offer-copy{min-width:0}
.public-offer-discount{display:inline-flex;padding:5px 8px;border-radius:6px;background:#171715;color:#fff;font-size:9px;font-weight:900;letter-spacing:.06em}
.public-offer-copy h3{margin:7px 0 3px;font-size:13px;font-weight:900;letter-spacing:-.2px}
.public-offer-copy p{margin:0 0 5px;color:#77776f;font-size:10px;line-height:1.5}
.public-offer-copy small{display:block;color:#8b8b82;font-size:9px;line-height:1.5}
@media(max-width:480px){.public-offers{padding:13px;border-radius:16px;margin:20px 0 24px}.public-offer-image,.public-offer-art{width:68px;height:68px}.public-offer-card{gap:10px;padding:9px}}
/* PRODUCT GRID */

.product-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  gap: 19px;
}

/* CART */

.cart-sidebar {
  position: sticky;
  top: 22px;
  min-width: 0;
  padding: 23px;
  border: 1px solid #e9e9e3;
  border-radius: 21px;
  background: #fff;
  box-shadow: 0 12px 35px rgb(0 0 0 / 4%);
}

.cart-sidebar-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 21px;
}

.cart-sidebar-heading h2 {
  font-size: 25px;
}

.cart-count {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 9px 12px;
  border: 1px solid #e9e9e3;
  border-radius: 40px;
  background: #fafaf8;
  color: #55554d;
  font-size: 12px;
  font-weight: 800;
}

.trust-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-top: 19px;
  padding: 16px;
  border: 1px solid #e9e9e3;
  border-radius: 15px;
  background: #fafaf8;
}

.trust-icon {
  display: grid;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 50%;
  background: #e9eee6;
  color: #426748;
}

.trust-card strong {
  font-size: 11px;
  font-weight: 850;
}

.trust-card p {
  margin-top: 6px;
  color: #85857b;
  font-size: 10px;
  line-height: 1.7;
}

.cart-delivery-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  margin-top: 16px;
  color: #8a8a80;
  font-size: 10px;
}

.menu-error {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 13px;
  border: 1px solid #f0d2ce;
  border-radius: 12px;
  background: #fff5f3;
  color: #a52e25;
  font-size: 11px;
  line-height: 1.6;
}

.menu-error button {
  display: grid;
  flex-shrink: 0;
  margin-left: auto;
  place-items: center;
}

/* EMPTY STATE */

.empty-results {
  display: grid;
  justify-items: center;
  padding: 70px 20px;
  border: 1px dashed #dcdcd4;
  border-radius: 20px;
  background: #fff;
  text-align: center;
}

.empty-symbol {
  display: grid;
  width: 58px;
  height: 58px;
  place-items: center;
  border-radius: 18px;
  background: #f0f0eb;
  color: #77776d;
}

.empty-results h3 {
  margin-top: 18px;
  font-size: 18px;
  font-weight: 850;
}

.empty-results p {
  max-width: 300px;
  margin-top: 9px;
  color: #85857b;
  font-size: 12px;
  line-height: 1.8;
}

.empty-results button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 20px;
  padding: 12px 17px;
  border-radius: 11px;
  background: #171715;
  color: #fff;
  font-size: 11px;
  font-weight: 800;
  transition: background .2s ease, transform .2s ease;
}

.empty-results button:hover {
  background: #35352f;
  transform: translateY(-2px);
}

/* BOTTOM NOTE */

.menu-bottom-note {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13px;
  margin-top: 48px;
  color: #a0a096;
  font-size: 8px;
  font-weight: 850;
  letter-spacing: .16em;
  text-align: center;
}

.menu-bottom-line {
  width: 35px;
  height: 1px;
  background: #deded6;
}

/* FOOTER */

.menu-footer {
  border-top: 1px solid #e9e9e3;
  background: #fff;
}

.footer-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  max-width: 1240px;
  margin: 0 auto;
  padding: 27px 28px;
}

.footer-brand strong {
  font-size: 13px;
  font-weight: 950;
  letter-spacing: .14em;
}

.footer-brand strong span {
  color: #99998f;
}

.footer-brand p {
  margin-top: 6px;
  color: #85857b;
  font-size: 10px;
}

.footer-right {
  display: flex;
  flex-wrap: wrap;
  gap: 17px;
  color: #99998f;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .1em;
}

/* MOBILE CART */

.mobile-cart-shortcut {
  display: none;
}

/* RESPONSIVE */

@media (min-width: 1200px) {
  .product-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 1023px) {
  .menu-layout {
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: 24px;
    padding-inline: 22px;
  }

  .hero-graphic {
    right: 0;
    opacity: .65;
  }

  .product-grid {
    gap: 14px;
  }
}

@media (max-width: 760px) {
  .restaurant-header {
    padding-inline: 17px;
  }

  .header-top {
    padding: 17px 0;
  }

  .brand-mark,
  .restaurant-logo {
    width: 40px;
    height: 40px;
    border-radius: 12px;
  }

  .header-tag {
    padding: 8px 10px;
    font-size: 8px;
  }

  .hero-content {
    min-height: 260px;
    padding: 39px 0;
  }

  .hero-copy h1 {
    max-width: 95%;
    font-size: clamp(38px, 9vw, 55px);
    letter-spacing: -2.5px;
  }

  .hero-description {
    max-width: 92%;
    font-size: 12px;
    line-height: 1.8;
  }

  .hero-graphic {
    right: -135px;
    opacity: .3;
  }

  .hero-bottom {
    font-size: 7px;
  }

  .menu-layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 29px;
    padding: 37px 15px 48px;
  }

  .menu-section-heading {
    margin-bottom: 22px;
  }

  .menu-section-heading h2 {
    font-size: 29px;
  }

  .product-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .cart-sidebar {
    position: static;
    scroll-margin-top: 20px;
    border-radius: 18px;
  }

  .footer-inner {
    padding: 23px 17px;
  }

  .mobile-cart-shortcut {
    position: fixed;
    z-index: 50;
    right: 13px;
    bottom: max(13px, env(safe-area-inset-bottom));
    left: 13px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 60px;
    padding: 0 18px;
    border: 1px solid #33332e;
    border-radius: 16px;
    background: #171715;
    color: #fff;
    box-shadow: 0 10px 35px rgb(0 0 0 / 23%);
    font-size: 12px;
    font-weight: 750;
    transition: transform .2s ease, box-shadow .2s ease;
  }

  .mobile-cart-icon {
    position: relative;
    display: flex;
    align-items: center;
  }

  .mobile-cart-icon > span {
    position: absolute;
    top: -9px;
    right: -9px;
    display: grid;
    width: 18px;
    height: 18px;
    place-items: center;
    border-radius: 50%;
    background: #fff;
    color: #171715;
    font-size: 9px;
    font-weight: 900;
  }

  .mobile-cart-shortcut strong {
    margin-left: auto;
    font-size: 13px;
    font-weight: 900;
  }

  .menu-footer {
    padding-bottom: 82px;
  }
}

@media (max-width: 390px) {
  .header-tag {
    gap: 5px;
    padding: 7px 8px;
    font-size: 7px;
  }

  .hero-copy h1 {
    font-size: 36px;
  }

  .product-grid {
    gap: 9px;
  }

  .menu-section-heading h2 {
    font-size: 25px;
  }

  .item-count {
    padding: 7px 9px;
    font-size: 9px;
  }

  .footer-right {
    gap: 8px;
    font-size: 8px;
  }
}

/* ACCESSIBILITY */

@media (prefers-reduced-motion: reduce) {
  .thoam-menu *,
  .thoam-menu *::before,
  .thoam-menu *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    transition-duration: .01ms !important;
  }
}

      `}</style>
    </main>
  );
}