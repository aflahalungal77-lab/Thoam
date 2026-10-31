"use client";

import {
  FormEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  MapPin,
  Minus,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Truck,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from "lucide-react";

type Item = {
  id: string;
  name: string;
  price: number;
  image_url?: string | null;
  quantity: number;
};

type Restaurant = {
  id: string;
  name: string;
  slug: string;
  is_open: boolean;
  delivery_enabled: boolean;
  delivery_fee: number | null;
  status: string;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function CheckoutInner() {
  const params = useSearchParams();
  const router = useRouter();

  const slug = params.get("restaurant") || "";

  const [items, setItems] = useState<Item[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "info">("error");
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity,
        0
      ),
    [items]
  );

  const deliveryFee = Number(restaurant?.delivery_fee ?? 0);
  const platformFee = 1;
  const total = subtotal + deliveryFee + platformFee;

  const showMessage = useCallback(
    (text: string, type: "error" | "info" = "error") => {
      setMessage(text);
      setMessageType(type);
    },
    []
  );

  useEffect(() => {
    let active = true;

    async function loadCheckout() {
      setLoading(true);
      setMessage("");

      try {
        if (!supabase || !slug) {
          if (active) {
            showMessage(
              "Checkout load cheyyan kazhinjilla. Restaurant menu-il ninnu veendum try cheyyuka."
            );
          }
          return;
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace(
            `/auth?next=${encodeURIComponent(
              `/checkout?restaurant=${slug}`
            )}`
          );
          return;
        }

        if (!active) return;

        setName(user.user_metadata?.full_name || "");

        const { data: profile } = await supabase
          .from("profiles")
          .select("phone")
          .eq("id", user.id)
          .maybeSingle();

        if (!active) return;

        if (profile?.phone) {
          setPhone(profile.phone);
        }

        const { data: restaurantData, error: restaurantError } =
          await supabase
            .from("restaurants")
            .select(
              "id,name,slug,is_open,delivery_enabled,delivery_fee,status"
            )
            .eq("slug", slug)
            .eq("status", "approved")
            .maybeSingle();

        if (restaurantError || !restaurantData) {
          showMessage(
            "Restaurant kandethan kazhinjilla, allenkil restaurant approved alla."
          );
          return;
        }

        if (!active) return;

        const savedCart = localStorage.getItem(`thoam-cart-${slug}`);

        let parsedCart: Record<string, number> = {};

        try {
          parsedCart = savedCart ? JSON.parse(savedCart) : {};
        } catch {
          parsedCart = {};
        }

        const cartEntries = Object.entries(parsedCart).filter(
          ([, quantity]) =>
            Number.isFinite(Number(quantity)) && Number(quantity) > 0
        );

        if (!cartEntries.length) {
          showMessage(
            "Ninte cart empty aanu. Menu-il poyi food items add cheyyuka.",
            "info"
          );
          return;
        }

        const productIds = cartEntries.map(([id]) => id);

        const { data: products, error: productsError } = await supabase
          .from("products")
          .select(
            "id,name,price,image_url,is_available,restaurant_id"
          )
          .eq("restaurant_id", restaurantData.id)
          .in("id", productIds);

        if (productsError) {
          showMessage("Products load cheyyan kazhinjilla. Veendum try cheyyuka.");
          return;
        }

        if (!active) return;

        const availableProducts = (products || [])
          .filter((product: any) => product.is_available)
          .map((product: any) => ({
            id: product.id,
            name: product.name,
            price: Number(product.price),
            image_url: product.image_url || null,
            quantity: Number(parsedCart[product.id] || 0),
          }))
          .filter(
            (product: Item) =>
              product.quantity > 0 &&
              Number.isFinite(product.price) &&
              product.price >= 0
          );

        setRestaurant(restaurantData as Restaurant);
        setItems(availableProducts);

        if (!availableProducts.length) {
          showMessage(
            "Cart-ilulla food items ippol available alla. Menu refresh cheythu veendum select cheyyuka."
          );
        } else if (availableProducts.length < cartEntries.length) {
          showMessage(
            "Cart-il chila items available alla. Available items maathram order-il ulppeduthiyittundu.",
            "info"
          );
        }
      } catch {
        if (active) {
          showMessage("Unexpected error. Page refresh cheythu veendum try cheyyuka.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadCheckout();

    return () => {
      active = false;
    };
  }, [slug, router, showMessage]);

  function updateQuantity(productId: string, change: number) {
    setItems((current) => {
      const updated = current
        .map((item) =>
          item.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item
        )
        .filter((item) => item.quantity > 0);

      localStorage.setItem(
        `thoam-cart-${slug}`,
        JSON.stringify(
          Object.fromEntries(updated.map((item) => [item.id, item.quantity]))
        )
      );

      return updated;
    });

    setMessage("");
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!supabase) {
      showMessage("Supabase configure cheythittilla.");
      return;
    }

    if (!restaurant || items.length === 0) {
      showMessage("Cart empty aanu, allenkil restaurant unavailable aanu.");
      return;
    }

    if (!restaurant.is_open) {
      showMessage("Restaurant ippol closed aanu. Open aakumbol try cheyyuka.");
      return;
    }

    if (!restaurant.delivery_enabled) {
      showMessage("Ee restaurant delivery orders ippol accept cheyyunnilla.");
      return;
    }

    const normalizedPhone = phone.trim();

    if (normalizedPhone.replace(/\D/g, "").length < 10) {
      showMessage("Valid phone number enter cheyyuka.");
      return;
    }

    if (address.trim().length < 8) {
      showMessage("Complete delivery address enter cheyyuka.");
      return;
    }

    if (!name.trim()) {
      showMessage("Full name enter cheyyuka.");
      return;
    }

    setBusy(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace(
          `/auth?next=${encodeURIComponent(
            `/checkout?restaurant=${slug}`
          )}`
        );
        return;
      }

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          orderType: "delivery",
          customerName: name.trim(),
          customerPhone: normalizedPhone,
          deliveryAddress: address.trim(),
          notes: notes.trim(),
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
          })),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not place order.");
      }

      localStorage.removeItem(`thoam-cart-${slug}`);

      setOrderNumber(String(result.order.order_number));
    } catch (error: unknown) {
      showMessage(
        error instanceof Error
          ? error.message
          : "Order place cheyyan kazhinjilla. Veendum try cheyyuka."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="thoam-checkout">
          <div className="tc-loading">
            <span className="tc-loading-icon">
              <LoaderCircle size={28} />
            </span>
            <h2>Preparing your checkout</h2>
            <p>Your restaurant and cart details are loading.</p>
            <div className="tc-skeleton" />
            <div className="tc-skeleton tc-skeleton-small" />
          </div>
        </main>
      </>
    );
  }

  if (orderNumber) {
    return (
      <>
        <Header />

        <main className="thoam-checkout">
          <section className="tc-success">
            <div className="tc-success-icon">
              <CheckCircle2 size={42} strokeWidth={1.6} />
            </div>

            <span className="tc-eyebrow">ORDER CONFIRMED</span>

            <h1>Thank you!</h1>

            <p className="tc-success-description">
              Your order has been placed successfully
              {restaurant?.name ? ` with ${restaurant.name}` : ""}.
            </p>

            <div className="tc-order-number">
              <span>YOUR ORDER NUMBER</span>
              <strong>#{orderNumber}</strong>
            </div>

            <div className="tc-cod-confirmation">
              <Wallet size={21} />
              <div>
                <strong>Cash on Delivery</strong>
                <p>Pay in cash when your order arrives.</p>
              </div>
            </div>

            <div className="tc-success-actions">
              <Link className="tc-primary-button" href="/my-orders">
                View my orders <ArrowRight size={17} />
              </Link>

              <Link className="tc-secondary-button" href="/restaurants">
                Browse restaurants
              </Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />

      <main className="thoam-checkout">
        <div className="tc-topbar">
          <Link
            className="tc-back-link"
            href={slug ? `/restaurants/${slug}` : "/restaurants"}
          >
            <ArrowLeft size={16} />
            <span>Back to menu</span>
          </Link>

          <div className="tc-secure-label">
            <Wallet size={15} />
            <span>Cash on Delivery</span>
          </div>
        </div>

        <section className="tc-heading">
          <span className="tc-eyebrow">ALMOST THERE</span>
          <h1>Checkout<span>.</span></h1>
          <p>Good food is just a few steps away.</p>
        </section>

        {message && (
          <div
            className={`tc-alert ${
              messageType === "info" ? "tc-alert-info" : ""
            }`}
            role="alert"
          >
            {messageType === "info" ? (
              <ShoppingBag size={19} />
            ) : (
              <XCircle size={19} />
            )}
            <span>{message}</span>
          </div>
        )}

        <form className="tc-layout" onSubmit={submitOrder}>
          <div className="tc-main-column">
            <section className="tc-card">
              <div className="tc-card-heading">
                <div className="tc-step">01</div>
                <div>
                  <h2>Delivery details</h2>
                  <p>Where should we deliver your food?</p>
                </div>
              </div>

              <div className="tc-form-fields">
                <label className="tc-field">
                  <span>Full name <b>*</b></span>
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    maxLength={100}
                    placeholder="Enter your full name"
                    autoComplete="name"
                  />
                </label>

                <label className="tc-field">
                  <span>Phone number <b>*</b></span>
                  <input
                    required
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    maxLength={20}
                    placeholder="Your contact number"
                    autoComplete="tel"
                  />
                  <small>We may contact you about your order.</small>
                </label>

                <label className="tc-field">
                  <span>Delivery address <b>*</b></span>
                  <textarea
                    required
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    rows={4}
                    maxLength={600}
                    placeholder="House name, road, area, landmark and PIN code"
                    autoComplete="street-address"
                  />
                </label>

                <label className="tc-field">
                  <span>
                    Delivery instructions <em>OPTIONAL</em>
                  </span>
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Any special instructions for delivery?"
                  />
                </label>
              </div>
            </section>

            <section className="tc-card tc-payment-card">
              <div className="tc-card-heading">
                <div className="tc-step">02</div>
                <div>
                  <h2>Payment method</h2>
                  <p>Simple, safe and convenient.</p>
                </div>
              </div>

              <div className="tc-payment-option">
                <div className="tc-payment-icon">
                  <Wallet size={23} />
                </div>

                <div className="tc-payment-copy">
                  <strong>Cash on Delivery</strong>
                  <span>Pay when your food arrives.</span>
                </div>

                <div className="tc-radio-selected">
                  <CheckCircle2 size={20} />
                </div>
              </div>

              <p className="tc-payment-note">
                <CheckCircle2 size={15} />
                No online payment required.
              </p>
            </section>
          </div>

          <aside className="tc-summary-column">
            <section className="tc-card tc-summary-card">
              <div className="tc-summary-heading">
                <div>
                  <span className="tc-eyebrow">YOUR ORDER</span>
                  <h2>Order summary</h2>
                </div>

                <div className="tc-cart-icon">
                  <ShoppingCart size={20} />
                </div>
              </div>

              {restaurant && (
                <div className="tc-restaurant">
                  <div className="tc-restaurant-icon">
                    <UtensilsCrossed size={19} />
                  </div>

                  <div className="tc-restaurant-copy">
                    <strong>{restaurant.name}</strong>
                    <span>
                      {restaurant.is_open ? "Accepting orders" : "Currently closed"}
                    </span>
                  </div>

                  <div
                    className={`tc-status-dot ${
                      restaurant.is_open ? "" : "tc-status-closed"
                    }`}
                  />
                </div>
              )}

              <div className="tc-order-items">
                {items.map((item) => (
                  <div className="tc-order-item" key={item.id}>
                    <div className="tc-product-image">
                      {item.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.image_url} alt={item.name} />
                      ) : (
                        <UtensilsCrossed size={23} />
                      )}
                    </div>

                    <div className="tc-product-details">
                      <strong>{item.name}</strong>
                      <span>{formatPrice(Number(item.price))} each</span>

                      <div className="tc-quantity-control">
                        <button
                          type="button"
                          aria-label={`Decrease ${item.name} quantity`}
                          onClick={() => updateQuantity(item.id, -1)}
                        >
                          <Minus size={13} />
                        </button>

                        <span>{item.quantity}</span>

                        <button
                          type="button"
                          aria-label={`Increase ${item.name} quantity`}
                          onClick={() => updateQuantity(item.id, 1)}
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>

                    <strong className="tc-item-total">
                      {formatPrice(Number(item.price) * item.quantity)}
                    </strong>
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="tc-empty-cart">
                    <ShoppingBag size={28} />
                    <p>Your cart is empty.</p>
                    <Link href={slug ? `/restaurants/${slug}` : "/restaurants"}>
                      Browse menu <ArrowRight size={14} />
                    </Link>
                  </div>
                )}
              </div>

              <div className="tc-price-breakdown">
                <div className="tc-price-row">
                  <span>Items subtotal</span>
                  <span>{formatPrice(subtotal)}</span>
                </div>

                <div className="tc-price-row">
                  <span>
                    <Truck size={15} />
                    Delivery fee
                  </span>
                  <span>{formatPrice(deliveryFee)}</span>
                </div>

                <div className="tc-price-row">
                  <span>Platform fee</span>
                  <span>{formatPrice(platformFee)}</span>
                </div>

                <div className="tc-total-row">
                  <div>
                    <strong>Total amount</strong>
                    <span>Inclusive of listed fees</span>
                  </div>
                  <strong>{formatPrice(total)}</strong>
                </div>
              </div>

              <button
                className="tc-place-order"
                type="submit"
                disabled={
                  busy ||
                  loading ||
                  items.length === 0 ||
                  !restaurant ||
                  !restaurant.is_open ||
                  !restaurant.delivery_enabled
                }
              >
                {busy ? (
                  <>
                    <LoaderCircle className="tc-spin" size={19} />
                    Placing your order...
                  </>
                ) : (
                  <>
                    Place COD order
                    <ArrowRight size={19} />
                  </>
                )}
              </button>

              <div className="tc-trust-note">
                <CheckCircle2 size={15} />
                <span>
                  Your final order total is verified by the server.
                </span>
              </div>

              <div className="tc-delivery-note">
                <Clock3 size={16} />
                <span>Delivery time depends on the restaurant.</span>
              </div>
            </section>

            <div className="tc-help-card">
              <MapPin size={19} />
              <div>
                <strong>Check your address</strong>
                <p>
                  Include your area and a nearby landmark to help the delivery
                  person find you.
                </p>
              </div>
            </div>
          </aside>
        </form>

        <footer className="tc-footer">
          <span>THO’AM</span>
          <span>Good food. Made simple.</span>
        </footer>
      </main>

<style jsx>{`
  .thoam-checkout {
    --tc-black: #111111;
    --tc-muted: #777777;
    --tc-border: #eaeaea;
    --tc-surface: #ffffff;
    --tc-soft: #f7f7f7;
    width: 100%;
    max-width: 1180px;
    min-height: 80vh;
    margin: 0 auto;
    padding: 34px 24px 24px;
    color: var(--tc-black);
    font-family: inherit;
  }

  .tc-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 38px;
  }

  .tc-back-link,
  .tc-secure-label {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    color: #555;
    font-size: 13px;
    font-weight: 600;
    text-decoration: none;
  }

  .tc-back-link:hover {
    color: #000;
  }

  .tc-secure-label {
    padding: 10px 14px;
    border: 1px solid var(--tc-border);
    border-radius: 30px;
    background: #fff;
  }

  .tc-heading {
    margin-bottom: 32px;
  }

  .tc-eyebrow {
    color: #888;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 2px;
  }

  .tc-heading h1,
  .tc-success h1 {
    margin: 9px 0;
    font-size: clamp(36px, 5vw, 54px);
    font-weight: 850;
    letter-spacing: -2.8px;
    line-height: 1.08;
  }

  .tc-heading h1 span {
    color: #999;
  }

  .tc-heading p,
  .tc-success-description {
    margin: 10px 0 0;
    color: var(--tc-muted);
    font-size: 14px;
    line-height: 1.7;
  }

  .tc-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.35fr) minmax(340px, .85fr);
    align-items: start;
    gap: 24px;
  }

  .tc-main-column,
  .tc-summary-column {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }

  .tc-card {
    padding: 27px;
    border: 1px solid var(--tc-border);
    border-radius: 18px;
    background: var(--tc-surface);
    box-shadow: 0 5px 24px rgba(0, 0, 0, .025);
  }

  .tc-card-heading {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 25px;
  }

  .tc-step {
    display: grid;
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    place-items: center;
    border-radius: 12px;
    background: #111;
    color: #fff;
    font-size: 13px;
    font-weight: 800;
  }

  .tc-card-heading h2,
  .tc-summary-heading h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -.5px;
  }

  .tc-card-heading p {
    margin: 5px 0 0;
    color: var(--tc-muted);
    font-size: 12px;
  }

  .tc-form-fields {
    display: flex;
    flex-direction: column;
    gap: 19px;
  }

  .tc-field {
    display: flex;
    flex-direction: column;
    gap: 9px;
  }

  .tc-field > span {
    color: #292929;
    font-size: 12px;
    font-weight: 750;
  }

  .tc-field b {
    color: #d33;
  }

  .tc-field em {
    margin-left: 5px;
    color: #999;
    font-size: 9px;
    font-style: normal;
    letter-spacing: .8px;
  }

  .tc-field input,
  .tc-field textarea {
    width: 100%;
    min-height: 48px;
    padding: 13px 15px;
    border: 1px solid #e5e5e5;
    border-radius: 10px;
    outline: none;
    background: #fafafa;
    color: #111;
    font: inherit;
    font-size: 13px;
    transition: border-color .2s, background .2s, box-shadow .2s;
  }

  .tc-field textarea {
    min-height: 95px;
    resize: vertical;
  }

  .tc-field input:focus,
  .tc-field textarea:focus {
    border-color: #222;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(0, 0, 0, .055);
  }

  .tc-field input::placeholder,
  .tc-field textarea::placeholder {
    color: #aaa;
  }

  .tc-field small {
    color: #999;
    font-size: 11px;
  }

  .tc-payment-card {
    padding-bottom: 23px;
  }

  .tc-payment-option {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 17px;
    border: 1px solid #dedede;
    border-radius: 13px;
    background: #fafafa;
  }

  .tc-payment-icon,
  .tc-cart-icon,
  .tc-restaurant-icon {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 43px;
    height: 43px;
    border-radius: 12px;
    background: #111;
    color: #fff;
  }

  .tc-payment-copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 5px;
  }

  .tc-payment-copy strong {
    font-size: 13px;
  }

  .tc-payment-copy span {
    color: #888;
    font-size: 11px;
  }

  .tc-radio-selected {
    color: #111;
  }

  .tc-payment-note {
    display: flex;
    align-items: center;
    gap: 7px;
    margin: 15px 0 0;
    color: #777;
    font-size: 11px;
  }

  .tc-summary-card {
    position: sticky;
    top: 20px;
    padding: 24px;
  }

  .tc-summary-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 23px;
  }

  .tc-summary-heading h2 {
    margin-top: 6px;
  }

  .tc-cart-icon {
    width: 42px;
    height: 42px;
    border-radius: 13px;
  }

  .tc-restaurant {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border: 1px solid var(--tc-border);
    border-radius: 12px;
    background: #fafafa;
  }

  .tc-restaurant-icon {
    width: 38px;
    height: 38px;
    border-radius: 10px;
  }

  .tc-restaurant-copy {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .tc-restaurant-copy strong {
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tc-restaurant-copy span {
    color: #888;
    font-size: 10px;
  }

  .tc-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #159653;
  }

  .tc-status-closed {
    background: #d33;
  }

  .tc-order-items {
    display: flex;
    flex-direction: column;
    gap: 17px;
    padding: 21px 0;
  }

  .tc-order-item {
    display: flex;
    align-items: center;
    gap: 11px;
    min-width: 0;
  }

  .tc-product-image {
    display: grid;
    width: 55px;
    height: 55px;
    flex-shrink: 0;
    overflow: hidden;
    place-items: center;
    border: 1px solid #eee;
    border-radius: 11px;
    background: #f5f5f5;
    color: #888;
  }

  .tc-product-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .tc-product-details {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
  }

  .tc-product-details > strong {
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tc-product-details > span {
    color: #888;
    font-size: 10px;
  }

  .tc-item-total {
    flex-shrink: 0;
    font-size: 12px;
  }

  .tc-quantity-control {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    width: fit-content;
    margin-top: 3px;
  }

  .tc-quantity-control button {
    display: grid;
    width: 25px;
    height: 25px;
    place-items: center;
    border: 1px solid #e5e5e5;
    border-radius: 7px;
    background: #fff;
    color: #111;
    cursor: pointer;
    transition: .2s;
  }

  .tc-quantity-control button:hover {
    border-color: #111;
    background: #111;
    color: #fff;
  }

  .tc-quantity-control span {
    min-width: 10px;
    text-align: center;
    font-size: 11px;
    font-weight: 750;
  }

  .tc-price-breakdown {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 19px 0;
    border-top: 1px solid #eee;
  }

  .tc-price-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    color: #777;
    font-size: 12px;
  }

  .tc-price-row > span:first-child {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .tc-price-row > span:last-child {
    color: #222;
    font-weight: 650;
  }

  .tc-total-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 5px;
    padding-top: 17px;
    border-top: 1px dashed #ddd;
  }

  .tc-total-row > div {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .tc-total-row strong {
    font-size: 14px;
    font-weight: 850;
  }

  .tc-total-row > strong {
    font-size: 19px;
    letter-spacing: -.5px;
  }

  .tc-total-row span {
    color: #999;
    font-size: 10px;
  }

  .tc-place-order,
  .tc-primary-button {
    display: flex;
    width: 100%;
    min-height: 52px;
    align-items: center;
    justify-content: center;
    gap: 11px;
    border: 1px solid #111;
    border-radius: 11px;
    background: #111;
    color: #fff;
    font-size: 13px;
    font-weight: 750;
    text-decoration: none;
    cursor: pointer;
    transition: transform .2s, background .2s;
  }

  .tc-place-order:hover:not(:disabled),
  .tc-primary-button:hover {
    transform: translateY(-2px);
    background: #333;
  }

  .tc-place-order:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .tc-trust-note,
  .tc-delivery-note {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    margin-top: 13px;
    color: #888;
    font-size: 10px;
    text-align: center;
  }

  .tc-help-card {
    display: flex;
    gap: 13px;
    padding: 18px;
    border: 1px solid var(--tc-border);
    border-radius: 14px;
    background: #fafafa;
    color: #555;
  }

  .tc-help-card > svg {
    flex-shrink: 0;
  }

  .tc-help-card strong {
    color: #222;
    font-size: 12px;
  }

  .tc-help-card p {
    margin: 5px 0 0;
    color: #888;
    font-size: 11px;
    line-height: 1.6;
  }

  .tc-alert {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 20px;
    padding: 14px 16px;
    border: 1px solid #f1caca;
    border-radius: 11px;
    background: #fff7f7;
    color: #b42323;
    font-size: 12px;
    line-height: 1.5;
  }

  .tc-alert-info {
    border-color: #e5e5e5;
    background: #f8f8f8;
    color: #555;
  }

  .tc-empty-cart {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 25px 10px;
    color: #999;
    text-align: center;
  }

  .tc-empty-cart p {
    margin: 0;
    font-size: 12px;
  }

  .tc-empty-cart a {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #111;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
  }

  .tc-loading {
    display: flex;
    min-height: 60vh;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .tc-loading-icon {
    display: grid;
    width: 60px;
    height: 60px;
    place-items: center;
    border-radius: 18px;
    background: #111;
    color: #fff;
  }

  .tc-loading h2 {
    margin: 20px 0 5px;
    font-size: 20px;
  }

  .tc-loading p {
    color: #888;
    font-size: 12px;
  }

  .tc-skeleton {
    width: 220px;
    height: 10px;
    margin-top: 20px;
    border-radius: 20px;
    background: #eee;
    animation: tc-pulse 1.3s infinite alternate;
  }

  .tc-skeleton-small {
    width: 150px;
    margin-top: 9px;
  }

  .tc-spin {
    animation: tc-rotate 1s linear infinite;
  }

  @keyframes tc-rotate {
    to { transform: rotate(360deg); }
  }

  @keyframes tc-pulse {
    to { opacity: .35; }
  }

  .tc-success {
    display: flex;
    max-width: 540px;
    min-height: 65vh;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 0 auto;
    padding: 45px 25px;
    text-align: center;
  }

  .tc-success-icon {
    display: grid;
    width: 82px;
    height: 82px;
    margin-bottom: 25px;
    place-items: center;
    border: 1px solid #ddd;
    border-radius: 25px;
    background: #f8f8f8;
    color: #111;
  }

  .tc-success h1 {
    margin-top: 12px;
  }

  .tc-order-number {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 9px;
    margin: 28px 0 18px;
    padding: 20px;
    border: 1px dashed #ccc;
    border-radius: 14px;
    background: #fafafa;
  }

  .tc-order-number span {
    color: #888;
    font-size: 10px;
    font-weight: 750;
    letter-spacing: 1.5px;
  }

  .tc-order-number strong {
    font-size: 29px;
    letter-spacing: -1px;
  }

  .tc-cod-confirmation {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 13px;
    padding: 17px;
    border: 1px solid #e5e5e5;
    border-radius: 13px;
    text-align: left;
  }

  .tc-cod-confirmation strong {
    font-size: 13px;
  }

  .tc-cod-confirmation p {
    margin: 5px 0 0;
    color: #888;
    font-size: 11px;
  }

  .tc-success-actions {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 11px;
    margin-top: 22px;
  }

  .tc-secondary-button {
    display: flex;
    min-height: 48px;
    align-items: center;
    justify-content: center;
    border: 1px solid #ddd;
    border-radius: 11px;
    color: #222;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    transition: .2s;
  }

  .tc-secondary-button:hover {
    border-color: #111;
  }

  .tc-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 45px;
    padding: 22px 0;
    border-top: 1px solid #eee;
    color: #999;
    font-size: 10px;
  }

  .tc-footer span:first-child {
    color: #111;
    font-size: 13px;
    font-weight: 900;
    letter-spacing: 2px;
  }

  @media (max-width: 850px) {
    .thoam-checkout {
      padding: 25px 18px;
    }

    .tc-layout {
      grid-template-columns: 1fr;
    }

    .tc-summary-card {
      position: static;
    }
  }

  @media (max-width: 520px) {
    .thoam-checkout {
      padding: 20px 14px;
    }

    .tc-topbar {
      margin-bottom: 30px;
    }

    .tc-card {
      padding: 19px;
      border-radius: 15px;
    }

    .tc-heading {
      margin-bottom: 25px;
    }

    .tc-heading h1 {
      font-size: 39px;
    }

    .tc-card-heading {
      gap: 12px;
      margin-bottom: 21px;
    }

    .tc-card-heading h2,
    .tc-summary-heading h2 {
      font-size: 16px;
    }

    .tc-secure-label {
      padding: 8px 10px;
      font-size: 11px;
    }

    .tc-back-link {
      font-size: 11px;
    }

    .tc-summary-card {
      padding: 18px;
    }

    .tc-footer {
      margin-top: 30px;
    }

    .tc-success {
      padding: 35px 8px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .thoam-checkout *,
    .thoam-checkout *::before,
    .thoam-checkout *::after {
      scroll-behavior: auto !important;
      animation-duration: .01ms !important;
      transition-duration: .01ms !important;
    }
  }
`}</style>

    </>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main className="thoam-checkout">
            <div className="tc-loading">
              <LoaderCircle className="tc-spin" size={28} />
              <h2>Loading checkout...</h2>
            </div>
          </main>
        </>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}