
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
  ArrowLeft, ArrowRight, CheckCircle2, Clock3, LoaderCircle,
  MapPin, Minus, Plus, ShoppingBag, ShoppingCart, Truck,
  UtensilsCrossed, Wallet, XCircle, Tag, Percent
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

type Offer = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  scope: "order" | "products";
  discount_type: "percentage" | "fixed";
  discount_value: number;
  product_ids: string[];
  min_order_amount: number;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function calculateOffer(offer: Offer, items: Item[], subtotal: number) {
  if (subtotal < Number(offer.min_order_amount || 0)) return 0;

  let eligible = subtotal;

  if (offer.scope === "products") {
    eligible = items.reduce((sum, item) => {
      return offer.product_ids?.includes(item.id)
        ? sum + item.price * item.quantity
        : sum;
    }, 0);
  }

  if (eligible <= 0) return 0;

  let discount =
    offer.discount_type === "percentage"
      ? eligible * Number(offer.discount_value) / 100
      : Number(offer.discount_value);

  if (offer.max_discount !== null) {
    discount = Math.min(discount, Number(offer.max_discount));
  }

  return Math.round(Math.min(discount, eligible) * 100) / 100;
}

function CheckoutInner() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("restaurant") || "";

  const [items, setItems] = useState<Item[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
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
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  const deliveryFee = Number(restaurant?.delivery_fee ?? 0);
  const platformFee = 1;

  const bestOffer = useMemo(() => {
    const now = Date.now();

    return offers
      .filter((offer) => {
        if (!offer.is_active) return false;
        if (offer.starts_at && new Date(offer.starts_at).getTime() > now) return false;
        if (offer.ends_at && new Date(offer.ends_at).getTime() <= now) return false;
        return true;
      })
      .map((offer) => ({
        offer,
        discount: calculateOffer(offer, items, subtotal),
      }))
      .filter((entry) => entry.discount > 0)
      .sort((a, b) => b.discount - a.discount)[0] || null;
  }, [offers, items, subtotal]);

  const discount = bestOffer?.discount || 0;
  const total = Math.max(0, subtotal - discount + deliveryFee + platformFee);

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
          showMessage("Checkout load cheyyan kazhinjilla. Menu-il ninnu try cheyyuka.");
          return;
        }

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          router.replace(`/auth?next=${encodeURIComponent(`/checkout?restaurant=${slug}`)}`);
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
        if (profile?.phone) setPhone(profile.phone);

        const { data: restaurantData, error: restaurantError } =
          await supabase
            .from("restaurants")
            .select("id,name,slug,is_open,delivery_enabled,delivery_fee,status")
            .eq("slug", slug)
            .eq("status", "approved")
            .maybeSingle();

        if (restaurantError || !restaurantData) {
          showMessage("Restaurant kandethan kazhinjilla.");
          return;
        }

        const savedCart = localStorage.getItem(`thoam-cart-${slug}`);
        let parsedCart: Record<string, number> = {};

        try {
          parsedCart = savedCart ? JSON.parse(savedCart) : {};
        } catch {
          parsedCart = {};
        }

        const cartEntries = Object.entries(parsedCart).filter(
          ([, quantity]) => Number.isFinite(Number(quantity)) && Number(quantity) > 0
        );

        if (!cartEntries.length) {
          showMessage("Cart empty aanu. Menu-il ninnu food add cheyyuka.", "info");
          return;
        }

        const productIds = cartEntries.map(([id]) => id);

        const [
          { data: products, error: productsError },
          { data: offerData, error: offerError },
        ] = await Promise.all([
          supabase
            .from("products")
            .select("id,name,price,image_url,is_available,restaurant_id")
            .eq("restaurant_id", restaurantData.id)
            .in("id", productIds),

          supabase
            .from("offers")
            .select("*")
            .eq("restaurant_id", restaurantData.id)
            .eq("is_active", true),
        ]);

        if (productsError) {
          showMessage("Products load cheyyan kazhinjilla.");
          return;
        }

        if (offerError) {
          console.error("Offer loading failed:", offerError);
          // Checkout can still proceed without offers.
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
          .filter((product: Item) =>
            product.quantity > 0 &&
            Number.isFinite(product.price) &&
            product.price >= 0
          );

        setRestaurant(restaurantData as Restaurant);
        setItems(availableProducts);
        setOffers((offerData || []) as Offer[]);

        if (!availableProducts.length) {
          showMessage("Cart-ilulla items available alla.");
        } else if (availableProducts.length < cartEntries.length) {
          showMessage("Available items maathram order-il ulppeduthiyittundu.", "info");
        }
      } catch (error) {
        console.error(error);
        if (active) showMessage("Unexpected error. Page refresh cheyyuka.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCheckout();
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
        JSON.stringify(Object.fromEntries(updated.map((item) => [item.id, item.quantity])))
      );

      return updated;
    });

    setMessage("");
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!supabase || !restaurant || !items.length) {
      showMessage("Cart empty aanu, allenkil restaurant unavailable aanu.");
      return;
    }

    if (!restaurant.is_open) {
      showMessage("Restaurant ippol closed aanu.");
      return;
    }

    if (!restaurant.delivery_enabled) {
      showMessage("Ee restaurant delivery orders accept cheyyunnilla.");
      return;
    }

    if (phone.trim().replace(/\D/g, "").length < 10) {
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
        router.replace(`/auth?next=${encodeURIComponent(`/checkout?restaurant=${slug}`)}`);
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
          customerPhone: phone.trim(),
          deliveryAddress: address.trim(),
          notes: notes.trim(),
          offerId: bestOffer?.offer.id || null,
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
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Order place cheyyan kazhinjilla."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="tc-page">
          <div className="tc-loading">
            <LoaderCircle className="tc-spin" size={30} />
            <h2>Preparing your checkout</h2>
            <p>Your restaurant and cart details are loading.</p>
          </div>
        </main>
        <CheckoutStyles />
      </>
    );
  }

  if (orderNumber) {
    return (
      <>
        <Header />
        <main className="tc-page">
          <section className="tc-success">
            <div className="tc-success-icon"><CheckCircle2 size={42} /></div>
            <span className="tc-eyebrow">ORDER CONFIRMED</span>
            <h1>Thank you!</h1>
            <p>Your order has been placed successfully with {restaurant?.name}.</p>
            <div className="tc-order-number">
              <span>YOUR ORDER NUMBER</span>
              <strong>#{orderNumber}</strong>
            </div>
            <div className="tc-cod">
              <Wallet size={22} />
              <div><strong>Cash on Delivery</strong><p>Pay in cash when your order arrives.</p></div>
            </div>
            <Link className="tc-primary" href="/my-orders">View my orders <ArrowRight size={17} /></Link>
            <Link className="tc-secondary" href="/restaurants">Browse restaurants</Link>
          </section>
        </main>
        <CheckoutStyles />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="tc-page">
        <div className="tc-topbar">
          <Link href={slug ? `/restaurants/${slug}` : "/restaurants"}>
            <ArrowLeft size={16} /> Back to menu
          </Link>
          <span><Wallet size={15} /> Cash on Delivery</span>
        </div>

        <header className="tc-heading">
          <span className="tc-eyebrow">ALMOST THERE</span>
          <h1>Checkout<span>.</span></h1>
          <p>Good food is just a few steps away.</p>
        </header>

        {message && (
          <div className={`tc-alert ${messageType === "info" ? "tc-info" : ""}`}>
            {messageType === "info" ? <ShoppingBag size={18} /> : <XCircle size={18} />}
            {message}
          </div>
        )}

        <form className="tc-layout" onSubmit={submitOrder}>
          <div className="tc-main-column">
            <section className="tc-card">
              <div className="tc-card-title"><span>01</span><div><h2>Delivery details</h2><p>Where should we deliver your food?</p></div></div>
              <div className="tc-fields">
                <label>Full name *
                  <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" placeholder="Enter your full name" />
                </label>
                <label>Phone number *
                  <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} autoComplete="tel" placeholder="Your contact number" />
                </label>
                <label>Delivery address *
                  <textarea required value={address} onChange={(e) => setAddress(e.target.value)} rows={4} maxLength={600} placeholder="House name, road, area, landmark and PIN code" />
                </label>
                <label>Delivery instructions <small>OPTIONAL</small>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={500} placeholder="Any special instructions?" />
                </label>
              </div>
            </section>

            <section className="tc-card">
              <div className="tc-card-title"><span>02</span><div><h2>Payment method</h2><p>Simple, safe and convenient.</p></div></div>
              <div className="tc-payment">
                <Wallet size={24} />
                <div><strong>Cash on Delivery</strong><small>Pay when your food arrives.</small></div>
                <CheckCircle2 size={20} />
              </div>
              <p className="tc-muted">No online payment required.</p>
            </section>
          </div>

          <aside className="tc-side">
            <section className="tc-card tc-summary">
              <div className="tc-summary-title">
                <div><span className="tc-eyebrow">YOUR ORDER</span><h2>Order summary</h2></div>
                <ShoppingCart size={22} />
              </div>

              {restaurant && (
                <div className="tc-restaurant">
                  <UtensilsCrossed size={20} />
                  <div><strong>{restaurant.name}</strong><small>{restaurant.is_open ? "Accepting orders" : "Currently closed"}</small></div>
                </div>
              )}

              <div className="tc-items">
                {items.map((item) => (
                  <div className="tc-item" key={item.id}>
                    <div className="tc-product-image">
                      {item.image_url ? <img src={item.image_url} alt={item.name} /> : <UtensilsCrossed size={20} />}
                    </div>
                    <div className="tc-product">
                      <strong>{item.name}</strong>
                      <small>{formatPrice(item.price)} each</small>
                      <div className="tc-quantity">
                        <button type="button" onClick={() => updateQuantity(item.id, -1)} aria-label={`Decrease ${item.name}`}><Minus size={13} /></button>
                        {item.quantity}
                        <button type="button" onClick={() => updateQuantity(item.id, 1)} aria-label={`Increase ${item.name}`}><Plus size={13} /></button>
                      </div>
                    </div>
                    <strong>{formatPrice(item.price * item.quantity)}</strong>
                  </div>
                ))}
              </div>

              {bestOffer && (
                <div className="tc-offer">
                  <div className="tc-offer-icon"><Tag size={20} /></div>
                  <div className="tc-offer-copy">
                    <strong>{bestOffer.offer.title}</strong>
                    <small>
                      {bestOffer.offer.discount_type === "percentage"
                        ? `${bestOffer.offer.discount_value}% discount`
                        : `${formatPrice(bestOffer.offer.discount_value)} off`}
                      {bestOffer.offer.scope === "products" ? " on selected items" : " on your order"}
                    </small>
                    {bestOffer.offer.description && <small>{bestOffer.offer.description}</small>}
                  </div>
                  <span className="tc-applied">APPLIED</span>
                </div>
              )}

              <div className="tc-breakdown">
                <div><span>Items subtotal</span><strong>{formatPrice(subtotal)}</strong></div>
                {discount > 0 && <div className="tc-discount"><span><Percent size={14} /> Offer discount</span><strong>−{formatPrice(discount)}</strong></div>}
                <div><span><Truck size={14} /> Delivery fee</span><strong>{formatPrice(deliveryFee)}</strong></div>
                <div><span>Platform fee</span><strong>{formatPrice(platformFee)}</strong></div>
                <div className="tc-total"><span>Total amount</span><strong>{formatPrice(total)}</strong></div>
              </div>

              <button className="tc-place" type="submit" disabled={busy || !items.length || !restaurant || !restaurant.is_open || !restaurant.delivery_enabled}>
                {busy ? <><LoaderCircle className="tc-spin" size={18} /> Placing order...</> : <>Place COD order <ArrowRight size={18} /></>}
              </button>
              <p className="tc-note"><CheckCircle2 size={14} /> Final discount and total verified by the server.</p>
            </section>

            <div className="tc-help"><MapPin size={18} /><div><strong>Check your address</strong><p>Include your area and nearby landmark.</p></div></div>
          </aside>
        </form>

        <footer className="tc-footer"><strong>THO’AM</strong><span>Good food. Made simple.</span></footer>
      </main>
      <CheckoutStyles />
    </>
  );
}

function CheckoutStyles() {
  return (
    <style jsx global>{`
      .tc-page{--black:#111;--muted:#777;--border:#e9e9e9;max-width:1180px;min-height:80vh;margin:auto;padding:32px 24px;color:#111}
      .tc-topbar,.tc-topbar a,.tc-topbar>span{display:flex;align-items:center;justify-content:space-between;gap:9px}
      .tc-topbar a,.tc-topbar>span{font-size:13px;color:#555;text-decoration:none;font-weight:650}
      .tc-topbar>span{border:1px solid var(--border);border-radius:30px;padding:10px 14px}
      .tc-heading{margin:38px 0 28px}.tc-eyebrow{font-size:10px;font-weight:850;letter-spacing:2px;color:#888}
      .tc-heading h1{font-size:clamp(38px,5vw,55px);letter-spacing:-3px;margin:8px 0;font-weight:900}.tc-heading h1 span{color:#999}
      .tc-heading p,.tc-card-title p{color:#888;font-size:13px;margin:5px 0}
      .tc-layout{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(330px,.85fr);gap:23px;align-items:start}
      .tc-main-column,.tc-side{display:flex;flex-direction:column;gap:19px;min-width:0}
      .tc-card{padding:25px;border:1px solid var(--border);border-radius:18px;background:#fff;box-shadow:0 8px 30px #00000006}
      .tc-card-title{display:flex;gap:14px;align-items:center;margin-bottom:24px}
      .tc-card-title>span{width:42px;height:42px;display:grid;place-items:center;border-radius:12px;background:#111;color:white;font-weight:800}
      .tc-card-title h2,.tc-summary-title h2{font-size:18px;margin:0;font-weight:850}
      .tc-fields{display:flex;flex-direction:column;gap:18px}.tc-fields label{display:flex;flex-direction:column;gap:8px;font-size:12px;font-weight:750}
      .tc-fields input,.tc-fields textarea{width:100%;padding:13px 14px;border:1px solid #e5e5e5;border-radius:10px;background:#fafafa;color:#111;font:inherit;font-size:13px;outline:none}
      .tc-fields input:focus,.tc-fields textarea:focus{border-color:#111;background:white;box-shadow:0 0 0 3px #0000000a}
      .tc-fields textarea{resize:vertical}.tc-fields small{font-size:9px;color:#999}
      .tc-payment{display:flex;align-items:center;gap:13px;border:1px solid #ddd;border-radius:12px;padding:16px;background:#fafafa}
      .tc-payment>div{flex:1;display:flex;flex-direction:column;gap:5px}.tc-payment strong{font-size:13px}.tc-payment small{font-size:11px;color:#888}
      .tc-muted{font-size:11px;color:#888}.tc-summary{position:sticky;top:18px}
      .tc-summary-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px}.tc-summary-title h2{margin-top:6px}
      .tc-restaurant{display:flex;align-items:center;gap:12px;padding:13px;border:1px solid var(--border);border-radius:12px;background:#fafafa}
      .tc-restaurant>div{display:flex;flex-direction:column;gap:4px}.tc-restaurant strong{font-size:12px}.tc-restaurant small{font-size:10px;color:#888}
      .tc-items{display:flex;flex-direction:column;gap:16px;padding:20px 0}
      .tc-item{display:flex;align-items:center;gap:10px;font-size:12px}.tc-item>strong{white-space:nowrap}
      .tc-product-image{width:53px;height:53px;flex-shrink:0;border-radius:10px;overflow:hidden;background:#f5f5f5;display:grid;place-items:center}
      .tc-product-image img{width:100%;height:100%;object-fit:cover}
      .tc-product{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.tc-product strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .tc-product small{color:#888;font-size:10px}.tc-quantity{display:flex;align-items:center;gap:10px;margin-top:3px}
      .tc-quantity button{width:24px;height:24px;border:1px solid #ddd;border-radius:7px;background:white;display:grid;place-items:center;cursor:pointer}
      .tc-quantity button:hover{background:#111;color:#fff;border-color:#111}
      .tc-offer{display:flex;align-items:center;gap:11px;padding:14px;border:1px solid #d9e7dd;background:#f7fbf8;border-radius:12px}
      .tc-offer-icon{width:36px;height:36px;display:grid;place-items:center;background:#111;color:white;border-radius:10px;flex-shrink:0}
      .tc-offer-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:4px}.tc-offer-copy strong{font-size:12px}.tc-offer-copy small{font-size:10px;color:#777}
      .tc-applied{font-size:9px;font-weight:850;letter-spacing:1px;color:#28663d}
      .tc-breakdown{display:flex;flex-direction:column;gap:13px;padding:18px 0;border-top:1px solid #eee}
      .tc-breakdown>div{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:12px;color:#777}
      .tc-breakdown>div span{display:flex;align-items:center;gap:6px}.tc-breakdown strong{color:#222}
      .tc-breakdown .tc-discount,.tc-breakdown .tc-discount strong{color:#237343}
      .tc-breakdown .tc-total{border-top:1px dashed #ddd;padding-top:16px;margin-top:4px;color:#111;font-weight:850}
      .tc-total strong{font-size:19px;color:#111}
      .tc-place,.tc-primary{width:100%;min-height:51px;display:flex;align-items:center;justify-content:center;gap:10px;background:#111;color:white;border:0;border-radius:11px;font-weight:800;font-size:13px;text-decoration:none;cursor:pointer}
      .tc-place:hover,.tc-primary:hover{background:#333}.tc-place:disabled{opacity:.5;cursor:not-allowed}
      .tc-note{display:flex;justify-content:center;align-items:center;gap:7px;color:#888;font-size:10px}
      .tc-help{display:flex;gap:12px;padding:17px;border:1px solid var(--border);border-radius:13px;background:#fafafa}
      .tc-help strong{font-size:12px}.tc-help p{font-size:11px;color:#888;margin:5px 0 0}
      .tc-alert{display:flex;gap:10px;padding:14px;margin-bottom:18px;border:1px solid #f0cccc;border-radius:10px;background:#fff7f7;color:#a22;font-size:12px}
      .tc-info{background:#f8f8f8;border-color:#ddd;color:#555}
      .tc-footer{display:flex;justify-content:space-between;border-top:1px solid #eee;margin-top:40px;padding:22px 0;color:#999;font-size:11px}
      .tc-footer strong{letter-spacing:2px;color:#111}
      .tc-loading,.tc-success{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:13px}
      .tc-loading p,.tc-success p{font-size:13px;color:#888}
      .tc-success-icon{width:80px;height:80px;border-radius:24px;background:#f5f5f5;display:grid;place-items:center}
      .tc-success h1{font-size:42px;margin:0}.tc-order-number{width:min(100%,420px);padding:20px;border:1px dashed #ccc;border-radius:13px;display:flex;flex-direction:column;gap:8px}
      .tc-order-number span{font-size:10px;letter-spacing:1.5px;color:#888}.tc-order-number strong{font-size:28px}
      .tc-cod{width:min(100%,420px);display:flex;align-items:center;gap:12px;text-align:left;padding:16px;border:1px solid #ddd;border-radius:12px}
      .tc-cod p{margin:4px 0 0}.tc-secondary{color:#222;font-size:12px;text-decoration:none;padding:12px}
      .tc-spin{animation:tcspin 1s linear infinite}@keyframes tcspin{to{transform:rotate(360deg)}}
      @media(max-width:850px){.tc-layout{grid-template-columns:1fr}.tc-summary{position:static}}
      @media(max-width:520px){.tc-page{padding:22px 14px}.tc-card{padding:18px}.tc-heading{margin:30px 0 22px}.tc-heading h1{font-size:40px}}
      @media(prefers-reduced-motion:reduce){.tc-page *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
    `}</style>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<><Header /><main className="tc-page"><div className="tc-loading"><LoaderCircle size={28} />Loading checkout...</div></main><CheckoutStyles /></>}>
      <CheckoutInner />
    </Suspense>
  );
}
