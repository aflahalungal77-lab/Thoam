
"use client";

import { useCallback, useEffect, useState, ChangeEvent, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Plus, Tag, Pencil, Trash2, Power,
  LoaderCircle, ImagePlus, X, Save, Percent,
  IndianRupee, CalendarDays, Package
} from "lucide-react";

type Product = {
  id: string;
  name: string;
  price: number;
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

type FormState = {
  title: string;
  description: string;
  scope: "order" | "products";
  discount_type: "percentage" | "fixed";
  discount_value: string;
  product_ids: string[];
  min_order_amount: string;
  max_discount: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  title: "",
  description: "",
  scope: "order",
  discount_type: "percentage",
  discount_value: "",
  product_ids: [],
  min_order_amount: "0",
  max_discount: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function localDateValue(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function OffersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [restaurantId, setRestaurantId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [existingImage, setExistingImage] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const notify = (text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
  };

  const loadData = useCallback(async () => {
    if (!supabase) {
      notify("Supabase configuration missing.", "error");
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/auth?role=owner&next=/restaurant-admin/offers");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role,restaurant_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (
        !profile?.restaurant_id ||
        !["restaurant_owner", "admin"].includes(profile.role)
      ) {
        notify("You are not authorized to manage offers.", "error");
        return;
      }

      setRestaurantId(profile.restaurant_id);

      const [
        { data: offerRows, error: offerError },
        { data: productRows, error: productError },
      ] = await Promise.all([
        supabase
          .from("offers")
          .select("*")
          .eq("restaurant_id", profile.restaurant_id)
          .order("created_at", { ascending: false }),

        supabase
          .from("products")
          .select("id,name,price")
          .eq("restaurant_id", profile.restaurant_id)
          .order("name"),
      ]);

      if (offerError) throw offerError;
      if (productError) throw productError;

      setOffers((offerRows || []) as Offer[]);
      setProducts((productRows || []) as Product[]);
    } catch (error) {
      console.error(error);
      notify(
        error instanceof Error ? error.message : "Could not load offers.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview("");
    setExistingImage("");
  }

  function startEdit(offer: Offer) {
    setEditing(offer.id);
    setForm({
      title: offer.title,
      description: offer.description || "",
      scope: offer.scope,
      discount_type: offer.discount_type,
      discount_value: String(offer.discount_value),
      product_ids: offer.product_ids || [],
      min_order_amount: String(offer.min_order_amount ?? 0),
      max_discount: offer.max_discount === null ? "" : String(offer.max_discount),
      starts_at: localDateValue(offer.starts_at),
      ends_at: localDateValue(offer.ends_at),
      is_active: offer.is_active,
    });
    setExistingImage(offer.image_url || "");
    setImagePreview(offer.image_url || "");
    setImageFile(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      notify("Please select an image file.", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      notify("Image must be smaller than 5 MB.", "error");
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function toggleProduct(id: string) {
    setForm((current) => ({
      ...current,
      product_ids: current.product_ids.includes(id)
        ? current.product_ids.filter((value) => value !== id)
        : [...current.product_ids, id],
    }));
  }

  async function uploadImage(): Promise<string | null> {
    if (!imageFile || !supabase || !restaurantId) return existingImage || null;

    const extension = imageFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${restaurantId}/${crypto.randomUUID()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("offer-images")
      .upload(path, imageFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: imageFile.type,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("offer-images")
      .getPublicUrl(path);

    return data.publicUrl;
  }

async function saveOffer(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  if (!supabase || saving) return;

  const discountValue = Number(form.discount_value);
  const minimum = Number(form.min_order_amount || 0);
  const maximum =
    form.max_discount === "" ? null : Number(form.max_discount);

  if (!form.title.trim()) {
    notify("Enter an offer title.", "error");
    return;
  }

  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    notify("Enter a valid discount value.", "error");
    return;
  }

  if (
    form.discount_type === "percentage" &&
    discountValue > 100
  ) {
    notify("Percentage discount cannot exceed 100%.", "error");
    return;
  }

  if (!Number.isFinite(minimum) || minimum < 0) {
    notify("Enter a valid minimum order amount.", "error");
    return;
  }

  if (
    maximum !== null &&
    (!Number.isFinite(maximum) || maximum <= 0)
  ) {
    notify("Maximum discount must be greater than zero.", "error");
    return;
  }

  if (
    form.scope === "products" &&
    form.product_ids.length === 0
  ) {
    notify("Select at least one product for this offer.", "error");
    return;
  }

  if (
    form.starts_at &&
    form.ends_at &&
    new Date(form.ends_at) <= new Date(form.starts_at)
  ) {
    notify("End date must be after start date.", "error");
    return;
  }

  setSaving(true);
  setMessage("");

  try {
    // 1. Verify the current authenticated user.
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError) throw authError;

    if (!user) {
      throw new Error("Your session has expired. Please log in again.");
    }

    // 2. Read the user's restaurant assignment.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, restaurant_id")
      .eq("id", user.id)
      .single();

    if (profileError) throw profileError;

    if (
      !profile?.restaurant_id ||
      !["restaurant_owner", "admin"].includes(profile.role)
    ) {
      throw new Error(
        "Your account does not have a restaurant assigned."
      );
    }

    const verifiedRestaurantId = profile.restaurant_id;

    // 3. Verify permission using the SECURITY DEFINER helper.
    const { data: allowed, error: permissionError } =
      await supabase.rpc("can_manage_restaurant", {
        target_restaurant_id: verifiedRestaurantId,
      });

    if (permissionError) throw permissionError;

    if (!allowed) {
      throw new Error(
        "You do not have permission to manage offers for this restaurant."
      );
    }

    // 4. Upload the image only after permission is verified.
    let imageUrl = existingImage || null;

    if (imageFile) {
      const extension =
        imageFile.name.split(".").pop()?.toLowerCase() || "jpg";

      const path =
        `${verifiedRestaurantId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("offer-images")
        .upload(path, imageFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: imageFile.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("offer-images")
        .getPublicUrl(path);

      imageUrl = publicUrlData.publicUrl;
    }

    // 5. Prepare the database payload.
    const payload = {
      restaurant_id: verifiedRestaurantId,
      title: form.title.trim(),
      description: form.description.trim() || null,
      image_url: imageUrl,
      scope: form.scope,
      discount_type: form.discount_type,
      discount_value: discountValue,
      product_ids:
        form.scope === "products" ? form.product_ids : [],
      min_order_amount: minimum,
      max_discount: maximum,
      starts_at: form.starts_at
        ? new Date(form.starts_at).toISOString()
        : null,
      ends_at: form.ends_at
        ? new Date(form.ends_at).toISOString()
        : null,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    // 6. Update existing offer or create a new one.
    if (editing) {
      const { data, error } = await supabase
        .from("offers")
        .update(payload)
        .eq("id", editing)
        .eq("restaurant_id", verifiedRestaurantId)
        .select("id")
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error("Offer update was not confirmed.");
      }

      notify("Offer updated successfully.");
    } else {
      const { data, error } = await supabase
        .from("offers")
        .insert(payload)
        .select("id")
        .single();

      if (error) throw error;

      if (!data) {
        throw new Error("Offer creation was not confirmed.");
      }

      notify("New offer created successfully.");
    }

    // 7. Refresh the list.
    resetForm();
    await loadData();
  } catch (error) {
    console.error("SAVE OFFER ERROR:", error);

    notify(
      error instanceof Error
        ? error.message
        : "Could not save offer.",
      "error"
    );
  } finally {
    setSaving(false);
  }
  console.log("STEP 1: Permission verified");

console.log("STEP 2: Starting image upload");

if (imageFile) {
  const imageUrl = await uploadImage();
  console.log("STEP 3: Image uploaded:", imageUrl);
}

console.log("STEP 4: Starting offer database insert");
}

  async function toggleActive(offer: Offer) {
    if (!supabase) return;

    const { error } = await supabase
      .from("offers")
      .update({
        is_active: !offer.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offer.id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      notify(error.message, "error");
      return;
    }

    notify(offer.is_active ? "Offer deactivated." : "Offer activated.");
    await loadData();
  }

  async function deleteOffer(offer: Offer) {
    if (!supabase) return;

    const confirmed = window.confirm(
      `Delete "${offer.title}"? This cannot be undone.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("offers")
      .delete()
      .eq("id", offer.id)
      .eq("restaurant_id", restaurantId);

    if (error) {
      notify(error.message, "error");
      return;
    }

    if (editing === offer.id) resetForm();

    notify("Offer deleted.");
    await loadData();
  }

  if (loading) {
    return (
      <main className="offers-page">
        <div className="loading-state">
          <LoaderCircle className="spin" size={30} />
          <h2>Loading offers</h2>
          <p>Preparing your promotions workspace.</p>
        </div>
        <OffersStyles />
      </main>
    );
  }

  return (
    <main className="offers-page">
      <header className="offers-topbar">
        <Link href="/restaurant-admin" className="back-link">
          <ArrowLeft size={17} /> Dashboard
        </Link>
        <span className="brand-mark">THO’AM <small>PARTNER</small></span>
      </header>

      <section className="offers-heading">
        <span className="eyebrow">RESTAURANT PROMOTIONS</span>
        <h1>Offers<span>.</span></h1>
        <p>Create discounts that make customers want to order.</p>
      </section>

      {message && (
        <div className={`notice ${messageType}`}>
          {message}
          <button type="button" onClick={() => setMessage("")}><X size={16} /></button>
        </div>
      )}

      <div className="offers-layout">
        <section className="editor-card">
          <div className="section-title">
            <div className="section-icon"><Plus size={20} /></div>
            <div>
              <span className="eyebrow">{editing ? "UPDATE PROMOTION" : "NEW PROMOTION"}</span>
              <h2>{editing ? "Edit offer" : "Create an offer"}</h2>
            </div>
          </div>

          <form onSubmit={saveOffer}>
            <label className="field">
              <span>Offer title *</span>
              <input
                value={form.title}
                onChange={(e) => updateForm("title", e.target.value)}
                maxLength={100}
                placeholder="Example: Weekend Special"
                required
              />
            </label>

            <label className="field">
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
                maxLength={300}
                rows={3}
                placeholder="Tell customers about this offer..."
              />
            </label>

            <div className="field">
              <span>Offer image</span>
              <label className="image-upload">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="Offer preview" />
                ) : (
                  <div className="image-placeholder">
                    <ImagePlus size={27} />
                    <strong>Upload offer image</strong>
                    <small>PNG, JPG or WEBP · Max 5 MB</small>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handleImage} />
              </label>
              {imagePreview && (
                <button
                  className="remove-image"
                  type="button"
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview("");
                    setExistingImage("");
                  }}
                >
                  <X size={14} /> Remove image
                </button>
              )}
            </div>

            <div className="field">
              <span>Offer applies to</span>
              <div className="choice-grid">
                <button
                  type="button"
                  className={form.scope === "order" ? "choice selected" : "choice"}
                  onClick={() => updateForm("scope", "order")}
                >
                  <ShoppingBagIcon />
                  <strong>Entire order</strong>
                  <small>Discount on the full items subtotal</small>
                </button>
                <button
                  type="button"
                  className={form.scope === "products" ? "choice selected" : "choice"}
                  onClick={() => updateForm("scope", "products")}
                >
                  <Package size={20} />
                  <strong>Selected products</strong>
                  <small>Discount on selected menu items</small>
                </button>
              </div>
            </div>

            {form.scope === "products" && (
              <div className="field">
                <span>Select products *</span>
                <div className="product-picker">
                  {products.length === 0 ? (
                    <p>No products found. Add products first.</p>
                  ) : products.map((product) => (
                    <label key={product.id} className="product-option">
                      <input
                        type="checkbox"
                        checked={form.product_ids.includes(product.id)}
                        onChange={() => toggleProduct(product.id)}
                      />
                      <span>{product.name}</span>
                      <strong>{money(Number(product.price))}</strong>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="field">
              <span>Discount type</span>
              <div className="segmented">
                <button
                  type="button"
                  className={form.discount_type === "percentage" ? "active" : ""}
                  onClick={() => updateForm("discount_type", "percentage")}
                >
                  <Percent size={16} /> Percentage
                </button>
                <button
                  type="button"
                  className={form.discount_type === "fixed" ? "active" : ""}
                  onClick={() => updateForm("discount_type", "fixed")}
                >
                  <IndianRupee size={16} /> Fixed amount
                </button>
              </div>
            </div>

            <div className="two-fields">
              <label className="field">
                <span>{form.discount_type === "percentage" ? "Discount (%) *" : "Discount (₹) *"}</span>
                <input
                  type="number"
                  min="0.01"
                  max={form.discount_type === "percentage" ? "100" : undefined}
                  step="0.01"
                  value={form.discount_value}
                  onChange={(e) => updateForm("discount_value", e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Minimum order (₹)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_order_amount}
                  onChange={(e) => updateForm("min_order_amount", e.target.value)}
                />
              </label>
            </div>

            <label className="field">
              <span>Maximum discount (₹) <small>OPTIONAL</small></span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.max_discount}
                onChange={(e) => updateForm("max_discount", e.target.value)}
                placeholder="No maximum"
              />
            </label>

            <div className="two-fields">
              <label className="field">
                <span><CalendarDays size={14} /> Starts at</span>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => updateForm("starts_at", e.target.value)}
                />
              </label>
              <label className="field">
                <span><CalendarDays size={14} /> Ends at</span>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => updateForm("ends_at", e.target.value)}
                />
              </label>
            </div>

            <label className="active-toggle">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => updateForm("is_active", e.target.checked)}
              />
              <span><strong>Activate offer</strong><small>Customers can use this offer when active and valid.</small></span>
            </label>

            <div className="form-actions">
              <button className="save-button" type="submit" disabled={saving}>
                {saving ? <LoaderCircle className="spin" size={18} /> : <Save size={18} />}
                {saving ? "Saving..." : editing ? "Save changes" : "Create offer"}
              </button>
              {editing && (
                <button className="cancel-button" type="button" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="list-section">
          <div className="list-heading">
            <div>
              <span className="eyebrow">YOUR PROMOTIONS</span>
              <h2>All offers <span>{offers.length}</span></h2>
            </div>
            <button className="new-button" onClick={resetForm}>
              <Plus size={17} /> New offer
            </button>
          </div>

          {offers.length === 0 ? (
            <div className="empty-state">
              <div><Tag size={28} /></div>
              <h3>No offers yet</h3>
              <p>Create your first promotion to show customers a discount at checkout.</p>
              <button className="save-button" onClick={resetForm}><Plus size={17} /> Create your first offer</button>
            </div>
          ) : (
            <div className="offer-list">
              {offers.map((offer) => (
                <article className="offer-card" key={offer.id}>
                  {offer.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="offer-image" src={offer.image_url} alt={offer.title} />
                  ) : (
                    <div className="offer-image image-empty"><Tag size={24} /></div>
                  )}
                  <div className="offer-content">
                    <div className="offer-card-top">
                      <span className={offer.is_active ? "status active" : "status inactive"}>
                        {offer.is_active ? "ACTIVE" : "INACTIVE"}
                      </span>
                      <span className="discount-label">
                        {offer.discount_type === "percentage"
                          ? `${offer.discount_value}% OFF`
                          : `${money(Number(offer.discount_value))} OFF`}
                      </span>
                    </div>
                    <h3>{offer.title}</h3>
                    <p>{offer.description || "No description added."}</p>
                    <small>
                      {offer.scope === "order" ? "Entire order" : `${offer.product_ids?.length || 0} selected products`}
                      {" · "}Min. {money(Number(offer.min_order_amount || 0))}
                    </small>
                    <div className="offer-actions">
                      <button onClick={() => startEdit(offer)}><Pencil size={15} /> Edit</button>
                      <button onClick={() => void toggleActive(offer)}><Power size={15} /> {offer.is_active ? "Deactivate" : "Activate"}</button>
                      <button className="delete-action" onClick={() => void deleteOffer(offer)}><Trash2 size={15} /> Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="offers-footer">
        <strong>THO’AM.</strong>
        <span>Restaurant partner workspace</span>
      </footer>

      <OffersStyles />
    </main>
  );
}

function ShoppingBagIcon() {
  return <Tag size={20} />;
}

function OffersStyles() {
  return (
    <style jsx global>{`
      .offers-page{--ink:#111;--muted:#777;--line:#e9e9e9;max-width:1280px;min-height:100vh;margin:auto;padding:30px 28px 20px;color:var(--ink)}
      .offers-topbar{display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:19px}
      .back-link{display:flex;align-items:center;gap:8px;color:#555;text-decoration:none;font-size:13px;font-weight:700}
      .brand-mark{font-weight:950;letter-spacing:2px;font-size:15px}.brand-mark small{font-size:9px;color:#999;letter-spacing:1px;margin-left:7px}
      .offers-heading{padding:38px 0 25px}.eyebrow{font-size:10px;letter-spacing:1.8px;font-weight:850;color:#888}
      .offers-heading h1{font-size:clamp(38px,5vw,55px);letter-spacing:-3px;margin:8px 0;font-weight:900}.offers-heading h1 span{color:#aaa}
      .offers-heading p{font-size:13px;color:#888;margin:0}
      .notice{display:flex;justify-content:space-between;align-items:center;padding:13px 16px;border-radius:10px;margin-bottom:20px;font-size:12px}
      .notice.success{background:#f1f8f2;color:#245c35;border:1px solid #d5e9d9}.notice.error{background:#fff5f5;color:#a22;border:1px solid #f0d0d0}
      .notice button{border:0;background:none;color:inherit;cursor:pointer}
      .offers-layout{display:grid;grid-template-columns:minmax(330px,.9fr) minmax(0,1.1fr);gap:24px;align-items:start}
      .editor-card{border:1px solid var(--line);border-radius:17px;padding:24px;background:white;box-shadow:0 8px 30px #00000006}
      .section-title{display:flex;align-items:center;gap:13px;margin-bottom:24px}.section-icon{width:43px;height:43px;display:grid;place-items:center;border-radius:12px;background:#111;color:#fff}
      .section-title h2,.list-heading h2{font-size:19px;margin:5px 0 0;font-weight:850;letter-spacing:-.5px}
      .editor-card form{display:flex;flex-direction:column;gap:17px}
      .field{display:flex;flex-direction:column;gap:8px;min-width:0}.field>span{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:750}
      .field input:not([type=checkbox]):not([type=file]),.field textarea{width:100%;min-width:0;padding:12px 13px;border:1px solid #e4e4e4;border-radius:9px;background:#fafafa;font:inherit;font-size:12px;color:#111;outline:none}
      .field input:focus,.field textarea:focus{border-color:#111;background:#fff;box-shadow:0 0 0 3px #00000009}
      .field textarea{resize:vertical}.field small{font-size:9px;color:#999;font-weight:500}
      .image-upload{display:flex;min-height:145px;overflow:hidden;align-items:center;justify-content:center;border:1px dashed #ccc;border-radius:12px;background:#fafafa;cursor:pointer}
      .image-upload input{display:none}.image-upload img{width:100%;height:180px;object-fit:cover}
      .image-placeholder{display:flex;flex-direction:column;align-items:center;gap:8px;color:#888}
      .image-placeholder strong{font-size:12px;color:#333}.image-placeholder small{font-size:10px}
      .remove-image{display:flex;align-items:center;gap:5px;border:0;background:none;color:#a33;font-size:11px;cursor:pointer;margin-top:5px}
      .choice-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px}
      .choice{display:flex;flex-direction:column;align-items:flex-start;gap:8px;text-align:left;padding:14px;border:1px solid #e5e5e5;border-radius:11px;background:#fff;color:#333;cursor:pointer}
      .choice strong{font-size:11px}.choice small{font-size:10px;color:#888;line-height:1.5}.choice.selected{border-color:#111;background:#f7f7f7;box-shadow:inset 0 0 0 1px #111}
      .product-picker{max-height:220px;overflow:auto;border:1px solid #e5e5e5;border-radius:10px;padding:5px}
      .product-option{display:flex;align-items:center;gap:10px;padding:10px;border-bottom:1px solid #eee;font-size:11px;cursor:pointer}
      .product-option:last-child{border:0}.product-option input{accent-color:#111}.product-option span{flex:1}.product-option strong{font-size:11px}
      .product-picker>p{font-size:11px;color:#888;padding:10px}
      .segmented{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:4px;background:#f2f2f2;border-radius:10px}
      .segmented button{display:flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:8px;padding:10px 5px;background:transparent;font-size:11px;font-weight:750;cursor:pointer}
      .segmented button.active{background:#111;color:#fff}
      .two-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .active-toggle{display:flex;align-items:center;gap:11px;padding:14px;border:1px solid var(--line);border-radius:10px}
      .active-toggle input{width:17px;height:17px;accent-color:#111}.active-toggle span{display:flex;flex-direction:column;gap:4px}
      .active-toggle strong{font-size:12px}.active-toggle small{font-size:10px;color:#888}
      .form-actions{display:flex;gap:9px}
      .save-button,.new-button{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 16px;border:0;border-radius:9px;background:#111;color:#fff;font-size:12px;font-weight:800;cursor:pointer}
      .save-button{flex:1;min-height:46px}.save-button:disabled{opacity:.6;cursor:wait}
      .cancel-button{padding:10px 15px;border:1px solid #ddd;border-radius:9px;background:white;font-size:12px;cursor:pointer}
      .list-heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:17px}.list-heading h2 span{font-size:12px;color:#888;margin-left:6px}
      .new-button{font-size:11px;padding:10px 13px}
      .offer-list{display:flex;flex-direction:column;gap:13px}
      .offer-card{display:flex;gap:15px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff}
      .offer-image{width:112px;height:112px;flex-shrink:0;object-fit:cover;border-radius:10px;background:#f3f3f3}
      .image-empty{display:grid;place-items:center;color:#999}
      .offer-content{flex:1;min-width:0}.offer-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}
      .status{font-size:9px;font-weight:900;letter-spacing:1px}.status.active{color:#277143}.status.inactive{color:#999}
      .discount-label{font-size:10px;font-weight:900;padding:6px 8px;border-radius:6px;background:#f3f3f3}
      .offer-content h3{font-size:14px;margin:10px 0 5px;font-weight:850}.offer-content p{font-size:11px;color:#888;margin:0 0 7px;line-height:1.5}
      .offer-content>small{font-size:10px;color:#777}
      .offer-actions{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
      .offer-actions button{display:flex;align-items:center;gap:5px;padding:7px 9px;border:1px solid #e5e5e5;border-radius:7px;background:white;color:#333;font-size:10px;font-weight:700;cursor:pointer}
      .offer-actions button:hover{border-color:#111}.offer-actions .delete-action{color:#a33}
      .empty-state{display:flex;flex-direction:column;align-items:center;text-align:center;padding:45px 20px;border:1px dashed #ccc;border-radius:15px}
      .empty-state>div{width:55px;height:55px;display:grid;place-items:center;border-radius:16px;background:#f2f2f2}
      .empty-state h3{font-size:16px;margin:15px 0 5px}.empty-state p{max-width:300px;font-size:11px;color:#888;line-height:1.6}
      .empty-state .save-button{margin-top:10px;flex:initial}
      .offers-footer{display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:38px;padding:20px 0;color:#999;font-size:10px}
      .offers-footer strong{color:#111;letter-spacing:2px;font-size:12px}
      .loading-state{min-height:70vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
      .loading-state h2{font-size:18px}.loading-state p{font-size:12px;color:#888}
      .spin{animation:offer-spin 1s linear infinite}@keyframes offer-spin{to{transform:rotate(360deg)}}
      @media(max-width:900px){.offers-layout{grid-template-columns:1fr}.list-section{margin-top:12px}}
      @media(max-width:520px){.offers-page{padding:18px 13px}.editor-card{padding:17px}.two-fields{grid-template-columns:1fr}.offer-card{gap:10px;padding:10px}.offer-image{width:82px;height:82px}.offer-actions button{font-size:9px;padding:6px}.offers-heading{padding:28px 0 20px}}
      @media(prefers-reduced-motion:reduce){.offers-page *{animation-duration:.01ms!important;transition-duration:.01ms!important}}
    `}</style>
  );
}
