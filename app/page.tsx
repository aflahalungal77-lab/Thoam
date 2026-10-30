"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpRight,
  Search,
  Utensils,
  Leaf,
  Drumstick,
  Store,
  QrCode,
  Plus,
  MapPin,
  Sparkles,
  LoaderCircle,
} from "lucide-react";

import Header from "@/components/Header";
import InstallPrompt from "@/components/InstallPrompt";
import { supabase } from "@/lib/supabase";
import type { FoodProduct, Restaurant } from "@/lib/types";

const categories = [
  "All",
  "Biryani",
  "Meals",
  "Fast Food",
  "Snacks",
  "Drinks",
];

export default function Home() {
  const [products, setProducts] = useState<FoodProduct[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    async function loadHomeData() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const [productResult, restaurantResult] = await Promise.all([
          supabase
            .from("products")
            .select(
              "id, restaurant_id, name, description, price, image_url, category, is_veg, is_available"
            )
            .eq("is_available", true)
            .order("created_at", { ascending: false })
            .limit(8),

          supabase
            .from("restaurants")
            .select("id, name, slug, description")
            .eq("status", "approved")
            .limit(6),
        ]);

        if (productResult.data) {
          setProducts(productResult.data as FoodProduct[]);
        }

        if (restaurantResult.data) {
          setRestaurants(restaurantResult.data as Restaurant[]);
        }
      } catch (error) {
        console.error("Home page loading failed:", error);
      } finally {
        setLoading(false);
      }
    }

    loadHomeData();
  }, []);

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.category || "").toLowerCase().includes(search.toLowerCase());

    const matchesCategory =
      category === "All" ||
      (product.category || "").toLowerCase().includes(category.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  return (
    <>
      <Header />
      <InstallPrompt audience="customer" />

      <main>
        {/* HERO */}
        <section className="home-hero">
          <div className="home-container hero-layout">
            <div className="hero-content">
              <div className="hero-badge">
                <Sparkles size={14} />
                GOOD FOOD. RIGHT AROUND YOU.
              </div>

              <h1>
                Your next
                <br />
                favourite <span>bite.</span>
              </h1>

              <p className="hero-description">
                Discover local restaurants, explore delicious food and order
                your favourites with Tho’am.
              </p>

              <form
                className="hero-search"
                onSubmit={(event) => {
                  event.preventDefault();
                  document
                    .getElementById("popular-food")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Search size={19} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search biryani, burgers, restaurants..."
                  aria-label="Search food"
                />
                <button type="submit" aria-label="Search">
                  <ArrowRight size={19} />
                </button>
              </form>

              <div className="hero-links">
                <Link href="/restaurants" className="primary-cta">
                  Explore food <ArrowUpRight size={17} />
                </Link>

                <Link href="/owner" className="secondary-cta">
                  <Store size={17} /> Become a partner
                </Link>
              </div>

              <div className="hero-trust">
                <span>
                  <span className="trust-dot" /> Local restaurants
                </span>
                <span>Cash on delivery</span>
                <span>QR table ordering</span>
              </div>
            </div>

            <div className="hero-visual">
              <div className="hero-image-frame">
                <Image
                  src="https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1100&q=85"
                  alt="Freshly prepared food"
                  fill
                  priority
                  sizes="(max-width: 800px) 100vw, 50vw"
                  style={{ objectFit: "cover" }}
                  unoptimized
                />

                <div className="hero-image-overlay" />

                <div className="hero-food-label">
                  <span className="hero-label-icon">
                    <Utensils size={18} />
                  </span>
                  <div>
                    <strong>Something delicious.</strong>
                    <span>Just around the corner.</span>
                  </div>
                </div>
              </div>

              <div className="hero-floating-note">
                <span className="floating-note-icon">
                  <QrCode size={19} />
                </span>
                <div>
                  <strong>Dining in?</strong>
                  <span>Scan. Order. Enjoy.</span>
                </div>
              </div>

              <div className="hero-number">THO’AM / 01</div>
            </div>
          </div>
        </section>

        {/* CATEGORIES */}
        <section className="home-section category-section">
          <div className="home-container">
            <div className="section-topline">
              <div>
                <span className="home-eyebrow">EXPLORE THE MENU</span>
                <h2>What are you craving?</h2>
              </div>

              <Link href="/restaurants" className="text-link">
                All restaurants <ArrowRight size={16} />
              </Link>
            </div>

            <div className="category-list">
              {categories.map((item) => (
                <button
                  key={item}
                  className={`category-pill ${
                    category === item ? "active" : ""
                  }`}
                  onClick={() => {
                    setCategory(item);
                    document
                      .getElementById("popular-food")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  {item === "All" ? (
                    <Utensils size={16} />
                  ) : item === "Drinks" ? (
                    <span>🥤</span>
                  ) : item === "Snacks" ? (
                    <span>🍟</span>
                  ) : item === "Biryani" ? (
                    <span>🍛</span>
                  ) : item === "Meals" ? (
                    <span>🍽️</span>
                  ) : (
                    <span>🍔</span>
                  )}

                  {item}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* FOOD */}
        <section className="home-section food-section" id="popular-food">
          <div className="home-container">
            <div className="section-topline">
              <div>
                <span className="home-eyebrow">MADE BY LOCAL KITCHENS</span>
                <h2>Worth every bite.</h2>
                <p className="section-description">
                  Discover dishes from restaurants around you.
                </p>
              </div>

              <Link href="/restaurants" className="text-link">
                View menu <ArrowRight size={16} />
              </Link>
            </div>

            {loading ? (
              <div className="home-loading">
                <LoaderCircle className="loading-spin" size={26} />
                <p>Discovering delicious food...</p>
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="food-grid">
                {filteredProducts.map((product) => (
                  <article className="food-card" key={product.id}>
                    <Link
                      href="/restaurants"
                      className="food-image-wrap"
                      aria-label={`Explore restaurants for ${product.name}`}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="food-image"
                          loading="lazy"
                        />
                      ) : (
                        <div className="food-image-placeholder">
                          <Utensils size={35} strokeWidth={1.2} />
                          <span>THO’AM</span>
                        </div>
                      )}

                      <span
                        className={`food-type ${
                          product.is_veg ? "veg" : "nonveg"
                        }`}
                        title={product.is_veg ? "Vegetarian" : "Non-vegetarian"}
                      >
                        {product.is_veg ? (
                          <Leaf size={13} />
                        ) : (
                          <Drumstick size={13} />
                        )}
                        {product.is_veg ? "VEG" : "NON-VEG"}
                      </span>
                    </Link>

                    <div className="food-card-content">
                      <div className="food-card-heading">
                        <h3>{product.name}</h3>
                        <span className="food-price">
                          ₹{Number(product.price).toFixed(0)}
                        </span>
                      </div>

                      <p className="food-category">
                        {product.category || "Freshly prepared"}
                      </p>

                      <Link href="/restaurants" className="food-order-link">
                        Explore restaurant <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="food-empty">
                <div className="empty-icon">
                  <Utensils size={27} />
                </div>

                <h3>
                  {search || category !== "All"
                    ? "No matching dishes"
                    : "Good food is on its way."}
                </h3>

                <p>
                  {search || category !== "All"
                    ? "Try another search or choose a different category."
                    : "Explore our restaurant directory to discover available menus."}
                </p>

                <button
                  className="primary-cta"
                  onClick={() => {
                    setSearch("");
                    setCategory("All");
                  }}
                >
                  {search || category !== "All"
                    ? "Clear filters"
                    : "Explore restaurants"}
                  <ArrowRight size={17} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* RESTAURANTS */}
        <section className="home-section restaurant-section">
          <div className="home-container">
            <div className="section-topline">
              <div>
                <span className="home-eyebrow">YOUR LOCAL FOOD SCENE</span>
                <h2>Meet the neighbourhood.</h2>
                <p className="section-description">
                  Local restaurants. Real food. Easy discovery.
                </p>
              </div>

              <Link href="/restaurants" className="text-link">
                All restaurants <ArrowRight size={16} />
              </Link>
            </div>

            {restaurants.length > 0 ? (
              <div className="restaurant-grid">
                {restaurants.map((restaurant) => (
                  <Link
                    href={`/restaurants/${restaurant.slug}`}
                    key={restaurant.id}
                    className="restaurant-card"
                  >
                    <div className="restaurant-mark">
                      <span>T.</span>
                    </div>

                    <div className="restaurant-details">
                      <h3>{restaurant.name}</h3>
                      <p>
                        {restaurant.description || "Local food, made with care."}
                      </p>

                      <span className="restaurant-discover">
                        Discover menu <ArrowUpRight size={15} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="restaurant-empty">
                <Store size={23} />
                <p>Explore our restaurant directory to find local partners.</p>
                <Link href="/restaurants" className="text-link">
                  Explore restaurants <ArrowRight size={16} />
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* QR BANNER */}
        <section className="home-section qr-section">
          <div className="home-container">
            <div className="qr-banner">
              <div className="qr-banner-copy">
                <span className="home-eyebrow">A BETTER WAY TO DINE IN</span>
                <h2>
                  At the table?
                  <br />
                  <span>Let the menu come to you.</span>
                </h2>
                <p>
                  Scan the restaurant’s Tho’am QR code, explore the menu and
                  place your dine-in order. No customer account required.
                </p>

                <Link href="/restaurants" className="qr-banner-button">
                  Discover restaurants <ArrowUpRight size={17} />
                </Link>
              </div>

              <div className="qr-art" aria-hidden="true">
                <div className="qr-art-square">
                  <QrCode size={110} strokeWidth={1.15} />
                </div>
                <span className="qr-art-caption">SCAN / ORDER / ENJOY</span>
              </div>
            </div>
          </div>
        </section>

        {/* OWNER CTA */}
        <section className="home-section owner-section">
          <div className="home-container owner-banner">
            <div>
              <span className="home-eyebrow">FOR RESTAURANT OWNERS</span>
              <h2>Your kitchen deserves to be discovered.</h2>
              <p>
                Showcase your menu, manage orders and bring QR ordering to
                your tables with Tho’am.
              </p>
            </div>

            <Link href="/owner" className="owner-cta">
              Become a partner <ArrowUpRight size={17} />
            </Link>
          </div>
        </section>
      </main>

      <footer className="home-footer">
        <div className="home-container footer-inner">
          <Link href="/" className="thoam-brand">
            <span className="brand-symbol">T.</span>
            <span>Tho’am<span className="brand-dot">.</span></span>
          </Link>

          <span className="footer-copy">
            © {new Date().getFullYear()} Tho’am. Made for local food.
          </span>

          <span className="footer-tagline">GOOD FOOD, CLOSER.</span>
        </div>
      </footer>

      <style jsx global>{`
        :root {
          --thoam-black: #111111;
          --thoam-white: #ffffff;
          --thoam-muted: #777771;
          --thoam-line: #e9e9e4;
          --thoam-bg: #fafaf8;
        }

        .home-container {
          width: min(1180px, calc(100% - 48px));
          margin: 0 auto;
        }

        .home-hero {
          padding: 66px 0 72px;
          background: #fafaf8;
          overflow: hidden;
        }

        .hero-layout {
          display: grid;
          grid-template-columns: 1fr 0.93fr;
          align-items: center;
          gap: 68px;
        }

        .hero-content {
          padding: 12px 0;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 10px 13px;
          border: 1px solid #e7e7e1;
          border-radius: 100px;
          color: #55554f;
          background: #fff;
          font-size: 10px;
          font-weight: 750;
          letter-spacing: 0.1em;
        }

        .hero-content h1 {
          margin: 28px 0 20px;
          font-size: clamp(48px, 6.1vw, 78px);
          font-weight: 750;
          letter-spacing: -0.085em;
          line-height: 0.99;
          color: #141414;
        }

        .hero-content h1 span {
          font-family: Georgia, serif;
          font-weight: 400;
          font-style: italic;
          letter-spacing: -0.075em;
        }

        .hero-description {
          max-width: 430px;
          color: #6b6b65;
          font-size: 15px;
          line-height: 1.9;
        }

        .hero-search {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          max-width: 490px;
          margin-top: 28px;
          padding: 8px 8px 8px 17px;
          background: #fff;
          border: 1px solid #e6e6df;
          border-radius: 12px;
          color: #76766f;
          box-shadow: 0 9px 35px #11111105;
        }

        .hero-search input {
          width: 100%;
          min-width: 0;
          border: 0;
          outline: 0;
          background: transparent;
          color: #161616;
          font-size: 13px;
        }

        .hero-search button {
          flex-shrink: 0;
          display: grid;
          width: 40px;
          height: 40px;
          place-items: center;
          border: 0;
          border-radius: 9px;
          background: #111;
          color: #fff;
          cursor: pointer;
        }

        .hero-links {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-top: 21px;
        }

        .primary-cta,
        .secondary-cta,
        .qr-banner-button,
        .owner-cta {
          display: inline-flex;
          min-height: 47px;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 0 17px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 650;
          text-decoration: none;
          transition:
            transform 180ms ease,
            background 180ms ease;
        }

        .primary-cta {
          border: 1px solid #111;
          background: #111;
          color: #fff;
          cursor: pointer;
        }

        .secondary-cta {
          border: 1px solid #e4e4de;
          background: #fff;
          color: #191919;
        }

        .primary-cta:hover,
        .secondary-cta:hover,
        .qr-banner-button:hover,
        .owner-cta:hover {
          transform: translateY(-2px);
        }

        .hero-trust {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 19px;
          margin-top: 27px;
          color: #777770;
          font-size: 10px;
        }

        .hero-trust > span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .trust-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #333;
        }

        .hero-visual {
          position: relative;
          min-width: 0;
          padding: 0 0 20px 10px;
        }

        .hero-image-frame {
          position: relative;
          width: 100%;
          height: 460px;
          overflow: hidden;
          border-radius: 18px;
          background: #e9e7e0;
        }

        .hero-image-overlay {
          position: absolute;
          inset: 40% 0 0;
          background: linear-gradient(transparent, #00000055);
          pointer-events: none;
        }

        .hero-food-label {
          position: absolute;
          right: 19px;
          bottom: 20px;
          left: 19px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border: 1px solid #ffffff45;
          border-radius: 12px;
          background: #ffffffed;
          color: #151515;
        }

        .hero-label-icon,
        .floating-note-icon {
          display: grid;
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 10px;
          background: #f0f0eb;
        }

        .hero-food-label strong,
        .hero-food-label span,
        .hero-floating-note strong,
        .hero-floating-note span {
          display: block;
        }

        .hero-food-label strong,
        .hero-floating-note strong {
          font-size: 12px;
        }

        .hero-food-label div > span,
        .hero-floating-note div > span {
          margin-top: 5px;
          color: #777770;
          font-size: 10px;
        }

        .hero-floating-note {
          position: absolute;
          top: 34px;
          left: -26px;
          display: flex;
          align-items: center;
          gap: 11px;
          padding: 13px 16px;
          border: 1px solid #eaeae5;
          border-radius: 13px;
          background: #fff;
          box-shadow: 0 12px 40px #0000000b;
        }

        .hero-number {
          position: absolute;
          right: 0;
          bottom: 0;
          color: #777770;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.15em;
        }

        .home-section {
          padding: 66px 0;
        }

        .category-section {
          padding-top: 43px;
          padding-bottom: 44px;
          border-top: 1px solid #ededE8;
          border-bottom: 1px solid #ededE8;
          background: #fff;
        }

        .section-topline {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 22px;
          margin-bottom: 28px;
        }

        .home-eyebrow {
          display: block;
          color: #777770;
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.15em;
        }

        .section-topline h2,
        .owner-banner h2 {
          margin: 10px 0 0;
          color: #151515;
          font-size: clamp(27px, 3.2vw, 39px);
          font-weight: 700;
          letter-spacing: -0.065em;
          line-height: 1.15;
        }

        .section-description {
          margin: 10px 0 0;
          color: #777770;
          font-size: 12px;
          line-height: 1.8;
        }

        .text-link {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          gap: 8px;
          color: #1a1a1a;
          font-size: 11px;
          font-weight: 650;
          text-decoration: none;
        }

        .category-list {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .category-pill {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-height: 43px;
          padding: 0 16px;
          border: 1px solid #e7e7e1;
          border-radius: 100px;
          background: #fff;
          color: #454540;
          font-size: 11px;
          font-weight: 550;
          cursor: pointer;
          transition: all 150ms ease;
        }

        .category-pill.active {
          border-color: #111;
          background: #111;
          color: #fff;
        }

        .food-section {
          background: #fafaf8;
        }

        .food-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 19px;
        }

        .food-card {
          min-width: 0;
          overflow: hidden;
          border: 1px solid #eaeae4;
          border-radius: 13px;
          background: #fff;
          transition:
            transform 200ms ease,
            box-shadow 200ms ease;
        }

        .food-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 15px 35px #11111108;
        }

        .food-image-wrap {
          position: relative;
          display: block;
          height: 190px;
          overflow: hidden;
          background: #eeeee9;
        }

        .food-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 300ms ease;
        }

        .food-card:hover .food-image {
          transform: scale(1.045);
        }

        .food-image-placeholder {
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 12px;
          color: #888880;
        }

        .food-image-placeholder span {
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.2em;
        }

        .food-type {
          position: absolute;
          top: 11px;
          left: 11px;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 7px 9px;
          border: 1px solid #ffffffb0;
          border-radius: 6px;
          background: #ffffffed;
          color: #333;
          font-size: 8px;
          font-weight: 750;
          letter-spacing: 0.04em;
        }

        .food-type.veg svg {
          color: #357b42;
        }

        .food-type.nonveg svg {
          color: #a24a3c;
        }

        .food-card-content {
          padding: 15px;
        }

        .food-card-heading {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }

        .food-card-heading h3 {
          margin: 0;
          color: #171717;
          font-size: 13px;
          font-weight: 700;
          line-height: 1.5;
        }

        .food-price {
          flex-shrink: 0;
          color: #111;
          font-size: 13px;
          font-weight: 750;
        }

        .food-category {
          margin: 7px 0 15px;
          color: #85857d;
          font-size: 10px;
        }

        .food-order-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid #ededE8;
          color: #222;
          font-size: 10px;
          font-weight: 650;
          text-decoration: none;
        }

        .home-loading,
        .food-empty {
          display: flex;
          min-height: 220px;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
        }

        .home-loading {
          gap: 13px;
          color: #777770;
          font-size: 12px;
        }

        .loading-spin {
          animation: thoam-spin 1s linear infinite;
        }

        @keyframes thoam-spin {
          to {
            transform: rotate(360deg);
          }
        }

        .food-empty {
          padding: 35px 20px;
          border: 1px dashed #dcdcd5;
          border-radius: 14px;
          background: #fff;
        }

        .empty-icon {
          display: grid;
          width: 54px;
          height: 54px;
          place-items: center;
          border-radius: 14px;
          background: #f1f1ec;
        }

        .food-empty h3 {
          margin: 19px 0 7px;
          font-size: 17px;
          letter-spacing: -0.04em;
        }

        .food-empty p {
          max-width: 350px;
          margin: 0 0 19px;
          color: #777770;
          font-size: 11px;
          line-height: 1.8;
        }

        .restaurant-section {
          background: #fff;
        }

        .restaurant-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .restaurant-card {
          display: flex;
          align-items: flex-start;
          gap: 15px;
          padding: 19px;
          border: 1px solid #e9e9e3;
          border-radius: 12px;
          background: #fff;
          color: inherit;
          text-decoration: none;
          transition:
            border-color 150ms ease,
            transform 150ms ease;
        }

        .restaurant-card:hover {
          transform: translateY(-2px);
          border-color: #bdbdb4;
        }

        .restaurant-mark {
          display: grid;
          width: 52px;
          height: 52px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 10px;
          background: #111;
          color: #fff;
        }

        .restaurant-mark span {
          font-family: Georgia, serif;
          font-size: 23px;
          font-style: italic;
        }

        .restaurant-details {
          min-width: 0;
        }

        .restaurant-details h3 {
          margin: 2px 0 7px;
          font-size: 13px;
          font-weight: 700;
        }

        .restaurant-details p {
          display: -webkit-box;
          overflow: hidden;
          margin: 0;
          color: #777770;
          font-size: 10px;
          line-height: 1.7;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .restaurant-discover {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 13px;
          font-size: 10px;
          font-weight: 700;
        }

        .restaurant-empty {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
          padding: 24px;
          border: 1px solid #e9e9e3;
          border-radius: 12px;
          color: #777770;
        }

        .restaurant-empty p {
          flex: 1;
          font-size: 12px;
        }

        .qr-section {
          padding-top: 5px;
        }

        .qr-banner {
          position: relative;
          display: flex;
          min-height: 300px;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
          overflow: hidden;
          padding: 48px;
          border-radius: 17px;
          background: #141414;
          color: #fff;
        }

        .qr-banner-copy {
          position: relative;
          z-index: 1;
          max-width: 550px;
        }

        .qr-banner .home-eyebrow {
          color: #b7b7ae;
        }

        .qr-banner h2 {
          margin: 15px 0;
          font-size: clamp(29px, 4vw, 44px);
          font-weight: 650;
          letter-spacing: -0.065em;
          line-height: 1.15;
        }

        .qr-banner h2 span {
          color: #c6c6bd;
          font-family: Georgia, serif;
          font-weight: 400;
          font-style: italic;
        }

        .qr-banner-copy > p {
          max-width: 460px;
          color: #b7b7b0;
          font-size: 12px;
          line-height: 1.9;
        }

        .qr-banner-button {
          margin-top: 12px;
          background: #fff;
          color: #111;
        }

        .qr-art {
          display: flex;
          flex-shrink: 0;
          align-items: center;
          flex-direction: column;
          gap: 15px;
          padding: 20px;
        }

        .qr-art-square {
          display: grid;
          width: 160px;
          height: 160px;
          place-items: center;
          border-radius: 15px;
          background: #fff;
          color: #111;
        }

        .qr-art-caption {
          color: #b7b7b0;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.2em;
        }

        .owner-section {
          padding-top: 10px;
          padding-bottom: 75px;
        }

        .owner-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 30px;
          padding: 35px 0;
          border-top: 1px solid #e8e8e2;
        }

        .owner-banner h2 {
          max-width: 500px;
        }

        .owner-banner p {
          max-width: 520px;
          color: #777770;
          font-size: 12px;
          line-height: 1.9;
        }

        .owner-cta {
          flex-shrink: 0;
          background: #111;
          color: #fff;
        }

        .home-footer {
          border-top: 1px solid #e9e9e3;
          background: #fff;
        }

        .footer-inner {
          display: flex;
          min-height: 91px;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
        }

        .thoam-brand {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: #111;
          font-size: 17px;
          font-weight: 750;
          letter-spacing: -0.06em;
          text-decoration: none;
        }

        .brand-symbol {
          display: grid;
          width: 32px;
          height: 32px;
          place-items: center;
          border-radius: 8px;
          background: #111;
          color: #fff;
          font-family: Georgia, serif;
          font-size: 17px;
          font-style: italic;
          letter-spacing: -0.06em;
        }

        .brand-dot {
          color: #888880;
        }

        .footer-copy,
        .footer-tagline {
          color: #777770;
          font-size: 10px;
        }

        .footer-tagline {
          font-size: 9px;
          font-weight: 750;
          letter-spacing: 0.12em;
        }

        @media (min-width: 1500px) {
          .home-container {
            width: min(1240px, calc(100% - 64px));
          }
        }

        @media (max-width: 1000px) {
          .hero-layout {
            gap: 35px;
          }

          .hero-image-frame {
            height: 390px;
          }

          .food-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .food-image-wrap {
            height: 220px;
          }

          .restaurant-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .home-container {
            width: calc(100% - 32px);
          }

          .home-hero {
            padding: 37px 0 45px;
          }

          .hero-layout {
            grid-template-columns: 1fr;
            gap: 32px;
          }

          .hero-content h1 {
            margin-top: 22px;
            font-size: clamp(49px, 13vw, 72px);
          }

          .hero-description {
            font-size: 13px;
          }

          .hero-trust {
            gap: 11px;
            font-size: 9px;
          }

          .hero-visual {
            padding-left: 10px;
          }

          .hero-image-frame {
            height: 330px;
            border-radius: 14px;
          }

          .hero-floating-note {
            top: 19px;
            left: -5px;
          }

          .home-section {
            padding: 47px 0;
          }

          .category-section {
            padding: 32px 0;
          }

          .section-topline {
            align-items: flex-start;
            margin-bottom: 22px;
          }

          .section-topline h2,
          .owner-banner h2 {
            font-size: 29px;
          }

          .section-topline > .text-link {
            margin-top: 17px;
          }

          .category-list {
            flex-wrap: nowrap;
            overflow-x: auto;
            padding-bottom: 7px;
          }

          .category-pill {
            flex-shrink: 0;
          }

          .food-grid {
            gap: 11px;
          }

          .food-image-wrap {
            height: 145px;
          }

          .food-card-content {
            padding: 11px;
          }

          .food-card-heading {
            flex-direction: column;
            gap: 4px;
          }

          .food-card-heading h3 {
            font-size: 12px;
          }

          .food-price {
            font-size: 12px;
          }

          .food-category {
            margin-bottom: 12px;
          }

          .food-order-link {
            font-size: 9px;
          }

          .food-type {
            top: 7px;
            left: 7px;
            padding: 6px;
            font-size: 7px;
          }

          .restaurant-grid {
            grid-template-columns: 1fr;
          }

          .qr-section {
            padding-top: 0;
          }

          .qr-banner {
            min-height: auto;
            flex-direction: column;
            align-items: flex-start;
            gap: 12px;
            padding: 29px 22px;
          }

          .qr-banner h2 {
            font-size: 32px;
          }

          .qr-art {
            align-self: center;
            padding-top: 18px;
          }

          .qr-art-square {
            width: 125px;
            height: 125px;
          }

          .qr-art-square svg {
            width: 85px;
            height: 85px;
          }

          .owner-section {
            padding-bottom: 40px;
          }

          .owner-banner {
            align-items: flex-start;
            flex-direction: column;
            gap: 12px;
          }

          .footer-inner {
            min-height: 110px;
            align-items: flex-start;
            justify-content: center;
            flex-direction: column;
            gap: 10px;
            padding-top: 20px;
            padding-bottom: 20px;
          }

          .footer-tagline {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-spin {
            animation: none;
          }

          .food-card,
          .food-image,
          .primary-cta,
          .secondary-cta {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}