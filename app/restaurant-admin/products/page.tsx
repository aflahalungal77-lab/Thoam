"use client";

import { useCallback, useEffect, useState, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Plus, Trash2, Upload, Image as ImageIcon,
  Package, Search, CheckCircle2, XCircle, LoaderCircle,
} from "lucide-react";

const categories = [
  "Biriyani", "Mandhi", "Fried Rice", "Shawarma", "Burger",
  "Pizza", "Snacks", "Drinks", "Other",
];

export default function ProductsPage() {
  const router = useRouter();

  const [rid, setRid] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Biriyani");
  const [veg, setVeg] = useState(false);
  const [desc, setDesc] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");

  const load = useCallback(async () => {
    if (!supabase) {
      setMsg("Supabase is not configured.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/auth?role=owner&next=/restaurant-admin/products");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("restaurant_id,role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      setMsg(profileError.message);
      return;
    }

    if (
      (profile?.role !== "restaurant_owner" && profile?.role !== "admin") ||
      !profile?.restaurant_id
    ) {
      setMsg("This account is not linked to a restaurant.");
      return;
    }

    setRid(profile.restaurant_id);

    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("restaurant_id", profile.restaurant_id)
      .order("created_at", { ascending: false });

    if (error) setMsg(error.message);
    else setItems(data || []);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadImage(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setMsg("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMsg("Choose a JPG, PNG or WebP image.");
      input.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMsg("Image must be 5 MB or smaller.");
      input.value = "";
      return;
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !preset) {
      setMsg("Configure the Cloudinary cloud name and upload preset in .env.local.");
      input.value = "";
      return;
    }

    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", preset);
      form.append("folder", "thoam-food");

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: form }
      );

      const result = await response.json();

      if (!response.ok || !result.secure_url) {
        throw new Error(result.error?.message || "Image upload failed.");
      }

      setImageUrl(result.secure_url);
      setMsg("Image uploaded successfully.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Image upload failed.");
    } finally {
      setUploading(false);
      input.value = "";
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !rid || saving || uploading) return;

    if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
      setMsg("Enter a valid price greater than zero.");
      return;
    }

    setSaving(true);
    setMsg("");

    const { error } = await supabase.from("products").insert({
      restaurant_id: rid,
      name: name.trim(),
      price: Number(price),
      category,
      is_veg: veg,
      description: desc.trim(),
      image_url: imageUrl || null,
      is_available: true,
    });

    if (error) {
      setMsg(error.message);
    } else {
      setName("");
      setPrice("");
      setCategory("Biriyani");
      setVeg(false);
      setDesc("");
      setImageUrl("");
      setMsg("Product added successfully.");
      await load();
    }

    setSaving(false);
  }

  async function toggle(product: any) {
    if (!supabase || busyId) return;

    setBusyId(product.id);
    setMsg("");

    const { error } = await supabase
      .from("products")
      .update({ is_available: !product.is_available })
      .eq("id", product.id)
      .eq("restaurant_id", rid);

    if (error) setMsg(error.message);
    else {
      setItems((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, is_available: !item.is_available }
            : item
        )
      );
    }

    setBusyId("");
  }

  async function remove(product: any) {
    if (!supabase || busyId) return;

    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) {
      return;
    }

    setBusyId(product.id);
    setMsg("");

    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id)
      .eq("restaurant_id", rid);

    if (error) setMsg(error.message);
    else setItems((current) => current.filter((p) => p.id !== product.id));

    setBusyId("");
  }

  const visibleItems = items.filter((item) => {
    const matchesSearch =
      `${item.name} ${item.category || ""}`
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesFilter =
      filter === "All" ||
      (filter === "Available" && item.is_available) ||
      (filter === "Unavailable" && !item.is_available);

    return matchesSearch && matchesFilter;
  });

  return (
    <main className="container ta-manage-page">
      <Link href="/restaurant-admin" className="ta-back-link">
        <ArrowLeft size={15} /> Dashboard
      </Link>

      <header className="ta-manage-heading">
        <div>
          <span className="ta-eyebrow">YOUR MENU WORKSPACE</span>
          <h1>Product management<span>.</span></h1>
          <p>Every dish, every detail, all in one place.</p>
        </div>

        <div className="ta-manage-heading-icon">
          <Package size={27} />
        </div>
      </header>

      {msg && (
        <div className="ta-manage-message" role="status">
          {msg}
          <button onClick={() => setMsg("")} aria-label="Dismiss message">×</button>
        </div>
      )}

      <section className="ta-product-summary">
        <div>
          <span>Total products</span>
          <strong>{items.length}</strong>
        </div>
        <div>
          <span>Available</span>
          <strong>{items.filter((p) => p.is_available).length}</strong>
        </div>
        <div>
          <span>Unavailable</span>
          <strong>{items.filter((p) => !p.is_available).length}</strong>
        </div>
      </section>

      <div className="ta-product-layout">
        <section className="ta-manage-panel ta-add-product">
          <div className="ta-panel-heading">
            <div>
              <span className="ta-eyebrow">MENU EDITOR</span>
              <h2>Add a dish</h2>
            </div>
            <div className="ta-panel-icon"><Plus size={20} /></div>
          </div>

          <form onSubmit={add} className="ta-product-form">
            <label className="ta-field">
              Food name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Malabar chicken biriyani"
                maxLength={120}
              />
            </label>

            <div className="ta-form-row">
              <label className="ta-field">
                Price (₹)
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="180"
                />
              </label>

              <label className="ta-field">
                Category
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {categories.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
            </div>

            <label className="ta-field">
              Description
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Describe ingredients or what makes this dish special..."
              />
              <span className="ta-character-count">{desc.length}/500</span>
            </label>

            <div className="ta-field">
              <span>Food image</span>

              <label className="ta-upload-box">
                {imageUrl ? (
                  <img src={imageUrl} alt="Food preview" />
                ) : (
                  <div className="ta-upload-placeholder">
                    {uploading ? <LoaderCircle className="ta-refreshing" /> : <ImageIcon size={29} />}
                    <strong>{uploading ? "Uploading image..." : "Upload a food photo"}</strong>
                    <span>JPG, PNG or WebP · Up to 5 MB</span>
                    {!uploading && <span className="ta-upload-cta"><Upload size={14} /> Choose image</span>}
                  </div>
                )}

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={uploadImage}
                  disabled={uploading}
                />
              </label>

              {imageUrl && (
                <button
                  type="button"
                  className="ta-remove-image"
                  onClick={() => setImageUrl("")}
                >
                  <Trash2 size={13} /> Remove image
                </button>
              )}
            </div>

            <label className="ta-veg-toggle">
              <input
                type="checkbox"
                checked={veg}
                onChange={(e) => setVeg(e.target.checked)}
              />
              <span className="ta-veg-indicator" />
              <span>
                <strong>Vegetarian dish</strong>
                <small>Mark this item as vegetarian.</small>
              </span>
            </label>

            <button
              className="ta-form-submit"
              disabled={saving || uploading || !rid}
            >
              {saving ? <LoaderCircle className="ta-refreshing" size={17} /> : <Plus size={17} />}
              {saving ? "Adding product..." : "Add product to menu"}
            </button>
          </form>
        </section>

        <section className="ta-menu-section">
          <div className="ta-menu-heading">
            <div>
              <span className="ta-eyebrow">YOUR RESTAURANT</span>
              <h2>Menu items <span>({items.length})</span></h2>
            </div>
          </div>

          <div className="ta-menu-toolbar">
            <label className="ta-menu-search">
              <Search size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search your menu..."
                aria-label="Search products"
              />
            </label>

            <select
              className="ta-filter-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              aria-label="Filter products"
            >
              <option>All</option>
              <option>Available</option>
              <option>Unavailable</option>
            </select>
          </div>

          {visibleItems.length === 0 ? (
            <div className="ta-menu-empty">
              <Package size={30} />
              <h3>{items.length ? "No matching dishes" : "Your menu starts here."}</h3>
              <p>{items.length ? "Try another search or filter." : "Add your first dish using the menu editor."}</p>
            </div>
          ) : (
            <div className="ta-product-grid">
              {visibleItems.map((product) => (
                <article className="ta-product-card" key={product.id}>
                  <div className="ta-product-image">
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} loading="lazy" />
                    ) : (
                      <div className="ta-no-image"><ImageIcon size={30} /></div>
                    )}

                    <span className={`ta-product-status ${product.is_available ? "available" : "unavailable"}`}>
                      <span />
                      {product.is_available ? "Available" : "Unavailable"}
                    </span>

                    {product.is_veg && (
                      <span className="ta-veg-tag">VEG</span>
                    )}
                  </div>

                  <div className="ta-product-info">
                    <span className="ta-product-category">{product.category || "Other"}</span>
                    <h3>{product.name}</h3>
                    {product.description && <p>{product.description}</p>}

                    <div className="ta-product-card-bottom">
                      <strong>₹{Number(product.price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                      <span>{product.is_available ? "On menu" : "Hidden"}</span>
                    </div>

                    <div className="ta-product-actions">
                      <button
                        className="ta-availability-button"
                        onClick={() => void toggle(product)}
                        disabled={Boolean(busyId)}
                      >
                        {busyId === product.id ? (
                          <LoaderCircle size={14} className="ta-refreshing" />
                        ) : product.is_available ? (
                          <><XCircle size={14} /> Mark unavailable</>
                        ) : (
                          <><CheckCircle2 size={14} /> Make available</>
                        )}
                      </button>

                      <button
                        className="ta-delete-button"
                        onClick={() => void remove(product)}
                        disabled={Boolean(busyId)}
                        aria-label={`Delete ${product.name}`}
                        title="Delete product"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}