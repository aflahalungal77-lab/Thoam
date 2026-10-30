
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Header from "@/components/Header";
import {
  Search,
  MapPin,
  SlidersHorizontal,
  Store,
  ArrowUpRight,
  Clock3,
  QrCode,
  Utensils,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Restaurant } from "@/lib/types";

type FilterType = "all" | "open" | "qr";

export default function Restaurants() {
  const [items, setItems] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("restaurants")
        .select(
          "id,name,slug,description,area,city,logo_url,is_open,delivery_enabled,qr_enabled"
        )
        .eq("status", "approved")
        .order("name");

      if (!active) return;

      if (error) {
        setErr(error.message);
      } else {
        setItems((data || []) as Restaurant[]);
      }

      setLoading(false);
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((restaurant) => {
      const searchableText = [
        restaurant.name,
        restaurant.area,
        restaurant.city,
        restaurant.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = searchableText.includes(
        query.trim().toLowerCase()
      );

      const restaurantArea = [
        restaurant.area,
        restaurant.city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesArea = restaurantArea.includes(
        area.trim().toLowerCase()
      );

      const matchesFilter =
        filter === "all" ||
        (filter === "open" && restaurant.is_open) ||
        (filter === "qr" && restaurant.qr_enabled);

      return matchesQuery && matchesArea && matchesFilter;
    });
  }, [items, query, area, filter]);

  const clearSearch = () => {
    setQuery("");
    setArea("");
    setFilter("all");
  };

  return (
    <>
      <Header />

      <main className="restaurants-page">
        {/* Hero */}
        <section className="restaurants-hero">
          <div className="restaurants-hero-inner">
            <div className="restaurants-eyebrow">
              <span className="eyebrow-dot" />
              YOUR LOCAL FOOD GUIDE
            </div>

            <h1>
              Good food.
              <br />
              <span>Close to you.</span>
            </h1>

            <p className="restaurants-hero-description">
              Discover local restaurants, explore their menus,
              and find something you will love.
            </p>

            <a href="#restaurant-list" className="restaurants-hero-cta">
              Explore restaurants
              <ArrowUpRight size={17} />
            </a>

            <div className="restaurants-hero-note">
              <MapPin size={14} />
              <span>Discover local favourites around you</span>
            </div>
          </div>

          <div className="restaurants-hero-decoration" aria-hidden="true">
            <div className="hero-circle hero-circle-one" />
            <div className="hero-circle hero-circle-two" />
            <Utensils className="hero-utensils" size={100} strokeWidth={0.7} />
            <span className="hero-decoration-dot" />
          </div>
        </section>

        {/* Restaurant listing */}
        <section
          className="restaurants-content"
          id="restaurant-list"
        >
          <div className="restaurants-section-heading">
            <div>
              <div className="restaurants-section-kicker">
                FIND YOUR NEXT FAVOURITE
              </div>
              <h2>Explore restaurants</h2>
              <p>
                Find a place, browse the options, and discover your next meal.
              </p>
            </div>

            {!loading && !err && supabase && (
              <div className="restaurant-count">
                <Store size={15} />
                <span>
                  {filtered.length}{" "}
                  {filtered.length === 1 ? "place" : "places"}
                </span>
              </div>
            )}
          </div>

          {/* Search */}
          <div className="restaurants-search-panel">
            <label className="restaurants-search-field">
              <Search size={19} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Restaurant, food or location..."
                aria-label="Search restaurants"
              />

              {query && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </label>

            <label className="restaurants-area-field">
              <MapPin size={18} />
              <input
                value={area}
                onChange={(event) => setArea(event.target.value)}
                placeholder="Area or city"
                aria-label="Filter by area or city"
              />
            </label>
          </div>

          {/* Filters */}
          <div className="restaurants-filters">
            <div className="filter-label">
              <SlidersHorizontal size={15} />
              <span>FILTER</span>
            </div>

            <div className="restaurants-filter-options">
              {(
                [
                  ["all", "All restaurants"],
                  ["open", "Open now"],
                  ["qr", "QR ordering"],
                ] as [FilterType, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`restaurants-filter-chip ${
                    filter === value ? "selected" : ""
                  }`}
                  aria-pressed={filter === value}
                >
                  {value === "qr" && <QrCode size={14} />}
                  {label}
                </button>
              ))}
            </div>

            {(query || area || filter !== "all") && (
              <button
                type="button"
                className="clear-filters"
                onClick={clearSearch}
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Loading */}
          {loading ? (
            <div className="restaurant-grid">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div className="restaurant-skeleton" key={item}>
                  <div className="skeleton-image" />
                  <div className="skeleton-line skeleton-line-long" />
                  <div className="skeleton-line skeleton-line-short" />
                  <div className="skeleton-line skeleton-line-medium" />
                </div>
              ))}
            </div>
          ) : err ? (
            <div className="restaurants-empty">
              <div className="restaurants-empty-icon">
                <Store size={27} />
              </div>
              <h3>We couldn’t load restaurants</h3>
              <p>Please check your connection and try again.</p>
              <p className="restaurants-error-detail">{err}</p>
            </div>
          ) : !supabase ? (
            <div className="restaurants-empty">
              <div className="restaurants-empty-icon">
                <Store size={27} />
              </div>
              <h3>Restaurants are getting ready</h3>
              <p>
                Restaurant listings will appear here when the service
                is connected and approved listings are available.
              </p>
              <Link
                className="restaurants-primary-button"
                href="/owner"
              >
                Register your restaurant
                <ArrowUpRight size={17} />
              </Link>
            </div>
          ) : filtered.length === 0 ? (
            <div className="restaurants-empty">
              <div className="restaurants-empty-icon">
                <Search size={27} />
              </div>
              <h3>No matching restaurants</h3>
              <p>
                Try a different search or remove some filters to
                discover other local places.
              </p>
              <button
                type="button"
                className="restaurants-primary-button"
                onClick={clearSearch}
              >
                Clear all filters
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="restaurant-grid">
              {filtered.map((restaurant) => (
                <Link
                  className="restaurant-card"
                  key={restaurant.id}
                  href={`/restaurants/${restaurant.slug}`}
                >
                  <div className="restaurant-card-visual">
                    {restaurant.logo_url ? (
                      <Image
                        src={restaurant.logo_url}
                        alt={`${restaurant.name} logo`}
                        fill
                        sizes="(max-width: 640px) 45vw, (max-width: 1024px) 45vw, 300px"
                        className="restaurant-card-logo"
                      />
                    ) : (
                      <div className="restaurant-card-placeholder">
                        <Store size={35} strokeWidth={1.2} />
                      </div>
                    )}

                    <span
                      className={`restaurant-status ${
                        restaurant.is_open ? "is-open" : "is-closed"
                      }`}
                    >
                      <span className="status-indicator" />
                      {restaurant.is_open ? "Open" : "Closed"}
                    </span>

                    {restaurant.qr_enabled && (
                      <span className="restaurant-qr-badge">
                        <QrCode size={12} />
                        QR ordering
                      </span>
                    )}

                    <span className="restaurant-card-arrow">
                      <ArrowUpRight size={18} />
                    </span>
                  </div>

                  <div className="restaurant-card-body">
                    <div className="restaurant-card-title-row">
                      <h3>{restaurant.name}</h3>
                    </div>

                    <div className="restaurant-card-location">
                      <MapPin size={14} />
                      <span>
                        {[restaurant.area, restaurant.city]
                          .filter(Boolean)
                          .join(", ") || "Local restaurant"}
                      </span>
                    </div>

                    <p className="restaurant-card-description">
                      {restaurant.description ||
                        "Explore the menu and discover what’s available."}
                    </p>

                    <div className="restaurant-card-footer">
                      <span className="restaurant-view-menu">
                        Explore menu
                        <ArrowUpRight size={15} />
                      </span>

                      {restaurant.delivery_enabled && (
                        <span className="restaurant-delivery">
                          <Clock3 size={13} />
                          Delivery
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Restaurant owner CTA */}
        <section className="restaurant-owner-banner">
          <div className="owner-banner-icon">
            <Store size={24} />
          </div>

          <div className="owner-banner-copy">
            <span>ARE YOU A RESTAURANT OWNER?</span>
            <h2>Bring your restaurant online.</h2>
            <p>
              Join the local food community and manage your menu
              and orders in one place.
            </p>
          </div>

          <Link href="/owner" className="owner-banner-button">
            Get started
            <ArrowUpRight size={17} />
          </Link>
        </section>

        <footer className="restaurants-footer">
          <Link href="/" className="restaurants-footer-brand">
            <Image
              src="/logo.png"
              alt="Tho'am"
              width={30}
              height={30}
            />
          </Link>
          <span>Local food, connected.</span>
        </footer>
      </main>
    </>
  );
}
