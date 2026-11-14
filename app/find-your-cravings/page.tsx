"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ArrowRight, Check, ChefHat, MapPin, Sparkles, Utensils } from "lucide-react";
import "./cravings.css";

type Restaurant = {
  id: string; name: string; slug: string; area: string | null; city: string | null;
  latitude: number | null; longitude: number | null; delivery_radius_km: number | null;
  delivery_enabled: boolean; is_open: boolean;
};
type Product = {
  id: string; restaurant_id: string; name: string; description: string | null;
  price: number; image_url: string | null; category: string | null;
  taste_tags: string[]; cuisine_type: string | null; is_available: boolean;
};
type Match = Product & { restaurant: Restaurant; distance: number; score: number; reasons: string[] };
type Location = { latitude: number; longitude: number };

const tastes = [
  { id: "spicy", label: "Spicy", note: "A little heat", emoji: "🌶️" },
  { id: "sweet", label: "Sweet", note: "Sweet cravings", emoji: "🍯" },
  { id: "tangy", label: "Tangy", note: "Bright & zesty", emoji: "🍋" },
  { id: "savoury", label: "Savoury", note: "Rich flavours", emoji: "🧂" },
  { id: "mild", label: "Mild", note: "Soft & comforting", emoji: "🥛" },
  { id: "crunchy", label: "Crunchy", note: "A satisfying bite", emoji: "🥨" },
];
const cuisines = [
  { id: "kerala", label: "Kerala", emoji: "🥥" },
  { id: "south_indian", label: "South Indian", emoji: "🍛" },
  { id: "north_indian", label: "North Indian", emoji: "🫓" },
  { id: "arabic", label: "Arabic", emoji: "🍗" },
  { id: "chinese", label: "Chinese", emoji: "🥡" },
  { id: "continental", label: "Continental", emoji: "🍝" },
  { id: "fast_food", label: "Fast Food", emoji: "🍔" },
];
const money = (value: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
function distanceKm(a: Location, b: Location) {
  const rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(b.latitude - a.latitude), dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function FindYourCravingsPage() {
  const [step, setStep] = useState(0);
  const [selectedTastes, setSelectedTastes] = useState<string[]>([]);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [location, setLocation] = useState<Location | null>(null);
  const [locationState, setLocationState] = useState<"idle" | "loading" | "ready" | "denied">("idle");
  const [matches, setMatches] = useState<Match[]>([]);
  const [resultState, setResultState] = useState<"idle" | "unsupported" | "no_food" | "results">("idle");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocationState("denied"); return; }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      p => { setLocation({ latitude: p.coords.latitude, longitude: p.coords.longitude }); setLocationState("ready"); setError(""); },
      () => { setLocationState("denied"); setError("Location access is needed to show food that can actually be delivered to you."); },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 180000 }
    );
  }, []);

  useEffect(() => { requestLocation(); }, [requestLocation]);

  const cravingIdentity = useMemo(() => {
    if (selectedTastes.includes("spicy")) return { title: "The Spicy Explorer", copy: "Bold flavours, a little heat and exciting bites." };
    if (selectedTastes.includes("sweet")) return { title: "The Sweet Seeker", copy: "Comforting flavours and a sweeter side of life." };
    if (selectedTastes.includes("tangy")) return { title: "The Zesty Adventurer", copy: "Fresh, lively flavours with a tangy twist." };
    if (selectedTastes.includes("crunchy")) return { title: "The Crunch Chaser", copy: "Texture, crisp bites and satisfying food." };
    if (selectedTastes.includes("mild")) return { title: "The Comfort Seeker", copy: "Gentle flavours and feel-good favourites." };
    return { title: "The Flavour Explorer", copy: "A little bit of everything you love." };
  }, [selectedTastes]);

  function toggle(value: string, selected: string[], setter: (next: string[]) => void) {
    setter(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  }

  async function discover() {
    if (!location) { requestLocation(); return; }
    if (!supabase) { setError("Food discovery is temporarily unavailable. Please try again later."); return; }
    setLoading(true); setError(""); setMatches([]); setResultState("idle"); setStep(2);
    try {
      const { data: restaurants, error: restaurantError } = await supabase
        .from("restaurants")
        .select("id,name,slug,area,city,latitude,longitude,delivery_radius_km,delivery_enabled,is_open")
        .eq("status", "approved").eq("delivery_enabled", true).eq("is_open", true)
        .not("latitude", "is", null).not("longitude", "is", null);
      if (restaurantError) throw restaurantError;
      const nearbyDeliveryRestaurants = ((restaurants || []) as Restaurant[]).map(r => ({
        restaurant: r,
        distance: distanceKm(location, { latitude: Number(r.latitude), longitude: Number(r.longitude) })
      }));
      const eligible = nearbyDeliveryRestaurants.filter(x => x.distance <= Number(x.restaurant.delivery_radius_km || 0));
      if (!eligible.length) {
        setMatches([]);
        setResultState("unsupported");
        setLoading(false);
        return;
      }

      const ids = eligible.map(x => x.restaurant.id);
      const { data: products, error: productError } = await supabase
        .from("products")
        .select("id,restaurant_id,name,description,price,image_url,category,taste_tags,cuisine_type,is_available")
        .in("restaurant_id", ids).eq("is_available", true);
      if (productError) throw productError;

      if (!products?.length) {
        setMatches([]);
        setResultState("no_food");
        setLoading(false);
        return;
      }

      const byId = new Map(eligible.map(x => [x.restaurant.id, x]));
      const ranked = ((products || []) as Product[]).map(product => {
        const entry = byId.get(product.restaurant_id);
        if (!entry) return null;
        const tags = (product.taste_tags || []).map(t => t.toLowerCase());
        const cuisine = (product.cuisine_type || "").toLowerCase();
        const tasteMatch = selectedTastes.length ? selectedTastes.filter(t => tags.includes(t)).length / selectedTastes.length : 1;
        const cuisineMatch = selectedCuisines.length ? (selectedCuisines.includes(cuisine) ? 1 : 0) : 1;
        const score = Math.round(((selectedTastes.length ? tasteMatch * 0.6 : 0.6) + (selectedCuisines.length ? cuisineMatch * 0.4 : 0.4)) * 100);
        const reasons = [...selectedTastes.filter(t => tags.includes(t)), ...(selectedCuisines.includes(cuisine) && cuisine ? [cuisine.replaceAll("_", " ")] : [])];
        return { ...product, restaurant: entry.restaurant, distance: entry.distance, score, reasons };
      }).filter((item): item is Match => Boolean(item));

      const exactMatches = ranked.filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || a.distance - b.distance);
      // Existing menu items may not have been tagged yet. Never hide deliverable food:
      // show untagged nearby dishes as clearly labelled discovery picks instead.
      const untaggedPicks = ranked.filter(item => !item.taste_tags?.length && !item.cuisine_type)
        .sort((a, b) => a.distance - b.distance);
      const recommendations = (exactMatches.length ? exactMatches : untaggedPicks).slice(0, 15);
      setMatches(recommendations);
      setResultState(recommendations.length ? "results" : "no_food");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't load food recommendations.");
      setMatches([]);
      setResultState("idle");
    } finally { setLoading(false); }
  }

  return (
    <main className="cravings-page">
      <Header />
      <div className="cravings-shell">
        <Link href="/" className="cravings-back"><ArrowLeft size={16} /> Back to Tho’am</Link>
        <header className="cravings-intro">
          <span className="cravings-kicker"><Sparkles size={14} /> A LITTLE FOOD DISCOVERY</span>
          <h1>Find your <em>cravings.</em></h1>
          <p>Tell us what sounds good. We’ll find dishes nearby that can actually reach your door.</p>
          <div className={`cravings-location ${locationState}`}>
            <MapPin size={16} />
            {locationState === "ready" ? "Your location is ready" : locationState === "loading" ? "Finding your location…" : "Location needed for delivery matches"}
            {locationState === "denied" && <button type="button" onClick={requestLocation}>Try again</button>}
          </div>
        </header>

        <div className="cravings-progress" aria-label={`Step ${Math.min(step + 1, 3)} of 3`}>
          {[0,1,2].map(n => <span key={n} className={step >= n ? "active" : ""} />)}
        </div>

        {step === 0 && <section className="cravings-step">
          <div className="cravings-step-head"><span>01 / YOUR TASTE</span><h2>What flavours are you in the mood for?</h2><p>Choose as many as you like.</p></div>
          <div className="cravings-options">{tastes.map(t => <button key={t.id} type="button" onClick={() => toggle(t.id, selectedTastes, setSelectedTastes)} className={selectedTastes.includes(t.id) ? "selected" : ""}><span className="cravings-emoji">{t.emoji}</span><strong>{t.label}</strong><small>{t.note}</small>{selectedTastes.includes(t.id) && <Check className="cravings-check" size={17} />}</button>)}</div>
          <div className="cravings-actions"><span>{selectedTastes.length} selected</span><button type="button" className="cravings-primary" onClick={() => setStep(1)}>Choose cuisines <ArrowRight size={17} /></button></div>
        </section>}

        {step === 1 && <section className="cravings-step">
          <div className="cravings-step-head"><span>02 / YOUR CUISINE</span><h2>Which food worlds should we explore?</h2><p>Pick the cuisines you’re craving today.</p></div>
          <div className="cravings-cuisines">{cuisines.map(c => <button key={c.id} type="button" onClick={() => toggle(c.id, selectedCuisines, setSelectedCuisines)} className={selectedCuisines.includes(c.id) ? "selected" : ""}><span>{c.emoji}</span><strong>{c.label}</strong>{selectedCuisines.includes(c.id) && <Check size={16} />}</button>)}</div>
          <div className="cravings-actions"><button type="button" className="cravings-secondary" onClick={() => setStep(0)}>Back</button><button type="button" className="cravings-primary" disabled={!location} onClick={discover}>Find my food <Sparkles size={16} /></button></div>
          {!location && <p className="cravings-hint">Enable your location to see only restaurants that deliver to you.</p>}
        </section>}

        {step === 2 && <section className="cravings-results">
          {loading ? <div className="cravings-loading"><span className="cravings-loader"><Utensils size={24} /></span><h2>Finding your flavour match…</h2><p>Checking nearby restaurants and delivery areas.</p></div> : <>
            <div className="cravings-reveal"><span><Sparkles size={14} /> YOUR CRAVING PROFILE</span><h2>{cravingIdentity.title}</h2><p>{cravingIdentity.copy}</p></div>
            <div className="cravings-results-head"><div><span>MADE FOR YOUR MOOD</span><h2>Food you can order nearby</h2><p>Only open restaurants that support delivery to your current location.</p></div><button type="button" className="cravings-secondary" onClick={() => setStep(0)}>Start over</button></div>
            {error && <p className="cravings-error" role="alert">{error}</p>}
            {!matches.length && !error && resultState === "unsupported" && <div className="cravings-empty"><MapPin size={28}/><h3>This location is not supported for delivery</h3><p>We couldn’t find an open, delivery-enabled restaurant whose delivery area covers your current location. Try another location or browse restaurants nearby.</p><Link href="/restaurants" className="cravings-empty-link">Explore restaurants <ArrowRight size={15}/></Link></div>}
            {!matches.length && !error && resultState === "no_food" && <div className="cravings-empty"><ChefHat size={28}/><h3>No food matched your cravings</h3><p>There are restaurants that deliver to your location, but no available dishes matched the tastes and cuisines you selected. Try changing your choices or check back after menus are updated.</p><button type="button" className="cravings-secondary" onClick={() => setStep(0)}>Change my cravings</button></div>}
            <div className="cravings-food-grid">{matches.map(item => <article className="cravings-food-card" key={item.id}>
              {item.image_url ? <img src={item.image_url} alt={item.name} /> : <div className="cravings-food-placeholder"><Utensils size={28}/></div>}
              <div className="cravings-food-content"><div className="cravings-match">{item.score > 0 ? `${item.score}% match` : "Nearby pick"}</div><h3>{item.name}</h3><p className="cravings-restaurant">{item.restaurant.name} · {item.distance.toFixed(1)} km</p><p>{item.reasons.length ? `Matches your ${item.reasons.join(", ")} preferences.` : "Not tagged yet — a nearby dish you can explore."}</p><div className="cravings-card-bottom"><strong>{money(Number(item.price))}</strong><Link href={`/restaurants/${item.restaurant.slug}`}>Order now <ArrowRight size={15}/></Link></div></div>
            </article>)}</div>
          </>}
        </section>}
      </div>
    </main>
  );
}
