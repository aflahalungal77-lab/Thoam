
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

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (value: number) => (value * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Restaurants() {
  const [items, setItems] = useState<Restaurant[]>([]);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<"idle" | "loading" | "ready" | "denied" | "unsupported">("idle");

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
          "id,name,slug,description,area,city,logo_url,is_open,delivery_enabled,qr_enabled,latitude,longitude"
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

  const requestLocation = () => {
    if (!navigator.geolocation) { setLocationStatus("unsupported"); return; }
    setLocationStatus("loading");
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); setLocationStatus("ready"); },
      error => setLocationStatus(error.code === error.PERMISSION_DENIED ? "denied" : "idle"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  useEffect(() => {
    requestLocation();
    // Ask for location when the restaurant directory opens; users can deny and continue browsing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const matches = items.filter((restaurant) => {
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
    if (!userLocation) return matches;
    const located = matches.filter(r => r.latitude != null && r.longitude != null)
      .map(restaurant => ({ restaurant, distance: calculateDistanceKm(userLocation.latitude, userLocation.longitude, Number(restaurant.latitude), Number(restaurant.longitude)) }))
      .sort((a,b) => a.distance-b.distance);
    const within15km = located.filter(item => item.distance <= 15);
    if (within15km.length) return within15km.map(item => item.restaurant);
    return located.length ? located.map(item => item.restaurant) : matches;
  }, [items, query, area, filter, userLocation]);

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
            <button type="button" onClick={requestLocation} disabled={locationStatus === "loading"} className="restaurants-location-button"><MapPin size={15} /> {locationStatus === "loading" ? "Finding your location..." : locationStatus === "ready" ? "Location enabled · Nearby first" : "Use my location"}</button>
            {locationStatus === "denied" && <p className="restaurants-location-help">Location permission was denied. Enable it in browser settings, or browse all restaurants.</p>}
            {locationStatus === "unsupported" && <p className="restaurants-location-help">Location is not supported by this browser. You can still browse all restaurants.</p>}
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
              <h2>{userLocation ? "Restaurants near you" : "Explore restaurants"}</h2>
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
                      <div
                        className="restaurant-logo-frame"
                        style={{
                          position: "absolute",
                          inset: 14,
                          display: "grid",
                          placeItems: "center",
                          overflow: "hidden",
                          border: "1px solid rgba(255,255,255,0.82)",
                          borderRadius: 18,
                          background: "linear-gradient(145deg, #ffffff 0%, #f5f5f2 100%)",
                          boxShadow: "0 8px 28px rgba(0,0,0,0.08), inset 0 0 0 4px rgba(255,255,255,0.72)",
                        }}
                      >
                        <Image
                          src={restaurant.logo_url}
                          alt={`${restaurant.name} logo`}
                          fill
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 45vw, 300px"
                          className="restaurant-card-logo"
                          style={{ objectFit: "contain", padding: 18 }}
                        />
                      </div>
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
                    {userLocation && restaurant.latitude != null && restaurant.longitude != null && <p className="restaurant-distance">{calculateDistanceKm(userLocation.latitude,userLocation.longitude,Number(restaurant.latitude),Number(restaurant.longitude)).toFixed(1)} km away</p>}

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
      <style jsx global>{`
        .restaurants-location-button{display:inline-flex;align-items:center;gap:9px;margin-top:18px;min-height:42px;padding:0 15px;border:1px solid #171717;border-radius:999px;background:#171717;color:#fff;font:700 12px Arial,sans-serif;cursor:pointer}
        .restaurants-location-button:disabled{opacity:.65;cursor:wait}
        .restaurants-location-help{max-width:430px;margin:9px 0 0;color:#777;font-size:11px;line-height:1.6}
        .restaurant-distance{margin:5px 0 0;color:#555;font-size:11px;font-weight:700}
      `}</style>
    </>
  );
}
