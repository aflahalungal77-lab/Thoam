
"use client";

import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import type { FoodProduct, Restaurant } from "@/lib/types";
import {
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
  Tag,
  CalendarDays,
} from "lucide-react";

type PlacedOrder = {
  id?: string;
  order_number?: number | string;
  total_amount?: number | string;
  discount_amount?: number | string;
  offer_title?: string | null;
  status?: string;
  billing_code?: string;
};

type QROffer = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  scope: "order" | "products";
  discount_type: "percentage" | "fixed";
  discount_value: number | string;
  product_ids: string[] | null;
  min_order_amount: number | string;
  max_discount: number | string | null;
  starts_at: string | null;
  ends_at: string | null;
};

type NeedType =
  | "Tissue / Napkin"
  | "Additional food"
  | "Message to kitchen"
  | "Other";

function getOrCreateQRDeviceToken(restaurantId: string, tableCode: string): string {
  const key = `thoam:qr-device:${restaurantId}:${tableCode.toUpperCase()}:v1`;
  const existing = window.localStorage.getItem(key);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (existing && uuidPattern.test(existing)) return existing;

  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  const token = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  window.localStorage.setItem(key, token);
  return token;
}

export default function QRMenu() {
  const { t } = useLanguage();
  const params = useParams<{
    restaurantSlug: string;
    tableCode: string;
  }>();

  const restaurantSlug = params.restaurantSlug;
  const tableCode = decodeURIComponent(params.tableCode);

  const [r, setR] = useState<Restaurant | null>(null);
  const [tableId, setTableId] = useState("");

  const [items, setItems] = useState<FoodProduct[]>([]);
  const [offers, setOffers] = useState<QROffer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [selectedProduct, setSelectedProduct] = useState<FoodProduct | null>(null);
  const [selectedVariantName, setSelectedVariantName] = useState("");
  const [variantQuantity, setVariantQuantity] = useState(1);

  const [notes, setNotes] = useState("");
  const [itemNotes, setItemNotes] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [placedOrder, setPlacedOrder] =
    useState<PlacedOrder | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedImage, setSelectedImage] = useState<{ url: string; name: string } | null>(null);

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
            .select("id,name,slug,description,logo_url,qr_enabled")
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

        const [
          { data: products, error: productsError },
          { data: offerRows, error: offersError },
        ] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,restaurant_id,name,description,price,image_url,category,is_veg,is_available,variants"
            )
            .eq("restaurant_id", rest.id)
            .eq("is_available", true)
            .order("name"),
          supabase
            .from("offers")
            .select(
              "id,title,description,image_url,scope,discount_type,discount_value,product_ids,min_order_amount,max_discount,starts_at,ends_at"
            )
            .eq("restaurant_id", rest.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
        ]);

        if (productsError) throw productsError;
        if (offersError) {
          console.warn("QR offers could not be loaded:", offersError.message);
        }

        if (!cancelled) {
          setR(rest as Restaurant);
          setTableId(table.id);
          setItems((products ?? []) as FoodProduct[]);
          setOffers((offerRows ?? []) as QROffer[]);
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

  useEffect(() => {
    if (!checkoutOpen) return;
    function handleCheckoutKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) setCheckoutOpen(false);
    }
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleCheckoutKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleCheckoutKeyDown);
    };
  }, [checkoutOpen, submitting]);

  useEffect(() => {
    if (!selectedImage) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedImage(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImage]);

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

  const selectedItems = items.flatMap((product) => {
    if (product.variants?.length) return product.variants.map((variant) => {
      const key = `${product.id}::${variant.name}`;
      return { ...product, cartKey: key, variantName: variant.name, price: Number(variant.price), quantity: qty[key] || 0 };
    }).filter((item) => item.quantity > 0);
    return qty[product.id] > 0 ? [{ ...product, cartKey: product.id, variantName: "", quantity: qty[product.id] }] : [];
  });
  const total = selectedItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const cartCount = selectedItems.reduce((sum, item) => sum + item.quantity, 0);
  const now = Date.now();
  const activeOffers = offers.filter((offer) =>
    (!offer.starts_at || new Date(offer.starts_at).getTime() <= now) &&
    (!offer.ends_at || new Date(offer.ends_at).getTime() > now)
  );
  const selectedOffer = activeOffers.find((offer) => offer.id === selectedOfferId) ?? null;
  const selectedOfferEligibleSubtotal = selectedOffer
    ? selectedOffer.scope === "order"
      ? total
      : selectedItems.reduce((sum, item) =>
          (selectedOffer.product_ids ?? []).includes(item.id)
            ? sum + Number(item.price) * item.quantity
            : sum, 0)
    : 0;
  const offerMinimumMet = !!selectedOffer && total >= Number(selectedOffer.min_order_amount || 0);
  const offerHasEligibleItems = !!selectedOffer && selectedOfferEligibleSubtotal > 0;
  const rawOfferDiscount = selectedOffer && offerMinimumMet && offerHasEligibleItems
    ? selectedOffer.discount_type === "percentage"
      ? selectedOfferEligibleSubtotal * Number(selectedOffer.discount_value) / 100
      : Number(selectedOffer.discount_value)
    : 0;
  const discountAmount = selectedOffer
    ? Math.round(Math.min(
        selectedOfferEligibleSubtotal,
        selectedOffer.max_discount == null ? rawOfferDiscount : Math.min(rawOfferDiscount, Number(selectedOffer.max_discount))
      ) * 100) / 100
    : 0;
  const payableTotal = Math.max(0, total - discountAmount);

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
          deviceToken: getOrCreateQRDeviceToken(r.id, tableCode),
          notes: notes.trim(),
          offerId: discountAmount > 0 ? selectedOfferId : null,
          items: selectedItems.map((p) => ({
            productId: p.id,
            variantName: p.variantName || null,
            quantity: p.quantity,
            specialInstructions: (itemNotes[p.cartKey] || "").trim(),
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
      setCheckoutOpen(false);
      setQty({});
      setNotes("");
      setItemNotes({});
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
        <Link
          className="premium-brand"
          href="/"
          aria-label="Tho'am home"
        >
          {r?.logo_url ? (
            <img
              src={r.logo_url}
              alt={`${r.name} logo`}
              className="premium-restaurant-logo"
              width={32}
              height={32}
              style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, maxWidth: 32, maxHeight: 32, flex: "0 0 32px", objectFit: "contain", padding: 3, borderRadius: 9, background: "#f3f6f3", border: "1px solid #e6ece7" }}
            />
          ) : (
            <span className="premium-brand-mark">T.</span>
          )}
          <span>
            {r?.name || "Tho’am"}
            <small>{t("GOOD FOOD. GOOD MOMENTS.")}</small>
          </span>
        </Link>

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
          <h2>{t("Preparing your menu")}</h2>
          <p>
            Just a moment. Something delicious is on its way.
          </p>
        </section>
      ) : !r ? (
        /* ERROR */
        <section className="premium-state premium-error">
          <CircleAlert size={36} />
          <h2>{t("Menu unavailable")}</h2>
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

          <h1>{t("You're all set.")}</h1>

          <p className="success-description">
            Your KOT has been sent to{" "}
            <strong>{r.name}</strong>. Sit back and enjoy your
            time.
          </p>

          <div className="success-receipt">
            <div className="receipt-row">
              <span>{t("Restaurant")}</span>
              <strong>{r.name}</strong>
            </div>

            {placedOrder.billing_code && (
              <div className="success-billing-code">
                <span className="success-billing-label">YOUR TABLE BILLING CODE</span>
                <strong>{placedOrder.billing_code}</strong>
                <small>Use this same code when placing another order from this phone at Table {tableCode}.</small>
              </div>
            )}

            {placedOrder.order_number != null && (
              <div className="receipt-row">
                <span>{t("KOT number")}</span>
                <strong>
                  #{placedOrder.order_number}
                </strong>
              </div>
            )}

            <div className="receipt-row">
              <span>{t("Table")}</span>
              <strong>{tableCode}</strong>
            </div>

            <div className="receipt-row">
              <span>{t("Payment")}</span>
              <strong>{t("Cash at restaurant")}</strong>
            </div>

            {Number(placedOrder.discount_amount || 0) > 0 && (
              <div className="receipt-row">
                <span>{placedOrder.offer_title || "Offer discount"}</span>
                <strong>−₹{Number(placedOrder.discount_amount).toFixed(2)}</strong>
              </div>
            )}

            <div className="receipt-total">
              <span>{t("Total amount")}</span>
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
          <section className="premium-menu-content">
            {/* MENU HEADING */}
            <div className="menu-heading">
              <div>
                <span className="premium-kicker">
                  THE GOOD STUFF
                </span>

                <h2>
                  {t("Explore the menu")}<span>.</span>
                </h2>

                <p>{t("Find something you’ll love.")}</p>
              </div>

              <div className="menu-count">
                <strong>
                  {items.length.toString().padStart(2, "0")}
                </strong>
                <span>{t("ITEMS")}</span>
              </div>
            </div>

            {/* SEARCH */}
            <label className="premium-search">
              <Search size={19} />

              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search dishes...")}
                aria-label={t("Search dishes...")}
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
                <h3>{t("The menu is being prepared.")}</h3>
                <p>{t("Please check back in a little while.")}</p>
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="premium-empty">
                <Search size={30} />
                <h3>{t("No dishes found")}</h3>
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
                  const count = (qty[p.id] || 0) + Object.entries(qty).filter(([key]) => key.startsWith(`${p.id}::`)).reduce((sum, [, value]) => sum + Number(value || 0), 0);

                  return (
                    <article
                      className={`premium-food-card ${
                        count > 0 ? "is-selected" : ""
                      }`}
                      key={p.id}
                    >
                      <div className="premium-food-image">
                        {p.image_url ? (
                          <button type="button" className="premium-image-trigger" onClick={() => setSelectedImage({ url: p.image_url || "", name: p.name })} aria-label="View food photo">
                            <Image src={p.image_url} alt={p.name} fill unoptimized sizes="(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 260px" className="premium-food-photo" />
                            <span className="image-view-hint">VIEW PHOTO</span>
                          </button>
                        ) : (
                          <div className="food-placeholder">
                            <UtensilsCrossed
                              size={35}
                              strokeWidth={1.2}
                            />
                            <span>{t("FRESH & DELICIOUS")}</span>
                          </div>
                        )}

                        <span className="food-index">
                          {String(index + 1).padStart(2, "0")}
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
                            {p.variants?.length ? "From " : ""}₹{Number(p.variants?.length ? Math.min(...p.variants.map((v) => Number(v.price))) : p.price).toFixed(0)}
                          </strong>

                          {p.variants?.length ? (
                            <button className="premium-add-button" onClick={() => { setSelectedProduct(p); setSelectedVariantName(p.variants?.find((variant) => variant.is_available !== false)?.name || ""); setVariantQuantity(1); }}>
                              {count ? "ADD MORE" : "CHOOSE SIZE"} <Plus size={15} />
                            </button>
                          ) : count === 0 ? (
                            <button className="premium-add-button" onClick={() => changeQty(p.id, 1)} aria-label={`Add ${p.name} to your order`}>
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

            {            {/* ACTIVE RESTAURANT OFFERS */}
            {activeOffers.length > 0 && (
              <section className="qr-offers-section" aria-labelledby="qr-offers-title">
                <div className="qr-offers-heading">
                  <div>
                    <span className="premium-kicker">
                      <Tag size={13} /> LIMITED-TIME DEALS
                    </span>
                    <h2 id="qr-offers-title">Offers for you<span>.</span></h2>
                    <p>Explore current deals from {r.name}.</p>
                  </div>
                  <span className="qr-offers-count">
                    {activeOffers.length.toString().padStart(2, "0")} ACTIVE
                  </span>
                </div>

                <div className="qr-offers-grid">
                  {activeOffers.map((offer) => {
                    const discountLabel =
                      offer.discount_type === "percentage"
                        ? `${Number(offer.discount_value)}% OFF`
                        : `₹${Number(offer.discount_value).toFixed(0)} OFF`;
                    const applicableProducts =
                      offer.scope === "products"
                        ? items
                            .filter((product) => (offer.product_ids ?? []).includes(product.id))
                            .map((product) => product.name)
                        : [];
                    const validityLabel = offer.ends_at
                      ? `Valid until ${new Date(offer.ends_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}`
                      : offer.starts_at
                        ? `Starts ${new Date(offer.starts_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}`
                        : "Limited-time offer";

                    return (
                      <article className="qr-offer-card" key={offer.id}>
                        <div className="qr-offer-media">
                          {offer.image_url ? (
                            <Image
                              src={offer.image_url}
                              alt={offer.title}
                              fill
                              unoptimized
                              sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 560px"
                              className="qr-offer-image"
                            />
                          ) : (
                            <div className="qr-offer-image-placeholder">
                              <Tag size={34} />
                              <span>EXCLUSIVE DEAL</span>
                            </div>
                          )}
                          <span className="qr-offer-discount">{discountLabel}</span>
                        </div>

                        <div className="qr-offer-content">
                          <span className="qr-offer-scope">
                            {offer.scope === "products" ? "SELECTED MENU ITEMS" : "ORDER OFFER"}
                          </span>
                          <h3>{offer.title}</h3>
                          {offer.description && <p>{offer.description}</p>}

                          {offer.scope === "products" && (
                            <div className="qr-offer-products">
                              <strong>Applies to</strong>
                              <span>
                                {applicableProducts.length
                                  ? applicableProducts.join(" · ")
                                  : "Selected menu items"}
                              </span>
                            </div>
                          )}

                          <div className="qr-offer-conditions">
                            {Number(offer.min_order_amount) > 0 && (
                              <span>Min. order ₹{Number(offer.min_order_amount).toFixed(0)}</span>
                            )}
                            {offer.max_discount !== null && (
                              <span>Max. discount ₹{Number(offer.max_discount).toFixed(0)}</span>
                            )}
                          </div>

                          <div className="qr-offer-validity">
                            <CalendarDays size={14} />
                            {validityLabel}
                          </div>
                          <p className="qr-offer-note">
                            Offer details are subject to the restaurant&apos;s terms.
                          </p>
                          <p className="qr-offer-checkout-hint">Select this offer in checkout to apply.</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

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

                  <h3>{t("Need anything?")}</h3>

                  <p>
                    We&apos;re here to help. Request directly from
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

                    <h3>{t("How can we help?")}</h3>
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
                    <span>({t("OPTIONAL")})</span>

                    <textarea
                      value={needMessage}
                      onChange={(e) =>
                        setNeedMessage(e.target.value)
                      }
                      maxLength={300}
                      rows={3}
                      placeholder={t("Tell us what you need...")}
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



            selectedProduct && (
              <div className="thoam-variant-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null); }}>
                <section className="thoam-variant-modal" role="dialog" aria-modal="true" aria-labelledby="qr-variant-title">
                  <button type="button" className="thoam-variant-close" onClick={() => setSelectedProduct(null)} aria-label="Close"><X size={19} /></button>
                  {selectedProduct.image_url ? <img src={selectedProduct.image_url} alt={selectedProduct.name} /> : <div className="thoam-variant-image-placeholder"><UtensilsCrossed size={30} /></div>}
                  <span className="premium-kicker">CHOOSE YOUR PORTION</span><h2 id="qr-variant-title">{selectedProduct.name}</h2>
                  <div className="thoam-variant-options">{(selectedProduct.variants || []).filter((variant) => variant.is_available !== false).map((variant) => <button type="button" key={variant.name} className={selectedVariantName === variant.name ? "selected" : ""} onClick={() => setSelectedVariantName(variant.name)}><strong>{variant.name}</strong><b>₹{Number(variant.price).toFixed(0)}</b></button>)}</div>
                  <div className="thoam-variant-bottom"><div className="premium-quantity"><button type="button" onClick={() => setVariantQuantity((n) => Math.max(1,n-1))}><Minus size={14}/></button><strong>{variantQuantity}</strong><button type="button" onClick={() => setVariantQuantity((n) => Math.min(50,n+1))}><Plus size={14}/></button></div><button type="button" className="premium-button premium-button-black" onClick={() => { if (selectedProduct && selectedVariantName) { changeQty(`${selectedProduct.id}::${selectedVariantName}`, variantQuantity); setSelectedProduct(null); } }}>Done · Add <ArrowRight size={16}/></button></div>
                </section>
              </div>
            )}

            {/* CHECKOUT */}
            {cartCount > 0 && checkoutOpen && (
              <div className="qr-checkout-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) setCheckoutOpen(false); }}>
              <section
                className="premium-checkout qr-checkout-modal"
                id="checkout"
                role="dialog"
                aria-modal="true"
                aria-labelledby="qr-checkout-title"
              >
                <div className="checkout-heading">
                  <div className="checkout-icon">
                    <ShoppingBag size={21} />
                  </div>

                  <div>
                    <span className="premium-kicker">
                      ALMOST THERE
                    </span>

                    <h2 id="qr-checkout-title">{t("Your order")}</h2>

                    <p>
                      {cartCount}{" "}
                      {cartCount === 1 ? t("item") : t("items")}{" "}
                      selected
                    </p>
                  </div>

                  <strong className="checkout-total">
                    ₹{payableTotal.toFixed(2)}
                  </strong>
                  <button type="button" className="qr-checkout-close" onClick={() => setCheckoutOpen(false)} disabled={submitting} aria-label="Close checkout"><X size={19} /></button>
                </div>



                {activeOffers.length > 0 && (
                  <div className="qr-inline-offer">
                    <Tag size={16} />
                    <select
                      aria-label="Select an offer"
                      value={selectedOfferId || ""}
                      onChange={(event) => setSelectedOfferId(event.target.value || null)}
                    >
                      <option value="">Apply an offer</option>
                      {activeOffers.map((offer) => {
                        const eligibleSubtotal = offer.scope === "order"
                          ? total
                          : selectedItems.reduce((sum, item) =>
                              (offer.product_ids ?? []).includes(item.id)
                                ? sum + Number(item.price) * item.quantity
                                : sum, 0);
                        const eligible = total >= Number(offer.min_order_amount || 0) && eligibleSubtotal > 0;
                        const amount = offer.discount_type === "percentage"
                          ? `${Number(offer.discount_value)}% off`
                          : `₹${Number(offer.discount_value).toFixed(0)} off`;
                        return (
                          <option key={offer.id} value={offer.id} disabled={!eligible}>
                            {offer.title} · {amount}{!eligible ? " · Not eligible" : ""}
                          </option>
                        );
                      })}
                    </select>
                    {selectedOfferId && (
                      <button type="button" onClick={() => setSelectedOfferId(null)}>Remove</button>
                    )}
                    {selectedOffer && offerMinimumMet && offerHasEligibleItems && (
                      <span className="qr-inline-offer-applied">Applied</span>
                    )}
                  </div>
                )}
                <div className="checkout-items">
                  {selectedItems.map((p) => (
                    <div
                      className="checkout-item"
                      key={p.cartKey}
                    >
                      <div>
                        <strong>{p.name}{p.variantName ? ` · ${p.variantName}` : ""}</strong>
                        <span>₹{Number(p.price).toFixed(2)} × {p.quantity}</span>
                      </div>
                      <strong>₹{(Number(p.price) * p.quantity).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>

                <div className="checkout-form">

                  <details className="qr-kitchen-details">
                    <summary>Kitchen notes <span>(optional)</span></summary>
                    {selectedItems.map((p) => (
                      <label className="premium-field notes-field" key={p.cartKey}>
                        <span>{p.name}{p.variantName ? ` · ${p.variantName}` : ""}</span>
                        <textarea
                          maxLength={300}
                          value={itemNotes[p.cartKey] || ""}
                          onChange={(e) => setItemNotes((current) => ({ ...current, [p.cartKey]: e.target.value }))}
                          placeholder={t("Less spicy, no onions, etc. (optional)")}
                          rows={2}
                        />
                      </label>
                    ))}
                  </details>
                  <label className="premium-field notes-field qr-order-note">
                    <span>{t("Order note (optional)")}</span>
                    <textarea
                      maxLength={500}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={t("Any note for the whole order (optional)")}
                      rows={2}
                    />
                  </label>

                  {status && (
                    <p className="premium-notice" role="status">
                      <CircleAlert size={17} />
                      {status}
                    </p>
                  )}

                  <div className="qr-checkout-totals">
                  <div><span>Subtotal</span><strong>₹{total.toFixed(2)}</strong></div>
                  {discountAmount > 0 && <div className="qr-discount-line"><span>{selectedOffer?.title || "Offer discount"}</span><strong>−₹{discountAmount.toFixed(2)}</strong></div>}
                  <div className="qr-payable-line"><span>To pay at restaurant</span><strong>₹{payableTotal.toFixed(2)}</strong></div>
                </div>

                <div className="checkout-payment">
                    <div className="cash-symbol">₹</div>

                    <div>
                      <strong>{t("Pay at the restaurant")}</strong>
                      <span>
                        Cash payment · No online payment needed
                      </span>
                    </div>

                    <span className="cash-badge">CASH</span>
                  </div>

                  <button
                    className="premium-button premium-button-black place-order-button"
                    disabled={payableTotal <= 0 || submitting || (!!selectedOfferId && (!selectedOffer || !offerMinimumMet || !offerHasEligibleItems))}
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
                        <span>₹{payableTotal.toFixed(2)}</span>
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
              </div>
            )}
          </section>
        </>
      )}

      {selectedImage && (
        <div className="food-lightbox" role="dialog" aria-modal="true" aria-label={selectedImage.name + " photo"} onClick={() => setSelectedImage(null)}>
          <button type="button" className="food-lightbox-close" onClick={() => setSelectedImage(null)} aria-label="Close photo preview">
            <X size={22} />
          </button>
          <div className="food-lightbox-content" onClick={(event) => event.stopPropagation()}>
            <Image src={selectedImage.url} alt={selectedImage.name} width={1200} height={900} unoptimized />
            <p>{selectedImage.name}</p>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="premium-menu-footer">
        <Link className="premium-footer-brand" href="/">
          THO’AM<span>.</span>
        </Link>

        <span>{t("Good food. Good moments.")}</span>

        <span className="footer-table">
          TABLE {tableCode}
        </span>
      </footer>

      {/* STICKY CART */}
      {r && !loading && !placedOrder && cartCount > 0 && (
        <button
          className="premium-sticky-cart"
          onClick={() => setCheckoutOpen(true)}
        >
          <span className="sticky-cart-count">
            {cartCount}
          </span>

          <span>
            <strong>{t("View your order")}</strong>
            <small>
              {cartCount}{" "}
              {cartCount === 1 ? "item" : "items"}
            </small>
          </span>

          <strong className="sticky-cart-total">
            ₹{payableTotal.toFixed(2)}
          </strong>

          <ArrowRight size={19} />
        </button>
      )}

      {/* INTERNAL CSS */}
      <style jsx>{`
.thoam-variant-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:18px;background:#0009;backdrop-filter:blur(5px)}
.thoam-variant-modal{position:relative;width:min(100%,430px);padding:22px;border-radius:20px;background:#fff;color:#111;box-shadow:0 25px 80px #0004}
.thoam-variant-modal>img,.thoam-variant-image-placeholder{width:100%;height:180px;object-fit:cover;border-radius:13px;margin-bottom:16px;background:#f4f4f4}
.thoam-variant-image-placeholder{display:grid;place-items:center;color:#999}
.thoam-variant-close{position:absolute;right:12px;top:12px;z-index:2;width:35px;height:35px;border:0;border-radius:50%;background:white;display:grid;place-items:center}
.thoam-variant-modal h2{margin:7px 0 14px;font-size:23px}
.thoam-variant-options{display:grid;gap:8px}
.thoam-variant-options button{display:flex;justify-content:space-between;padding:13px;border:1px solid #e8e8e8;border-radius:10px;background:white}
.thoam-variant-options button.selected{border-color:#176b49;background:#f1f8f4}
.thoam-variant-bottom{display:flex;gap:10px;margin-top:16px}.thoam-variant-bottom .premium-button{flex:1}


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
  min-width: 0;
  color: var(--black);
  text-decoration: none;
  font-family: 'Manrope', sans-serif;
  font-size: 23px;
  font-weight: 800;
  letter-spacing: -1.2px;
}

.premium-brand img,.premium-brand .premium-restaurant-logo { display:block; width:38px !important; height:38px !important; min-width:38px; min-height:38px; max-width:38px !important; max-height:38px !important; flex:0 0 38px; object-fit:contain !important; border-radius:10px; overflow:hidden; background:#f4f6f4; }
.premium-brand > span { min-width:0; }
.premium-brand > span small { display:block; margin-top:2px; font-size:8px; letter-spacing:1.2px; }

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
  min-height: 285px;
  margin: 18px auto 30px;
  padding: 34px 6%;
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
  margin: 12px 0 11px;
  font-family: 'Manrope', sans-serif;
  font-size: clamp(40px, 5.2vw, 66px);
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
  line-height: 1.65;
}

.hero-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 23px;
  margin-top: 14px;
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

/* QR RESTAURANT OFFERS */

.premium-logo-frame {
  position: relative;
  display: block;
  width: 48px;
  height: 48px;
  min-width: 48px;
  flex: 0 0 48px;
  overflow: hidden;
  border-radius: 12px;
  isolation: isolate;
  background: #f1f5f2;
}
.premium-logo-frame .premium-logo-image {
  display: block !important;
  width: 48px !important;
  height: 48px !important;
  max-width: 48px !important;
  max-height: 48px !important;
  object-fit: contain !important;
}
.qr-offers-section {
  margin: 0 0 42px;
  padding: 30px;
  border: 1px solid #e2eee6;
  border-radius: 22px;
  background: linear-gradient(145deg, #f8fcf9, #ffffff 68%, #f0f8f3);
  box-shadow: 0 14px 38px #173e2b0b;
}
.qr-offers-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 22px;
}
.qr-offers-heading .premium-kicker {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: #168052;
}
.qr-offers-heading h2 {
  margin: 9px 0 5px;
  color: #17251d;
  font-size: clamp(26px, 3vw, 36px);
  letter-spacing: -1.5px;
  font-weight: 800;
}
.qr-offers-heading h2 span { color: #198454; }
.qr-offers-heading p {
  margin: 0;
  color: #77847b;
  font-size: 13px;
}
.qr-offers-count {
  flex: 0 0 auto;
  padding: 8px 11px;
  border-radius: 999px;
  background: #e5f4eb;
  color: #176b49;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 1px;
}
.qr-offers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 300px));
  justify-content: start;
  gap: 14px;
}
.qr-offer-card {
  min-width: 0;
  max-width: 300px;
  overflow: hidden;
  border: 1px solid #e6eee8;
  border-radius: 15px;
  background: #fff;
  box-shadow: 0 8px 24px #183b290b;
  transition: transform .22s ease, box-shadow .22s ease;
}
.qr-offer-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 13px 28px #183b2915;
}
.qr-offer-media {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 6.5;
  min-height: 92px;
  max-height: 122px;
  overflow: hidden;
  background: linear-gradient(135deg, #0e3928, #1e8055);
}
.qr-offer-image {
  object-fit: cover;
  transition: transform .35s ease;
}
.qr-offer-card:hover .qr-offer-image { transform: scale(1.035); }
.qr-offer-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  color: #c8f2d8;
}
.qr-offer-image-placeholder span {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 2px;
}
.qr-offer-discount {
  position: absolute;
  top: 9px;
  left: 9px;
  padding: 7px 9px;
  border: 1px solid #ffffff55;
  border-radius: 8px;
  background: #0d392bef;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: -.2px;
  box-shadow: 0 5px 18px #0003;
}
.qr-offer-content { padding: 14px 15px 13px; }
.qr-offer-scope {
  color: #188052;
  font-size: 9px;
  font-weight: 850;
  letter-spacing: 1.5px;
}
.qr-offer-content h3 {
  margin: 6px 0 5px;
  color: #17251d;
  font-size: 17px;
  line-height: 1.25;
  letter-spacing: -.45px;
}
.qr-offer-content > p {
  margin: 0;
  color: #6d7b72;
  font-size: 12px;
  line-height: 1.65;
}
.qr-offer-products {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 13px;
  padding: 11px 12px;
  border-radius: 10px;
  background: #f4f8f5;
  color: #64736a;
  font-size: 11px;
  line-height: 1.5;
}
.qr-offer-products strong { color: #244a35; font-size: 10px; }
.qr-offer-conditions {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-top: 13px;
}
.qr-offer-conditions span {
  padding: 6px 9px;
  border-radius: 7px;
  background: #fff7e9;
  color: #8a5b18;
  font-size: 10px;
  font-weight: 700;
}
.qr-offer-validity {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-top: 14px;
  color: #64756a;
  font-size: 11px;
}
.qr-offer-note {
  margin-top: 9px !important;
  padding-top: 9px;
  border-top: 1px solid #edf1ee;
  color: #929b94 !important;
  font-size: 10px !important;
}

.qr-offer-checkout-hint {
  margin: 12px 0 0 !important;
  padding-top: 10px;
  border-top: 1px solid #edf1ee;
  color: #176b49 !important;
  font-size: 10px !important;
  font-weight: 750;
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
.premium-image-trigger { position:absolute; inset:0; display:block; width:100%; height:100%; padding:0; border:0; background:transparent; cursor:zoom-in; }
.image-view-hint { position:absolute; right:12px; bottom:12px; z-index:2; padding:7px 10px; border:1px solid #ffffff70; border-radius:999px; background:#101713bd; color:#fff; font-size:8px; font-weight:800; letter-spacing:1px; opacity:0; transform:translateY(4px); transition:opacity .2s ease,transform .2s ease; }
.premium-food-image:hover .image-view-hint,.premium-image-trigger:focus-visible .image-view-hint { opacity:1; transform:translateY(0); }
.food-lightbox { position:fixed; inset:0; z-index:1000; display:grid; place-items:center; padding:24px; background:#050907ef; backdrop-filter:blur(12px); animation:fadeUp .18s ease; }
.food-lightbox-close { position:absolute; top:max(18px,env(safe-area-inset-top)); right:max(18px,env(safe-area-inset-right)); z-index:2; display:grid; width:46px; height:46px; place-items:center; border:1px solid #ffffff35; border-radius:50%; background:#ffffff18; color:#fff; }
.food-lightbox-content { display:grid; justify-items:center; gap:14px; width:min(900px,100%); max-height:90vh; }
.food-lightbox-content img { display:block; max-width:100%; max-height:78vh; object-fit:contain; border-radius:14px; box-shadow:0 24px 80px #0008; }
.food-lightbox-content p { margin:0; color:#fff; font-size:14px; font-weight:750; text-align:center; }

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



/* Compact QR checkout controls */
.qr-inline-offer {
  display:flex; align-items:center; gap:10px;
  margin:12px 0; padding:10px 12px;
  border:1px solid #dce9df; border-radius:12px;
  background:#f5faf6; color:#176b49;
}
.qr-inline-offer select {
  flex:1; min-width:0; border:0; outline:0;
  background:transparent; color:#213b2b;
  font:600 12px inherit; cursor:pointer;
}
.qr-inline-offer button {
  border:0; background:transparent; color:#a04d3c;
  font-size:11px; font-weight:750; cursor:pointer;
}
.qr-inline-offer-applied { font-size:10px; font-weight:800; color:#16834d; white-space:nowrap; }
.qr-kitchen-details {
  margin:10px 0; border:1px solid #e3ebe5;
  border-radius:11px; background:#fff;
}
.qr-kitchen-details summary {
  padding:11px 13px; color:#344b3a;
  font-size:12px; font-weight:750; cursor:pointer;
}
.qr-kitchen-details summary span { color:#89958c; font-weight:500; }
.qr-kitchen-details[open] { padding-bottom:10px; }
.qr-kitchen-details .premium-field { margin:8px 12px 0; }
.qr-order-note { margin-top:10px; }
.qr-checkout-modal .checkout-items { padding:10px 0; }
.qr-checkout-modal .checkout-item { padding:7px 0; }
.qr-checkout-modal .checkout-form { padding-top:10px; }
.qr-checkout-modal .checkout-form-heading { display:none; }
.qr-checkout-modal .notes-field textarea { min-height:58px; }
.qr-checkout-modal .checkout-payment { margin-top:12px; padding:12px; }
.qr-checkout-modal .checkout-terms { margin-top:8px; font-size:10px; }
@media(max-width:600px) {
 .qr-inline-offer { padding:9px 10px; }
 .qr-checkout-modal .checkout-item { font-size:11px; }
 .qr-checkout-modal .checkout-payment { padding:10px; }
}

/* QR CHECKOUT MODAL */
.qr-checkout-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  overflow-y: auto;
  background: rgba(8, 18, 13, .62);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  animation: fadeUp .18s ease;
}
.qr-checkout-modal {
  position: relative;
  width: min(760px, 100%);
  max-height: min(88vh, 900px);
  margin: auto;
  padding: 28px;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid #dce8df;
  border-radius: 22px;
  background: linear-gradient(150deg, #fff 0%, #f8fbf8 100%);
  box-shadow: 0 30px 100px rgba(0,0,0,.28);
  animation: fadeUp .22s ease;
}
.qr-checkout-close {
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  display: grid;
  place-items: center;
  margin-left: 8px;
  border: 1px solid #e1e9e3;
  border-radius: 50%;
  background: #fff;
  color: #23372b;
  cursor: pointer;
}
.qr-checkout-close:hover { background: #edf5ef; }
.qr-checkout-close:disabled { opacity: .45; cursor: not-allowed; }
.qr-modal-offers {
  margin: 20px 0 4px;
  padding: 16px;
  border: 1px solid #dce9df;
  border-radius: 15px;
  background: #f7fbf8;
}
.qr-modal-offers-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.qr-modal-offers-heading > span {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #176b49;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 1px;
}
.qr-modal-offers-heading small { color: #87958b; font-size: 10px; }
.qr-modal-offers-list { display: grid; gap: 9px; }
.qr-modal-offer {
  display: flex;
  align-items: center;
  gap: 11px;
  min-width: 0;
  padding: 12px;
  border: 1px solid #e2ebe4;
  border-radius: 12px;
  background: #fff;
  transition: border-color .18s, background .18s;
}
.qr-modal-offer.is-applied {
  border-color: #82b99a;
  background: #eff8f1;
}
.qr-modal-offer-icon {
  width: 36px;
  height: 36px;
  flex: 0 0 36px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  background: #eaf4ed;
  color: #176b49;
}
.qr-modal-offer-copy { display: grid; gap: 3px; flex: 1; min-width: 0; }
.qr-modal-offer-copy strong { color: #1b2c21; font-size: 12px; }
.qr-modal-offer-copy span { color: #587362; font-size: 10px; font-weight: 750; }
.qr-modal-offer-copy small { color: #a15b43; font-size: 9px; line-height: 1.4; }
.qr-modal-offer-copy small.qr-modal-offer-success { color: #16834d; }
.qr-modal-offer > button {
  min-width: 72px;
  min-height: 34px;
  padding: 0 11px;
  border: 1px solid #174b33;
  border-radius: 9px;
  background: #174b33;
  color: #fff;
  font-size: 10px;
  font-weight: 850;
  cursor: pointer;
}
.qr-modal-offer.is-applied > button { border-color: #b8d8c1; background: #e5f3e9; color: #176b49; }
.qr-modal-offer > button:disabled { border-color: #e2e8e3; background: #edf1ee; color: #98a49b; cursor: not-allowed; }
@media (max-width: 600px) {
  .qr-checkout-backdrop { place-items: end center; padding: 0; }
  .qr-checkout-modal {
    width: 100%;
    max-height: 94dvh;
    padding: 20px 16px calc(22px + env(safe-area-inset-bottom));
    border-radius: 22px 22px 0 0;
    border-bottom: 0;
  }
  .qr-checkout-modal .checkout-heading { gap: 10px; padding-bottom: 16px; }
  .qr-checkout-modal .checkout-icon { width: 40px; height: 40px; }
  .qr-checkout-modal .checkout-heading h2 { font-size: 19px; }
  .qr-checkout-modal .checkout-total { font-size: 17px; }
  .qr-checkout-close { width: 34px; height: 34px; flex-basis: 34px; }
  .qr-modal-offers { margin-top: 15px; padding: 12px; }
  .qr-modal-offer { gap: 8px; padding: 10px; }
  .qr-modal-offer-icon { width: 32px; height: 32px; flex-basis: 32px; }
  .qr-modal-offer > button { min-width: 62px; padding: 0 8px; }
  .qr-checkout-modal .checkout-items { padding: 13px 0; }
  .qr-checkout-modal .checkout-form { padding-top: 16px; }
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

.success-billing-code {
  display: grid;
  justify-items: center;
  gap: 8px;
  margin: 0 0 14px;
  padding: 18px 14px;
  border: 1px solid #b9ddc7;
  border-radius: 12px;
  background: linear-gradient(145deg, #f2faf4, #e7f4eb);
  text-align: center;
}

.success-billing-label {
  color: #527260;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 1.5px;
}

.success-billing-code strong {
  color: #176b49;
  font-size: 30px;
  font-weight: 900;
  letter-spacing: 4px;
  line-height: 1.2;
}

.success-billing-code small {
  max-width: 300px;
  color: #587163;
  font-size: 10px;
  line-height: 1.6;
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

/* QR MENU FIRST — compact scan-to-order layout */
.premium-menu-header { height: 68px; }
.premium-menu-content { margin-top: 18px; }
.menu-heading { margin-top: 4px; }
.premium-food-grid { align-items: start; }
.premium-food-card { overflow: hidden; }
.premium-food-image { height: 190px; }
.premium-sticky-cart { bottom: max(14px, env(safe-area-inset-bottom)); }
@media (max-width: 600px) {
  .premium-menu-header { height: 60px; }
  .premium-menu-content { margin-top: 12px; padding-bottom: 100px; }
  .premium-food-image { height: 132px; }
  .premium-food-info { padding: 11px; }
  .premium-food-bottom { margin-top: 13px; }
  .premium-food-description { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .premium-categories { position: sticky; top: 0; z-index: 15; padding: 8px 0; background: var(--surface, #fff); }
  .premium-sticky-cart { bottom: max(10px, env(safe-area-inset-bottom)); }
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
    min-height: 245px;
    margin: 10px auto 22px;
    padding: 20px 18px 58px;
    border-radius: 16px;
  }

  .hero-copy h1 {
    font-size: clamp(31px, 9vw, 40px);
    letter-spacing: -3px;
  }

  .hero-copy > p {
    max-width: 275px;
    font-size: 12px;
  }

  .hero-meta {
    gap: 10px;
    margin-top: 10px;
    font-size: 8px;
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

  .qr-offer-apply{display:inline-flex;min-height:38px;align-items:center;justify-content:center;margin-top:12px;padding:0 15px;border:1px solid #173e2b;border-radius:10px;background:#173e2b;color:#fff;font-size:10px;font-weight:850;cursor:pointer}
  .qr-offer-apply.is-selected{border-color:#b6d9c2;background:#eaf6ee;color:#17643a}
  .qr-offer-apply:disabled{cursor:not-allowed;opacity:.45}
  .qr-checkout-offer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:16px 0;padding:13px 14px;border:1px solid #dcebe0;border-radius:12px;background:#f5faf6;color:#315640;font-size:11px}
  .qr-checkout-offer>div,.qr-checkout-offer>span{display:flex;align-items:center;gap:9px}
  .qr-checkout-offer span span{display:grid;gap:3px}
  .qr-checkout-offer small{display:block;color:#7c8d80;font-size:9px}
  .qr-checkout-offer button{border:0;background:transparent;color:#9b3f35;font-size:10px;font-weight:800}
  .qr-offer-feedback{margin:0;color:#a34b40;font-size:10px}
  .qr-checkout-totals{display:grid;gap:9px;padding:14px 0;border-top:1px solid var(--border)}
  .qr-checkout-totals>div{display:flex;justify-content:space-between;gap:12px;color:var(--muted);font-size:12px}
  .qr-checkout-totals .qr-discount-line{color:#18834c}
  .qr-checkout-totals .qr-payable-line{padding-top:10px;border-top:1px dashed var(--border);color:var(--foreground);font-size:14px;font-weight:900}
  .qr-offers-section {
    margin-bottom: 30px;
    padding: 19px 15px;
    border-radius: 16px;
  }

  .qr-offers-heading {
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .qr-offers-heading h2 { font-size: 27px; }
  .qr-offers-heading p { max-width: 220px; font-size: 11px; }
  .qr-offers-count { padding: 7px 8px; font-size: 8px; }
  .qr-offers-grid { grid-template-columns: minmax(0, 1fr); gap: 11px; }
  .qr-offer-card { width: 100%; max-width: 100%; }
  .qr-offer-media { aspect-ratio: 16 / 6.5; min-height: 88px; max-height: 112px; }
  .qr-offer-content { padding: 13px 14px; }
  .qr-offer-content h3 { font-size: 16px; }

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
