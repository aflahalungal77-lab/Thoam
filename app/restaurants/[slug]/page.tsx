"use client";

import { useLanguage } from "@/components/LanguageProvider";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import {
  ArrowLeft,
  ShoppingBag,
  Leaf,
  Drumstick,
  Search,
  Plus,
  Minus,
  MapPin,
  Clock3,
  X,
  Utensils,
  Trash2,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { FoodProduct, Restaurant } from "@/lib/types";

type FoodFilter = "all" | "veg" | "nonveg";

type RestaurantOffer = {
  id: string;
  restaurant_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  scope: "order" | "products";
  discount_type: "percentage" | "fixed";
  discount_value: number;
  product_ids: string[] | null;
  min_order_amount: number | null;
  max_discount: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
};

type ProductMenuSchedule = {
  product_id: string;
  weekdays: number[];
  starts_at: string;
  ends_at: string;
};

function getIndiaClock() {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit",
    minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return { weekday: weekdayMap[values.weekday] ?? 0, time: `${values.hour}:${values.minute}` };
}

function isWithinMenuSchedule(
  schedules: ProductMenuSchedule[], productId: string, weekday: number, time: string
) {
  const windows = schedules.filter((schedule) => schedule.product_id === productId);
  if (windows.length === 0) return true;
  return windows.some((schedule) => {
    const start = String(schedule.starts_at).slice(0, 5);
    const end = String(schedule.ends_at).slice(0, 5);
    return schedule.weekdays.includes(weekday) && time >= start && time < end;
  });
}

function isOfferCurrentlyValid(offer: RestaurantOffer) {
  const now = Date.now();

  if (!offer.is_active) return false;

  if (offer.starts_at) {
    const start = new Date(offer.starts_at).getTime();
    if (!Number.isNaN(start) && now < start) return false;
  }

  if (offer.ends_at) {
    const end = new Date(offer.ends_at).getTime();
    if (!Number.isNaN(end) && now > end) return false;
  }

  return true;
}

export default function RestaurantPage() {
  const { t } = useLanguage();
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [offers, setOffers] = useState<RestaurantOffer[]>([]);
  const [menuSchedules, setMenuSchedules] = useState<ProductMenuSchedule[]>([]);
  const [scheduleReady, setScheduleReady] = useState(false);
  const [indiaClock, setIndiaClock] = useState({ weekday: -1, time: "--:--" });
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [foodFilter, setFoodFilter] = useState<FoodFilter>("all");
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<FoodProduct | null>(null);
  const [selectedVariantName, setSelectedVariantName] = useState("");
  const [variantQuantity, setVariantQuantity] = useState(1);

  useEffect(() => {
    const refreshClock = () => setIndiaClock(getIndiaClock());
    refreshClock();
    const timer = window.setInterval(refreshClock, 15_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setMessage("Supabase is not configured.");
        setLoading(false);
        return;
      }

      try {
        const {
          data: restaurantData,
          error: restaurantError,
        } = await supabase
          .from("restaurants")
          .select("id,name,slug,description,area,city,is_open,qr_enabled")
          .eq("slug", slug)
          .eq("status", "approved")
          .maybeSingle();

        if (cancelled) return;

        if (restaurantError) throw restaurantError;

        if (!restaurantData) {
          setRestaurant(null);
          return;
        }

        setRestaurant(restaurantData as Restaurant);

        const [productsResult, offersResult, schedulesResult] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id,restaurant_id,name,description,price,image_url,category,is_veg,is_available,variants"
            )
            .eq("restaurant_id", restaurantData.id)
            .eq("is_available", true)
            .order("name"),

          supabase
            .from("offers")
            .select(
              "id,restaurant_id,title,description,image_url,scope,discount_type,discount_value,product_ids,min_order_amount,max_discount,starts_at,ends_at,is_active"
            )
            .eq("restaurant_id", restaurantData.id)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),

          supabase
            .from("product_menu_schedules")
            .select("product_id,weekdays,starts_at,ends_at")
            .eq("restaurant_id", restaurantData.id)
            .eq("is_enabled", true),
        ]);

        if (cancelled) return;

        if (productsResult.error) throw productsResult.error;

        setProducts((productsResult.data || []) as FoodProduct[]);

        if (schedulesResult.error) {
          console.error("Unable to verify menu schedules:", schedulesResult.error);
          setMenuSchedules([]);
          setScheduleReady(false);
          setMessage("Menu availability could not be verified. Please refresh and try again shortly.");
        } else {
          setMenuSchedules((schedulesResult.data || []) as ProductMenuSchedule[]);
          setScheduleReady(true);
        }

        if (!offersResult.error) {
          setOffers(
            ((offersResult.data || []) as RestaurantOffer[])
              .filter(isOfferCurrentlyValid)
              .filter((offer) => Boolean(offer.image_url))
          );
        } else {
          console.error("Unable to load offers:", offersResult.error);
          setOffers([]);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the menu."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    try {
      const saved = localStorage.getItem(`thoam-cart-${slug}`);

      if (saved) {
        const parsed = JSON.parse(saved);

        if (
          parsed &&
          typeof parsed === "object" &&
          !Array.isArray(parsed)
        ) {
          setCart(parsed);
        }
      }
    } catch {
      // Ignore invalid saved cart.
    }

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!cartOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setCartOpen(false);
    }

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [cartOpen]);

  function saveCart(next: Record<string, number>) {
    setCart(next);

    try {
      localStorage.setItem(`thoam-cart-${slug}`, JSON.stringify(next));
    } catch {
      // Cart remains usable in component state.
    }
  }

  const isProductAvailableNow = useCallback((productId: string) => {
    return scheduleReady && isWithinMenuSchedule(
      menuSchedules, productId, indiaClock.weekday, indiaClock.time
    );
  }, [scheduleReady, menuSchedules, indiaClock]);

  function changeQuantity(product: FoodProduct, amount: number, variantName = "") {
    if (amount > 0 && !restaurant?.is_open) return;
    if (amount > 0 && !isProductAvailableNow(product.id)) {
      setMessage("This item is outside its scheduled serving time.");
      return;
    }

    setMessage("");

    const key = variantName ? `${product.id}::${variantName}` : product.id;
    const next = { ...cart };
    const quantity = Math.max(0, (next[key] || 0) + amount);
    if (quantity === 0) delete next[key];
    else next[key] = quantity;
    saveCart(next);
  }

  function addToCart(product: FoodProduct) {
    if (!restaurant?.is_open) return;
    if (!isProductAvailableNow(product.id)) {
      setMessage("This item is not available at the current time.");
      return;
    }

    if (product.variants?.length) {
      setSelectedProduct(product);
      setSelectedVariantName(product.variants[0].name);
      setVariantQuantity(1);
      return;
    }
    changeQuantity(product, 1);
    setCartOpen(true);
  }

  function confirmVariantAdd() {
    if (!selectedProduct || !selectedVariantName) return;
    changeQuantity(selectedProduct, variantQuantity, selectedVariantName);
    setSelectedProduct(null);
    setCartOpen(true);
  }

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          products
            .map((product) => product.category?.trim())
            .filter((value): value is string => Boolean(value))
        )
      ).sort(),
    ],
    [products]
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        (product.description || "").toLowerCase().includes(query) ||
        (product.category || "").toLowerCase().includes(query);

      const matchesCategory =
        category === "All" || product.category === category;

      const matchesFood =
        foodFilter === "all" ||
        (foodFilter === "veg" && product.is_veg) ||
        (foodFilter === "nonveg" && !product.is_veg);

      const matchesSchedule = isProductAvailableNow(product.id);
      return matchesSearch && matchesCategory && matchesFood && matchesSchedule;
    });
  }, [products, search, category, foodFilter, isProductAvailableNow]);

  const cartItems = products.flatMap((product) => {
    if (product.variants?.length) {
      return product.variants.map((variant) => {
        const key = `${product.id}::${variant.name}`;
        return { ...product, cartKey: key, variantName: variant.name, price: Number(variant.price), quantity: cart[key] || 0 };
      }).filter((item) => item.quantity > 0);
    }
    return cart[product.id] > 0
      ? [{ ...product, cartKey: product.id, variantName: "", quantity: cart[product.id] }]
      : [];
  });

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const total = cartItems.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0);
  const unavailableCartItems = cartItems.filter((product) => !isProductAvailableNow(product.id));

  function checkout() {
    if (!supabase) {
      setMessage("Connect Supabase to place real orders.");
      return;
    }

    if (!restaurant?.is_open) {
      setMessage("This restaurant is currently closed.");
      return;
    }

    if (!scheduleReady) {
      setMessage("Menu availability could not be verified. Please refresh before checkout.");
      return;
    }

    if (unavailableCartItems.length > 0) {
      setMessage("Some cart items are outside their serving time. Remove them or choose currently available dishes.");
      return;
    }

    if (cartCount === 0) {
      setMessage("Add at least one item to your cart.");
      return;
    }

    try {
      localStorage.setItem(`thoam-cart-${slug}`, JSON.stringify(cart));
    } catch {
      // Continue to checkout.
    }

    window.location.href =
      `/checkout?restaurant=${encodeURIComponent(slug)}`;
  }

  return (
    <>
      <Header />

      <main className="premium-menu">
        <div className="premium-menu-container">
          <Link href="/restaurants" className="premium-back">
            <ArrowLeft size={16} />
            <span>{t("All restaurants")}</span>
          </Link>

          {loading ? (
            <div className="premium-loading">
              <div className="premium-spinner" />
              <p>{t("Preparing your menu...")}</p>
            </div>
          ) : !restaurant ? (
            <section className="premium-empty">
              <Utensils size={34} />
              <h1>{t("Restaurant unavailable")}</h1>
              <p>
                {message || "This restaurant is currently unavailable."}
              </p>
              <Link
                href="/restaurants"
                className="premium-primary-button"
              >
                Explore restaurants
              </Link>
            </section>
          ) : (
            <>
              {/* Restaurant hero */}
              <section className="premium-restaurant-hero">
                <div className="premium-hero-topline">
                  <span className="premium-label">
                    <Utensils size={13} />
                    THO’AM MENU
                  </span>

                  <span
                    className={`premium-open-badge ${
                      restaurant.is_open ? "is-open" : "is-closed"
                    }`}
                  >
                    <span className="premium-status-dot" />
                    {restaurant.is_open ? t("Open now") : t("Currently closed")}
                  </span>
                </div>

                <h1>{restaurant.name}</h1>

                <p className="premium-restaurant-description">
                  {restaurant.description ||
                    "Discover your next favourite meal, freshly prepared."}
                </p>

                <div className="premium-restaurant-meta">
                  {(restaurant.area || restaurant.city) && (
                    <span>
                      <MapPin size={15} />
                      {[restaurant.area, restaurant.city]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}

                  <span>
                    <Clock3 size={15} />
                    {restaurant.is_open
                      ? "Accepting orders"
                      : "Ordering paused"}
                  </span>
                </div>

                {!restaurant.is_open && (
                  <div className="premium-closed-notice">
                    This restaurant is closed. You can browse the menu,
                    but adding items and checkout are paused.
                  </div>
                )}
              </section>

              {/* Offers slider - directly below restaurant hero */}
              {offers.length > 0 && (
                <section
                  className="thoam-offers"
                  aria-label="Restaurant offers"
                >
                  <div className="thoam-offers-heading">
                    <div>
                      <span>{t("EXCLUSIVE DEALS")}</span>
                      <h2>{t("Offers for you")}</h2>
                    </div>

                    {offers.length > 1 && (
                      <small>{t("Swipe to explore")}</small>
                    )}
                  </div>

                  <div className="thoam-offers-track">
                    {offers.map((offer) => (
                      <article
                        className="thoam-offer-card"
                        key={offer.id}
                        title={offer.title}
                      >
                        <img
                          className="thoam-offer-image"
                          src={offer.image_url || ""}
                          alt={offer.title}
                          loading="lazy"
                        />
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* Menu */}
              <section className="premium-menu-section">
                <div className="thoam-schedule-note">
                  <Clock3 size={15} />
                  <span>{t("Menu timings follow India Standard Time (IST) and update automatically.")}</span>
                  <strong>{indiaClock.time} IST</strong>
                </div>
                {!scheduleReady && (
                  <div className="thoam-schedule-warning" role="alert">
                    Menu timings are temporarily unavailable. Ordering is paused until availability can be verified.
                  </div>
                )}
                <div className="premium-menu-heading">
                  <div>
                    <span className="premium-label">
                      FRESHLY PREPARED
                    </span>

                    <h2>
                      {t("Explore the menu")}<span>.</span>
                    </h2>

                    <p>
                      {filteredProducts.length}{" "}
                      {filteredProducts.length === 1 ? t("dish") : t("dishes")}
                      {search ||
                      category !== "All" ||
                      foodFilter !== "all"
                        ? " found"
                        : " available"}
                    </p>
                  </div>

                  <button
                    className="premium-heading-cart"
                    onClick={() => setCartOpen(true)}
                    aria-label="Open shopping cart"
                  >
                    <ShoppingBag size={21} />
                    {cartCount > 0 && (
                      <span className="premium-heading-cart-count">
                        {cartCount}
                      </span>
                    )}
                  </button>
                </div>

                <label className="premium-search">
                  <Search size={19} />

                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("Search biriyani, shawarma...")}
                    aria-label={t("Search menu items")}
                  />

                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Clear search"
                    >
                      <X size={17} />
                    </button>
                  )}
                </label>

                <div className="premium-filter-heading">
                  <span>{t("Categories")}</span>

                  <div className="premium-food-filters">
                    <button
                      className={foodFilter === "all" ? "selected" : ""}
                      onClick={() => setFoodFilter("all")}
                    >
                      All
                    </button>

                    <button
                      className={foodFilter === "veg" ? "selected" : ""}
                      onClick={() => setFoodFilter("veg")}
                    >
                      <Leaf size={13} />
                      Veg
                    </button>

                    <button
                      className={foodFilter === "nonveg" ? "selected" : ""}
                      onClick={() => setFoodFilter("nonveg")}
                    >
                      <Drumstick size={13} />
                      Non-veg
                    </button>
                  </div>
                </div>

                <div className="premium-category-list">
                  {categories.map((item) => (
                    <button
                      key={item}
                      className={
                        category === item
                          ? "premium-category active"
                          : "premium-category"
                      }
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                {products.length === 0 ? (
                  <div className="premium-empty">
                    <ShoppingBag size={30} />
                    <h3>{t("Menu coming soon")}</h3>
                    <p>
                      This restaurant has not added available items yet.
                    </p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="premium-empty">
                    <Search size={30} />
                    <h3>{t("No dishes found")}</h3>
                    <p>{t("Try a different search or filter.")}</p>

                    <button
                      className="premium-secondary-button"
                      onClick={() => {
                        setSearch("");
                        setCategory("All");
                        setFoodFilter("all");
                      }}
                    >
                      Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="premium-food-grid">
                    {filteredProducts.map((product) => {
                      const quantity = (cart[product.id] || 0) + Object.entries(cart).filter(([key]) => key.startsWith(`${product.id}::`)).reduce((sum, [, value]) => sum + Number(value || 0), 0);

                      return (
                        <article
                          className="premium-food-card"
                          key={product.id}
                        >
                          <button
                            type="button"
                            className="premium-food-card-click"
                            onClick={() => {
                              if (quantity > 0) {
                                setCartOpen(true);
                              } else {
                                addToCart(product);
                              }
                            }}
                            aria-label={`${quantity > 0 ? "View cart" : "Add"} ${product.name}`}
                          >
                            <div className="premium-food-image">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  loading="lazy"
                                />
                              ) : (
                                <div className="premium-food-image-placeholder">
                                  <Utensils size={28} />
                                  <span>THO’AM</span>
                                </div>
                              )}

                              <span className="premium-food-type">
                                {product.is_veg ? (
                                  <Leaf size={12} />
                                ) : (
                                  <Drumstick size={12} />
                                )}
                                {product.is_veg ? t("VEG") : t("NON-VEG")}
                              </span>

                              {quantity > 0 && (
                                <span
                                  className="premium-quantity-badge"
                                  aria-label={`${quantity} added`}
                                >
                                  {quantity}
                                </span>
                              )}
                            </div>

                            <div className="premium-food-content">
                              <div className="premium-food-category">
                                {product.category || "OUR MENU"}
                              </div>

                              <h3>{product.name}</h3>

                              <p className="premium-food-description">
                                {product.description ||
                                  "Freshly prepared for you."}
                              </p>
                            </div>
                          </button>

                          <div className="premium-food-bottom">
                            <div className="premium-food-price">
                              <span>{product.variants?.length ? "From ₹" : "₹"}</span>
                              {Number(product.variants?.length ? Math.min(...product.variants.map((v) => Number(v.price))) : product.price).toFixed(0)}
                            </div>

                            {product.variants?.length ? (
                              <button className="premium-add-button" onClick={() => addToCart(product)} disabled={!restaurant.is_open}>
                                {quantity > 0 ? "Add another" : "Choose size"} <Plus size={15} />
                              </button>
                            ) : quantity === 0 ? (
                              <button
                                className="premium-add-button"
                                onClick={() => addToCart(product)}
                                disabled={!restaurant.is_open}
                              >
                                Add <Plus size={15} />
                              </button>
                            ) : (
                              <div className="premium-card-quantity">
                                <button
                                  onClick={() =>
                                    changeQuantity(product, -1, product.variantName)
                                  }
                                  aria-label={`Remove one ${product.name}`}
                                >
                                  <Minus size={13} />
                                </button>

                                <span>{quantity}</span>

                                <button
                                  onClick={() =>
                                    changeQuantity(product, 1, product.variantName)
                                  }
                                  disabled={!restaurant.is_open}
                                  aria-label={`Add one ${product.name}`}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              {message && (
                <div className="premium-message" role="status">
                  <span>{message}</span>
                  <button
                    onClick={() => setMessage("")}
                    aria-label="Dismiss message"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}

              <footer className="premium-menu-footer">
                <span>THO’AM.</span>
                <p>{t("Good food. Simple ordering.")}</p>
              </footer>
            </>
          )}
        </div>
      </main>

      {selectedProduct && (
        <div className="thoam-variant-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedProduct(null); }}>
          <section className="thoam-variant-modal" role="dialog" aria-modal="true" aria-labelledby="thoam-variant-title">
            <button className="thoam-variant-close" onClick={() => setSelectedProduct(null)} aria-label="Close size selector"><X size={19} /></button>
            {selectedProduct.image_url ? <img className="thoam-variant-image" src={selectedProduct.image_url} alt={selectedProduct.name} /> : <div className="thoam-variant-image thoam-variant-placeholder"><Utensils size={32} /></div>}
            <span className="premium-label">CHOOSE YOUR PORTION</span>
            <h2 id="thoam-variant-title">{selectedProduct.name}</h2>
            {selectedProduct.description && <p>{selectedProduct.description}</p>}
            <div className="thoam-variant-options">
              {(selectedProduct.variants || []).map((variant) => (
                <button type="button" key={variant.name} className={selectedVariantName === variant.name ? "selected" : ""} onClick={() => setSelectedVariantName(variant.name)}>
                  <span><strong>{variant.name}</strong><small>Portion size</small></span><b>₹{Number(variant.price).toFixed(0)}</b>
                </button>
              ))}
            </div>
            <div className="thoam-variant-bottom">
              <div className="premium-quantity-control">
                <button type="button" onClick={() => setVariantQuantity((n) => Math.max(1, n - 1))}><Minus size={14} /></button>
                <strong>{variantQuantity}</strong>
                <button type="button" onClick={() => setVariantQuantity((n) => Math.min(50, n + 1))}><Plus size={14} /></button>
              </div>
              <button className="premium-checkout-button" type="button" onClick={confirmVariantAdd}>Done · Add to cart <ArrowRight size={17} /></button>
            </div>
          </section>
        </div>
      )}

      {/* Floating cart */}
      {restaurant && cartCount > 0 && !cartOpen && (
        <button
          className="premium-floating-cart"
          onClick={() => setCartOpen(true)}
        >
          <span className="premium-floating-cart-icon">
            <ShoppingBag size={20} />
            <span>{cartCount}</span>
          </span>

          <span className="premium-floating-cart-text">
            <strong>{t("View your cart")}</strong>
            <small>
              {cartCount} {cartCount === 1 ? t("item") : t("items")}
            </small>
          </span>

          <strong className="premium-floating-cart-total">
            ₹{total.toFixed(0)}
          </strong>

          <ChevronRight size={19} />
        </button>
      )}

      {/* Cart drawer */}
      {cartOpen && restaurant && (
        <div
          className="premium-cart-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setCartOpen(false);
            }
          }}
        >
          <aside
            className="premium-cart-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-cart-title"
          >
            <div className="premium-cart-header">
              <div className="premium-cart-title-wrap">
                <span className="premium-label">{t("YOUR SELECTION")}</span>

                <h2 id="premium-cart-title">
                  {t("Your cart")}<span>.</span>
                </h2>

                <p>
                  {cartCount} {cartCount === 1 ? "item" : "items"} ·{" "}
                  {restaurant.name}
                </p>
              </div>

              <button
                className="premium-cart-close"
                onClick={() => setCartOpen(false)}
                aria-label="Close cart"
              >
                <X size={21} />
              </button>
            </div>

            {cartItems.length === 0 ? (
              <div className="premium-cart-empty">
                <div className="premium-cart-empty-icon">
                  <ShoppingBag size={30} />
                </div>

                <h3>{t("Your cart is empty")}</h3>
                <p>
                  Discover something delicious from the menu.
                </p>

                <button
                  className="premium-primary-button"
                  onClick={() => setCartOpen(false)}
                >
                  Explore menu <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="premium-cart-items">
                  {cartItems.map((product) => {
                    const quantity = product.quantity;

                    return (
                      <article
                        className="premium-cart-item"
                        key={product.cartKey}
                      >
                        <div className="premium-cart-item-image">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                            />
                          ) : (
                            <Utensils size={23} />
                          )}
                        </div>

                        <div className="premium-cart-item-details">
                          <div className="premium-cart-item-name-row">
                            <h3>{product.name}</h3>

                            <button
                              className="premium-cart-remove"
                              onClick={() =>
                                changeQuantity(product, -quantity, product.variantName)
                              }
                              aria-label={`Remove ${product.name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <p>
                            {product.variantName ? `${product.variantName} · ` : ""}₹{Number(product.price).toFixed(0)} each
                          </p>

                          <div className="premium-cart-item-bottom">
                            <div className="premium-quantity-control">
                              <button
                                onClick={() =>
                                  changeQuantity(product, -1)
                                }
                                aria-label={`Remove one ${product.name}`}
                              >
                                <Minus size={14} />
                              </button>

                              <span>{quantity}</span>

                              <button
                                onClick={() =>
                                  changeQuantity(product, 1)
                                }
                                disabled={!restaurant.is_open}
                                aria-label={`Add one ${product.name}`}
                              >
                                <Plus size={14} />
                              </button>
                            </div>

                            <strong>
                              ₹
                              {(
                                Number(product.price) * quantity
                              ).toFixed(0)}
                            </strong>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="premium-cart-footer">
                  <button
                    className="premium-cart-continue"
                    onClick={() => setCartOpen(false)}
                  >
                    <ArrowLeft size={15} />
                    Continue browsing
                  </button>

                  <div className="premium-cart-total-row">
                    <div>
                      <span>{t("Subtotal")}</span>
                      <small>
                        Delivery charges, if any, at checkout
                      </small>
                    </div>

                    <strong>₹{total.toFixed(2)}</strong>
                  </div>

                  <div className="premium-cart-total-row premium-cart-grand-total">
                    <span>{t("Total")}</span>
                    <strong>₹{total.toFixed(2)}</strong>
                  </div>

                  <button
                    className="premium-checkout-button"
                    onClick={checkout}
                    disabled={!restaurant.is_open || cartCount === 0}
                  >
                    {restaurant.is_open
                      ? "Continue to checkout"
                      : "Restaurant closed"}
                    <ArrowRight size={18} />
                  </button>

                  <p className="premium-cart-payment-note">
                    <ShoppingBag size={13} />
                    Review your order before placing it
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      )}

      {/* Internal CSS */}
      <style jsx global>{`
        .thoam-variant-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:center;justify-content:center;padding:18px;background:#0009;backdrop-filter:blur(5px)}
        .thoam-variant-modal{position:relative;width:min(100%,430px);max-height:90vh;overflow:auto;padding:22px;border-radius:20px;background:#fff;color:#111;box-shadow:0 25px 80px #0004}
        .thoam-variant-close{position:absolute;top:12px;right:12px;width:36px;height:36px;border:0;border-radius:50%;background:#fff;color:#111;display:grid;place-items:center;z-index:2;cursor:pointer}
        .thoam-variant-image{display:block;width:100%;height:190px;object-fit:cover;border-radius:13px;margin-bottom:18px;background:#f3f3f3}
        .thoam-variant-placeholder{display:grid;place-items:center;color:#999}
        .thoam-variant-modal h2{margin:7px 0;font-size:24px;letter-spacing:-.8px}
        .thoam-variant-modal>p{margin:0 0 14px;color:#777;font-size:12px;line-height:1.6}
        .thoam-variant-options{display:grid;gap:9px;margin-top:16px}
        .thoam-variant-options button{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border:1px solid #e8e8e8;border-radius:11px;background:#fff;text-align:left;cursor:pointer}
        .thoam-variant-options button.selected{border-color:#176b49;background:#f2f8f4;box-shadow:0 0 0 2px #176b4918}
        .thoam-variant-options button span{display:grid;gap:4px}.thoam-variant-options button strong{font-size:13px}.thoam-variant-options button small{font-size:10px;color:#999}.thoam-variant-options button b{font-size:14px}
        .thoam-variant-bottom{display:flex;align-items:center;gap:10px;margin-top:18px}
        .thoam-variant-bottom .premium-checkout-button{flex:1;justify-content:center}
        @media(max-width:480px){.thoam-variant-modal{padding:16px}.thoam-variant-image{height:165px}}
        /* --------------------------------
           THO'AM - PREMIUM OFFER SLIDER
        --------------------------------- */

        .thoam-offers {
          width: 100%;
          margin: 22px 0 34px;
          overflow: hidden;
        }

        .thoam-offers-heading {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 13px;
        }

        .thoam-offers-heading span {
          color: #a51f2d;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 2px;
        }

        .thoam-offers-heading h2 {
          margin: 5px 0 0;
          color: #111;
          font-size: 20px;
          font-weight: 800;
          letter-spacing: -0.7px;
        }

        .thoam-offers-heading small {
          color: #999;
          font-size: 10px;
          white-space: nowrap;
        }

        .thoam-offers-track {
          display: flex;
          align-items: stretch;
          gap: 12px;
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 2px 1px 8px;

          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .thoam-offers-track::-webkit-scrollbar {
          display: none;
        }

        .thoam-offer-card {
          flex: 0 0 100%;
          width: 100%;
          min-width: 0;
          aspect-ratio: 3 / 1;
          overflow: hidden;

          border: 1px solid #eceae5;
          border-radius: 14px;
          background: #fff;
          scroll-snap-align: start;

          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.06);
        }

        .thoam-offer-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          border-radius: inherit;
        }

        /* --------------------------------
           PRODUCT IMAGE
        --------------------------------- */

        .premium-food-image {
          position: relative !important;
          overflow: hidden !important;
          isolation: isolate;
        }

        .premium-food-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        /* Compact quantity badge */

        .premium-quantity-badge {
          position: absolute !important;
          top: 10px !important;
          right: 10px !important;
          left: auto !important;
          bottom: auto !important;
          z-index: 3 !important;

          display: inline-flex !important;
          align-items: center;
          justify-content: center;

          min-width: 23px !important;
          width: auto !important;
          height: 23px !important;
          padding: 0 7px !important;

          border: 1px solid rgba(255, 255, 255, 0.75) !important;
          border-radius: 20px !important;

          background: #111 !important;
          color: #fff !important;

          font-size: 10px !important;
          font-weight: 700 !important;
          line-height: 1 !important;

          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
          pointer-events: none;
        }

        /* Compact quantity control */

        .premium-card-quantity {
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          gap: 0 !important;

          height: 34px !important;
          min-width: 92px !important;
          padding: 0 5px !important;

          border: 1px solid #176d4d !important;
          border-radius: 9px !important;

          background: #176d4d !important;
          color: #fff !important;
        }

        .premium-card-quantity button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 29px;
          height: 29px;
          padding: 0;
          border: 0;
          border-radius: 7px;
          background: transparent;
          color: #fff;
          cursor: pointer;
        }

        .premium-card-quantity button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .premium-card-quantity span {
          min-width: 23px;
          text-align: center;
          color: #fff;
          font-size: 12px;
          font-weight: 700;
        }

        /* Add button */

        .premium-add-button {
          min-height: 34px !important;
          padding: 0 13px !important;
          border-radius: 9px !important;
          font-size: 12px !important;
          font-weight: 700 !important;
        }

        /* Product card */

        .premium-food-card {
          overflow: hidden;
          border-radius: 17px !important;
        }

        .premium-food-card-click {
          width: 100%;
          text-align: left;
        }

        /* --------------------------------
           RESPONSIVE PRODUCT CARDS
           Marketplace-inspired layout
        --------------------------------- */

        .premium-food-grid {
          display: grid !important;
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          align-items: stretch;
          gap: 18px !important;
        }

        .premium-food-card {
          display: flex !important;
          min-width: 0;
          min-height: 100%;
          flex-direction: column;
          border: 1px solid #e9e8e3 !important;
          border-radius: 16px !important;
          background: #fff;
          box-shadow: 0 2px 9px rgba(20, 20, 20, 0.035);
          transition: border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease;
        }

        .premium-food-card:hover {
          transform: translateY(-3px);
          border-color: #d4d2ca !important;
          box-shadow: 0 12px 28px rgba(20, 20, 20, 0.075);
        }

        .premium-food-card-click {
          display: flex !important;
          min-width: 0;
          flex: 1 1 auto;
          flex-direction: column;
          padding: 0;
          border: 0;
          background: transparent;
          color: inherit;
          cursor: pointer;
          text-align: left;
        }

        .premium-food-image {
          width: 100%;
          height: auto !important;
          aspect-ratio: 4 / 3;
          background: #f3f2ee;
        }

        .premium-food-image img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 260ms ease;
        }

        .premium-food-card:hover .premium-food-image img {
          transform: scale(1.035);
        }

        .premium-food-content {
          display: flex;
          min-width: 0;
          flex: 1 1 auto;
          flex-direction: column;
          padding: 13px 13px 8px;
        }

        .premium-food-category {
          overflow: hidden;
          margin-bottom: 6px;
          color: #85847e;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.08em;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .premium-food-content h3 {
          display: -webkit-box;
          min-height: 38px;
          overflow: hidden;
          margin: 0;
          color: #171717;
          font-size: 14px;
          font-weight: 750;
          line-height: 1.35;
          overflow-wrap: anywhere;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .premium-food-description {
          display: -webkit-box;
          min-height: 31px;
          overflow: hidden;
          margin: 6px 0 0;
          color: #777770;
          font-size: 10px;
          line-height: 1.55;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .premium-food-bottom {
          display: flex;
          min-width: 0;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-top: auto;
          padding: 10px 12px 12px;
          border-top: 1px solid #f0efeb;
        }

        .premium-food-price {
          flex-shrink: 0;
          color: #151515;
          font-size: 18px;
          font-weight: 850;
          letter-spacing: -0.04em;
        }

        .premium-food-price > span {
          margin-right: 1px;
          font-size: 12px;
        }

        .premium-add-button {
          display: inline-flex;
          min-width: 68px;
          min-height: 35px !important;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 0 10px !important;
          border: 1px solid #171717;
          border-radius: 9px !important;
          background: #171717;
          color: #fff;
          font-size: 11px !important;
          font-weight: 750 !important;
          letter-spacing: 0;
          transition: background 160ms ease, color 160ms ease;
        }

        .premium-add-button:hover:not(:disabled) {
          background: #fff;
          color: #171717;
        }

        .premium-add-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .premium-card-quantity {
          flex-shrink: 0;
        }

        @media (max-width: 1100px) {
          .premium-food-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            gap: 15px !important;
          }
        }

        @media (max-width: 760px) {
          .premium-food-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 12px !important;
          }

          .premium-food-card {
            border-radius: 14px !important;
          }

          .premium-food-content {
            padding: 11px 10px 7px;
          }

          .premium-food-content h3 {
            font-size: 13px;
          }

          .premium-food-bottom {
            gap: 5px;
            padding: 9px 9px 10px;
          }

          .premium-food-price {
            font-size: 16px;
          }

          .premium-add-button {
            min-width: 61px;
            min-height: 33px !important;
            padding: 0 8px !important;
            font-size: 10px !important;
          }
        }

        @media (max-width: 360px) {
          .premium-food-grid {
            gap: 9px !important;
          }

          .premium-food-content {
            padding-right: 8px;
            padding-left: 8px;
          }

          .premium-food-content h3 {
            font-size: 12px;
          }

          .premium-food-price {
            font-size: 15px;
          }

          .premium-card-quantity {
            min-width: 78px !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .premium-food-card,
          .premium-food-image img {
            transition: none;
          }

          .premium-food-card:hover,
          .premium-food-card:hover .premium-food-image img {
            transform: none;
          }
        }

        .thoam-schedule-note {
          display:flex;align-items:center;gap:9px;margin:0 0 18px;padding:11px 13px;
          border:1px solid #e9e8e3;border-radius:12px;background:#fafaf8;color:#5e5e58;
          font-size:11px;line-height:1.4;
        }
        .thoam-schedule-note strong { margin-left:auto;color:#171717;white-space:nowrap;font-size:11px; }
        .thoam-schedule-warning {
          margin:0 0 16px;padding:12px 14px;border:1px solid #e7c8c8;border-radius:12px;
          background:#fff8f8;color:#8f2525;font-size:12px;
        }

        @media (max-width: 600px) {
          .thoam-schedule-note { align-items:flex-start;flex-wrap:wrap;font-size:10px; }
          .thoam-schedule-note strong { margin-left:24px; }
          .thoam-offers {
            margin: 19px 0 27px;
          }

          .thoam-offers-heading {
            margin-bottom: 11px;
          }

          .thoam-offers-heading h2 {
            font-size: 18px;
          }

          .thoam-offers-heading small {
            font-size: 9px;
          }

          .thoam-offers-track {
            gap: 10px;
          }

          .thoam-offer-card {
            aspect-ratio: 2.5 / 1;
            border-radius: 11px;
          }
        }
      `}</style>
    </>
  );
}