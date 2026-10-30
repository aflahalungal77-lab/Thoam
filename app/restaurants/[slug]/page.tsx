"use client";

import { useEffect, useMemo, useState } from "react";
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

export default function RestaurantPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [foodFilter, setFoodFilter] = useState<FoodFilter>("all");
  const [cartOpen, setCartOpen] = useState(false);

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
          .select(
            "id,name,slug,description,area,city,is_open,qr_enabled"
          )
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

        const { data, error } = await supabase
          .from("products")
          .select(
            "id,restaurant_id,name,description,price,image_url,category,is_veg,is_available"
          )
          .eq("restaurant_id", restaurantData.id)
          .eq("is_available", true)
          .order("name");

        if (cancelled) return;
        if (error) throw error;

        setProducts((data || []) as FoodProduct[]);
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
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
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

  function changeQuantity(product: FoodProduct, amount: number) {
    if (amount > 0 && !restaurant?.is_open) return;

    setMessage("");

    const next = { ...cart };
    const quantity = Math.max(0, (next[product.id] || 0) + amount);

    if (quantity === 0) {
      delete next[product.id];
    } else {
      next[product.id] = quantity;
    }

    saveCart(next);
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

      return matchesSearch && matchesCategory && matchesFood;
    });
  }, [products, search, category, foodFilter]);

  const cartItems = products.filter(
    (product) => (cart[product.id] || 0) > 0
  );

  const cartCount = cartItems.reduce(
    (sum, product) => sum + (cart[product.id] || 0),
    0
  );

  const total = cartItems.reduce(
    (sum, product) =>
      sum + Number(product.price) * (cart[product.id] || 0),
    0
  );

  function checkout() {
    if (!supabase) {
      setMessage("Connect Supabase to place real orders.");
      return;
    }

    if (!restaurant?.is_open) {
      setMessage("This restaurant is currently closed.");
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

    window.location.href = `/checkout?restaurant=${encodeURIComponent(slug)}`;
  }

  function addToCart(product: FoodProduct) {
    if (!restaurant?.is_open) return;

    changeQuantity(product, 1);
    setCartOpen(true);
  }

  return (
    <>
      <Header />

      <main className="premium-menu">
        <div className="premium-menu-container">
          <Link href="/restaurants" className="premium-back">
            <ArrowLeft size={16} />
            <span>All restaurants</span>
          </Link>

          {loading ? (
            <div className="premium-loading">
              <div className="premium-spinner" />
              <p>Preparing your menu...</p>
            </div>
          ) : !restaurant ? (
            <section className="premium-empty">
              <Utensils size={34} />
              <h1>Restaurant unavailable</h1>
              <p>{message || "This restaurant is currently unavailable."}</p>
              <Link href="/restaurants" className="premium-primary-button">
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
                    {restaurant.is_open ? "Open now" : "Currently closed"}
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
                    This restaurant is closed. You can browse the menu, but
                    adding items and checkout are paused.
                  </div>
                )}
              </section>

              {/* Menu section */}
              <section className="premium-menu-section">
                <div className="premium-menu-heading">
                  <div>
                    <span className="premium-label">FRESHLY PREPARED</span>
                    <h2>
                      Explore the menu<span>.</span>
                    </h2>
                    <p>
                      {filteredProducts.length}{" "}
                      {filteredProducts.length === 1 ? "dish" : "dishes"}
                      {search || category !== "All" || foodFilter !== "all"
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
                    placeholder="Search biriyani, shawarma..."
                    aria-label="Search menu items"
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
                  <span>Categories</span>

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
                    <h3>Menu coming soon</h3>
                    <p>This restaurant has not added available items yet.</p>
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="premium-empty">
                    <Search size={30} />
                    <h3>No dishes found</h3>
                    <p>Try a different search or filter.</p>
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
                      const quantity = cart[product.id] || 0;

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
                            aria-label={`${
                              quantity > 0 ? "View cart" : "Add"
                            } ${product.name}`}
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
                                {product.is_veg ? "VEG" : "NON-VEG"}
                              </span>

                              {quantity > 0 && (
                                <span className="premium-quantity-badge">
                                  {quantity} added
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
                              <span>₹</span>
                              {Number(product.price).toFixed(0)}
                            </div>

                            {quantity === 0 ? (
                              <button
                                className="premium-add-button"
                                onClick={() => addToCart(product)}
                                disabled={!restaurant.is_open}
                              >
                                Add <Plus size={15} />
                              </button>
                            ) : (
                              <button
                                className="premium-card-quantity"
                                onClick={() => setCartOpen(true)}
                                aria-label={`Edit ${product.name} quantity`}
                              >
                                <span>{quantity}</span>
                                <Plus size={15} />
                              </button>
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
                <p>Good food. Simple ordering.</p>
              </footer>
            </>
          )}
        </div>
      </main>

      {/* Floating cart button */}
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
            <strong>View your cart</strong>
            <small>
              {cartCount} {cartCount === 1 ? "item" : "items"}
            </small>
          </span>

          <strong className="premium-floating-cart-total">
            ₹{total.toFixed(0)}
          </strong>

          <ChevronRight size={19} />
        </button>
      )}

      {/* Side cart drawer */}
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
                <span className="premium-label">YOUR SELECTION</span>
                <h2 id="premium-cart-title">Your cart<span>.</span></h2>
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
                <h3>Your cart is empty</h3>
                <p>Discover something delicious from the menu.</p>
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
                    const quantity = cart[product.id] || 0;

                    return (
                      <article
                        className="premium-cart-item"
                        key={product.id}
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
                                changeQuantity(product, -quantity)
                              }
                              aria-label={`Remove ${product.name}`}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>

                          <p>₹{Number(product.price).toFixed(0)} each</p>

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
                      <span>Subtotal</span>
                      <small>Delivery charges, if any, at checkout</small>
                    </div>
                    <strong>₹{total.toFixed(2)}</strong>
                  </div>

                  <div className="premium-cart-total-row premium-cart-grand-total">
                    <span>Total</span>
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
    </>
  );
}