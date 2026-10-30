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