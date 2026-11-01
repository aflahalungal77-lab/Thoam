"use client";

import { useState, type ChangeEvent } from "react";
import { supabase } from "@/lib/supabase";
import {
  Store,
  UserRound,
  MessageCircle,
  Link2,
  ArrowRight,
  Check,
  LoaderCircle,
  ShieldCheck,
  UtensilsCrossed,
  ExternalLink,
  Sparkles,
  X,
} from "lucide-react";

type Props = {
  onComplete: () => void;
};

export default function RestaurantSetupModal({ onComplete }: Props) {
  const [ownerName, setOwnerName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [slug, setSlug] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleRestaurantName(value: string) {
    setRestaurantName(value);

    setSlug(
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    );
  }

  function handleSlugChange(value: string) {
    setSlug(
      value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
    );
  }

  async function handleLogoUpload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP logo.");
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Logo must be 5 MB or smaller.");
      input.value = "";
      return;
    }
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !preset) {
      setError("Logo upload is not configured. Please contact Tho'am support.");
      input.value = "";
      return;
    }
    setUploadingLogo(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", preset);
      form.append("folder", "thoam-logos");
      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: form,
      });
      const result = await response.json();
      if (!response.ok || !result.secure_url) {
        throw new Error(result.error?.message || "Logo upload failed.");
      }
      setLogoUrl(result.secure_url);
      setLogoPreview(result.secure_url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Logo upload failed.");
    } finally {
      setUploadingLogo(false);
      input.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (saving) return;

    const cleanOwnerName = ownerName.trim();
    const cleanRestaurantName = restaurantName.trim();
    const cleanSlug = slug.trim().toLowerCase();
    const cleanWhatsappNumber = whatsappNumber
      .trim()
      .replace(/[\s()+-]/g, "");

    if (
      !cleanOwnerName ||
      !cleanRestaurantName ||
      !cleanSlug ||
      !cleanWhatsappNumber
    ) {
      setError("Please fill in all required fields.");
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
      setError(
        "Menu link must contain lowercase letters, numbers, and single hyphens only."
      );
      return;
    }

    if (!/^\d{10,15}$/.test(cleanWhatsappNumber)) {
      setError(
        "Enter a valid WhatsApp number with country code, e.g. 919876543210."
      );
      return;
    }

    if (!supabase) {
      setError("Supabase is not configured. Please contact support.");
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(
          "Unable to verify your login session. Please log in again."
        );
      }

      if (!session?.access_token) {
        throw new Error(
          "Your login session has expired. Please log in again."
        );
      }

      const response = await fetch("/api/owner/register-restaurant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ownerName: cleanOwnerName,
          restaurantName: cleanRestaurantName,
          slug: cleanSlug,
          whatsappNumber: cleanWhatsappNumber,
          logoUrl,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.error ||
            `Restaurant registration failed (${response.status}).`
        );
      }

      onComplete();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  const completedFields = [
    ownerName.trim().length > 0,
    restaurantName.trim().length > 0,
    slug.trim().length > 0,
    whatsappNumber.trim().length > 0,
    Boolean(logoUrl),
  ].filter(Boolean).length;

  const progress = (completedFields / 5) * 100;

  return (
    <div className="setup-overlay">
      <div
        className="setup-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setup-heading"
      >
        <div className="setup-main">
          <div className="setup-topbar">
            <a href="/" className="setup-brand" aria-label="Tho'am home">
              <span className="brand-mark">
                <UtensilsCrossed size={19} strokeWidth={2.1} />
              </span>

              <span className="brand-word">
                THO&apos;AM<span className="brand-dot">.</span>
              </span>
            </a>

            <span className="partner-badge">
              <span className="status-dot" />
              PARTNER SETUP
            </span>
          </div>

          <div className="setup-heading-block">
            <div className="heading-icon">
              <Store size={25} strokeWidth={1.7} />
              <span className="heading-sparkle">
                <Sparkles size={12} />
              </span>
            </div>

            <p className="eyebrow">YOUR RESTAURANT, ONLINE</p>

            <h1 id="setup-heading">
              Let&apos;s get your
              <br />
              <span>restaurant ready.</span>
            </h1>

            <p className="heading-description">
              A few details are all we need to set up your restaurant
              and create your own shareable menu link.
            </p>
          </div>

          <div className="progress-card">
            <div className="progress-top">
              <div>
                <span className="progress-title">Restaurant details</span>
                <span className="progress-subtitle">
                  Complete your profile to get started
                </span>
              </div>

              <span className="progress-count">
                {completedFields}
                <span>/4</span>
              </span>
            </div>

            <div
              className="progress-track"
              role="progressbar"
              aria-label="Form completion"
              aria-valuemin={0}
              aria-valuemax={5}
              aria-valuenow={completedFields}
            >
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="setup-form">
            <div className="section-heading">
              <span className="section-number">01</span>
              <div>
                <h2>Basic information</h2>
                <p>Tell us about you and your restaurant.</p>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="ownerName">
                Owner name <span>*</span>
              </label>

              <div className="input-shell">
                <UserRound className="field-icon" size={18} />

                <input
                  id="ownerName"
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  maxLength={100}
                  required
                />

                {ownerName.trim() && (
                  <Check className="field-check" size={17} />
                )}
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="restaurantName">
                Restaurant name <span>*</span>
              </label>

              <div className="input-shell">
                <Store className="field-icon" size={18} />

                <input
                  id="restaurantName"
                  type="text"
                  value={restaurantName}
                  onChange={(e) => handleRestaurantName(e.target.value)}
                  placeholder="e.g. Miya Miya"
                  autoComplete="organization"
                  maxLength={150}
                  required
                />

                {restaurantName.trim() && (
                  <Check className="field-check" size={17} />
                )}
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="restaurantLogo">Restaurant logo <span>· Optional</span></label>
              <div className="logo-upload-row">
                <div className="logo-preview">
                  {logoPreview ? <img src={logoPreview} alt="Restaurant logo preview" /> : <Store size={23} />}
                </div>
                <div className="logo-upload-control">
                  <input id="restaurantLogo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleLogoUpload} disabled={uploadingLogo} />
                  <span>{uploadingLogo ? "Uploading logo..." : logoUrl ? "Logo uploaded" : "JPG, PNG or WebP · Up to 5 MB"}</span>
                  {logoUrl && <button type="button" onClick={() => { setLogoUrl(""); setLogoPreview(""); }}>Remove logo</button>}
                </div>
              </div>
            </div>

            <div className="section-heading section-heading-spaced">
              <span className="section-number">02</span>
              <div>
                <h2>Your public menu</h2>
                <p>Customers can open this link to view your menu.</p>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="slug">
                Menu link name <span>*</span>
              </label>

              <div className="slug-shell">
                <span className="slug-prefix">
                  <Link2 size={15} />
                  <span>/menu/</span>
                </span>

                <input
                  id="slug"
                  value={slug}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="miya-miya"
                  maxLength={100}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  title="Use lowercase letters, numbers, and single hyphens."
                  autoCapitalize="none"
                  autoCorrect="off"
                  required
                />

                {slug.trim() && (
                  <Check className="field-check slug-check" size={17} />
                )}
              </div>

              <div className="field-hint">
                <span>Lowercase letters, numbers and hyphens.</span>
                <span className="hint-auto">EDITABLE</span>
              </div>

              <div className="link-preview">
                <div className="preview-icon">
                  <ExternalLink size={16} />
                </div>

                <div className="preview-content">
                  <span className="preview-label">YOUR MENU LINK</span>
                  <span className="preview-url">
                    /menu/{slug || "your-restaurant"}
                  </span>
                </div>

                <span className="preview-status">PREVIEW</span>
              </div>
            </div>

            <div className="section-heading section-heading-spaced">
              <span className="section-number">03</span>
              <div>
                <h2>WhatsApp ordering</h2>
                <p>Receive customer orders directly on WhatsApp.</p>
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="whatsappNumber">
                WhatsApp number <span>*</span>
              </label>

              <div className="input-shell">
                <MessageCircle className="field-icon" size={18} />

                <input
                  id="whatsappNumber"
                  type="tel"
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="919876543210"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={20}
                  required
                />

                {whatsappNumber.trim() && (
                  <Check className="field-check" size={17} />
                )}
              </div>

              <p className="field-description">
                Include your country code. India&apos;s country code is +91.
              </p>
            </div>

            {error && (
              <div
                role="alert"
                aria-live="polite"
                className="error-box"
              >
                <span className="error-symbol">
                  <X size={15} />
                </span>

                <p>{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="submit-button"
            >
              {saving ? (
                <>
                  <LoaderCircle className="loading-icon" size={19} />
                  <span>Setting up your restaurant...</span>
                </>
              ) : (
                <>
                  <span>Save details &amp; open dashboard</span>
                  <ArrowRight size={19} />
                </>
              )}
            </button>

            <div className="security-note">
              <ShieldCheck size={16} />

              <span>
                Your information is handled securely. You can update
                your restaurant details later.
              </span>
            </div>
          </form>
        </div>

        <aside className="setup-aside">
          <div className="aside-pattern" />

          <div className="aside-content">
            <div className="aside-top">
              <span className="aside-kicker">WELCOME TO THO&apos;AM</span>

              <span className="aside-icon">
                <UtensilsCrossed size={21} />
              </span>
            </div>

            <div className="aside-message">
              <span className="aside-overline">YOUR NEXT CHAPTER</span>

              <h2>
                Good food.
                <br />
                <span>Better connections.</span>
              </h2>

              <p>
                Give your customers a simple way to discover your menu
                and place orders directly through WhatsApp.
              </p>
            </div>

            <div className="preview-card">
              <div className="preview-card-top">
                <div className="preview-restaurant-icon">
                  <Store size={21} />
                </div>

                <div className="preview-restaurant-info">
                  <span className="restaurant-preview-name">
                    {restaurantName.trim() || "Your Restaurant"}
                  </span>
                  <span className="restaurant-preview-caption">
                    Your online menu
                  </span>
                </div>

                <span className="live-indicator">
                  <span />
                  PREVIEW
                </span>
              </div>

              <div className="preview-divider" />

              <div className="menu-preview-row">
                <div className="menu-line menu-line-long" />
                <div className="menu-line menu-line-short" />
              </div>

              <div className="menu-preview-row">
                <div className="menu-line menu-line-medium" />
                <div className="menu-line menu-line-shorter" />
              </div>

              <div className="preview-menu-button">
                <MessageCircle size={16} />
                <span>Order on WhatsApp</span>
                <ArrowRight size={15} />
              </div>

              <div className="preview-card-footer">
                <Link2 size={13} />
                <span>/menu/{slug || "your-restaurant"}</span>
              </div>
            </div>

            <div className="benefit-list">
              <div className="benefit-item">
                <span className="benefit-check">
                  <Check size={13} />
                </span>
                <span>A dedicated shareable menu link</span>
              </div>

              <div className="benefit-item">
                <span className="benefit-check">
                  <Check size={13} />
                </span>
                <span>WhatsApp-based customer ordering</span>
              </div>

              <div className="benefit-item">
                <span className="benefit-check">
                  <Check size={13} />
                </span>
                <span>Your own restaurant dashboard</span>
              </div>
            </div>
          </div>

          <div className="aside-footer">
            <span>THO&apos;AM PARTNER EXPERIENCE</span>
            <span>01 — 03</span>
          </div>
        </aside>
      </div>

      <style jsx>{`
        .setup-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow-y: auto;
          padding: 28px;
          background: rgba(10, 10, 10, 0.76);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .setup-modal {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1.12fr) minmax(280px, 0.88fr);
          width: 100%;
          max-width: 1060px;
          max-height: min(900px, calc(100dvh - 56px));
          min-height: 0;
          overflow: auto;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 26px;
          background: #fff;
          color: #111;
          box-shadow: 0 40px 120px rgba(0, 0, 0, 0.38);
          scrollbar-width: thin;
          scrollbar-color: #d4d4d4 transparent;
        }

        .setup-main {
          min-width: 0;
          padding: 30px 42px 32px;
        }

        .setup-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 32px;
        }

        .setup-brand {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: #111;
          text-decoration: none;
        }

        .brand-mark {
          display: grid;
          width: 38px;
          height: 38px;
          place-items: center;
          border-radius: 12px;
          background: #111;
          color: #fff;
        }

        .brand-word {
          font-size: 19px;
          font-weight: 900;
          letter-spacing: -0.9px;
        }

        .brand-dot {
          color: #737373;
        }

        .partner-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 10px;
          border: 1px solid #e5e5e5;
          border-radius: 999px;
          background: #fafafa;
          color: #525252;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
          white-space: nowrap;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #171717;
        }

        .setup-heading-block {
          margin-bottom: 23px;
        }

        .heading-icon {
          position: relative;
          display: grid;
          width: 48px;
          height: 48px;
          margin-bottom: 17px;
          place-items: center;
          border: 1px solid #e5e5e5;
          border-radius: 15px;
          background: #f7f7f7;
          color: #171717;
        }

        .heading-sparkle {
          position: absolute;
          top: -6px;
          right: -6px;
          display: grid;
          width: 21px;
          height: 21px;
          place-items: center;
          border: 2px solid white;
          border-radius: 50%;
          background: #111;
          color: white;
        }

        .eyebrow {
          margin: 0 0 9px;
          color: #737373;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1.8px;
        }

        .setup-heading-block h1 {
          margin: 0;
          font-size: clamp(29px, 3vw, 37px);
          font-weight: 850;
          line-height: 1.12;
          letter-spacing: -1.8px;
        }

        .setup-heading-block h1 span {
          color: #737373;
        }

        .heading-description {
          max-width: 390px;
          margin: 13px 0 0;
          color: #737373;
          font-size: 13px;
          line-height: 1.8;
        }

        .progress-card {
          margin-bottom: 29px;
          padding: 16px 17px;
          border: 1px solid #e8e8e8;
          border-radius: 15px;
          background: #fafafa;
        }

        .progress-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 12px;
        }

        .progress-title,
        .progress-subtitle {
          display: block;
        }

        .progress-title {
          font-size: 12px;
          font-weight: 800;
        }

        .progress-subtitle {
          margin-top: 4px;
          color: #737373;
          font-size: 11px;
        }

        .progress-count {
          font-size: 19px;
          font-weight: 850;
          letter-spacing: -0.6px;
        }

        .progress-count span {
          color: #a3a3a3;
          font-size: 12px;
          font-weight: 600;
        }

        .progress-track {
          height: 4px;
          overflow: hidden;
          border-radius: 999px;
          background: #e5e5e5;
        }

        .progress-fill {
          height: 100%;
          border-radius: inherit;
          background: #171717;
          transition: width 220ms ease;
        }

        .setup-form {
          display: flex;
          flex-direction: column;
          gap: 17px;
        }

        .section-heading {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 1px;
        }

        .section-heading-spaced {
          margin-top: 9px;
        }

        .section-number {
          display: grid;
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid #e5e5e5;
          border-radius: 10px;
          background: #fafafa;
          color: #737373;
          font-size: 10px;
          font-weight: 850;
        }

        .section-heading h2 {
          margin: 1px 0 0;
          font-size: 13px;
          font-weight: 850;
          letter-spacing: -0.2px;
        }

        .section-heading p {
          margin: 4px 0 0;
          color: #737373;
          font-size: 11px;
          line-height: 1.6;
        }

        .logo-upload-row { display: flex; align-items: center; gap: 14px; padding: 12px; border: 1px dashed #d4d4d4; border-radius: 12px; background: #fafafa; }
        .logo-preview { display: grid; width: 64px; height: 64px; flex-shrink: 0; place-items: center; overflow: hidden; border: 1px solid #e5e5e5; border-radius: 12px; background: white; color: #737373; }
        .logo-preview img { width: 100%; height: 100%; object-fit: contain; }
        .logo-upload-control { display: grid; min-width: 0; gap: 7px; color: #737373; font-size: 10px; }
        .logo-upload-control input { max-width: 100%; color: #262626; font-size: 11px; }
        .logo-upload-control button { width: fit-content; border: 0; background: transparent; color: #525252; font-size: 10px; font-weight: 750; text-decoration: underline; cursor: pointer; }
        .field-group {
          min-width: 0;
        }

        .field-group label {
          display: block;
          margin-bottom: 8px;
          color: #262626;
          font-size: 12px;
          font-weight: 750;
        }

        .field-group label span {
          color: #737373;
        }

        .input-shell,
        .slug-shell {
          display: flex;
          min-width: 0;
          min-height: 49px;
          align-items: center;
          gap: 11px;
          padding: 0 13px;
          border: 1px solid #e5e5e5;
          border-radius: 12px;
          background: #fff;
          transition:
            border-color 160ms ease,
            box-shadow 160ms ease,
            background 160ms ease;
        }

        .input-shell:focus-within,
        .slug-shell:focus-within {
          border-color: #171717;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(0, 0, 0, 0.055);
        }

        .field-icon {
          flex-shrink: 0;
          color: #737373;
          transition: color 160ms ease;
        }

        .input-shell:focus-within .field-icon {
          color: #171717;
        }

        .input-shell input,
        .slug-shell input {
          width: 100%;
          min-width: 0;
          height: 47px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #171717;
          font-family: inherit;
          font-size: 13px;
          font-weight: 550;
        }

        .input-shell input::placeholder,
        .slug-shell input::placeholder {
          color: #a3a3a3;
          font-weight: 400;
        }

        .field-check {
          flex-shrink: 0;
          color: #525252;
        }

        .slug-shell {
          gap: 10px;
          padding-left: 0;
        }

        .slug-prefix {
          display: inline-flex;
          height: 47px;
          flex-shrink: 0;
          align-items: center;
          gap: 7px;
          padding: 0 12px;
          border-right: 1px solid #e5e5e5;
          border-radius: 11px 0 0 11px;
          background: #fafafa;
          color: #737373;
          font-size: 12px;
          font-weight: 650;
        }

        .slug-shell input {
          flex: 1;
        }

        .slug-check {
          margin-right: 12px;
        }

        .field-hint {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 7px;
          margin-top: 8px;
          color: #737373;
          font-size: 10px;
        }

        .hint-auto {
          color: #737373;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .link-preview {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 11px;
          margin-top: 13px;
          padding: 12px;
          border: 1px dashed #d4d4d4;
          border-radius: 12px;
          background: #fafafa;
        }

        .preview-icon {
          display: grid;
          width: 35px;
          height: 35px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid #e5e5e5;
          border-radius: 10px;
          background: #fff;
          color: #404040;
        }

        .preview-content {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 4px;
        }

        .preview-label {
          color: #737373;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.1px;
        }

        .preview-url {
          overflow: hidden;
          color: #171717;
          font-size: 12px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .preview-status {
          flex-shrink: 0;
          padding: 5px 7px;
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          background: white;
          color: #737373;
          font-size: 8px;
          font-weight: 850;
          letter-spacing: 0.6px;
        }

        .field-description {
          margin: 8px 0 0;
          color: #737373;
          font-size: 10px;
          line-height: 1.6;
        }

        .error-box {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          border: 1px solid #fecaca;
          border-radius: 12px;
          background: #fef2f2;
          color: #991b1b;
        }

        .error-symbol {
          display: grid;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 50%;
          background: #fee2e2;
        }

        .error-box p {
          margin: 1px 0 0;
          font-size: 12px;
          line-height: 1.6;
          overflow-wrap: anywhere;
        }

        .submit-button {
          display: flex;
          width: 100%;
          min-height: 52px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 4px;
          padding: 0 17px;
          border: 1px solid #171717;
          border-radius: 12px;
          background: #171717;
          color: #fff;
          cursor: pointer;
          font-family: inherit;
          font-size: 12px;
          font-weight: 800;
          transition:
            background 160ms ease,
            transform 160ms ease,
            box-shadow 160ms ease;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #303030;
          box-shadow: 0 7px 18px rgba(0, 0, 0, 0.12);
        }

        .submit-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-button:focus-visible {
          outline: 3px solid #a3a3a3;
          outline-offset: 3px;
        }

        .submit-button:disabled {
          cursor: not-allowed;
          opacity: 0.7;
        }

        .loading-icon {
          flex-shrink: 0;
          animation: spin 900ms linear infinite;
        }

        .security-note {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 8px;
          color: #737373;
          font-size: 10px;
          line-height: 1.7;
          text-align: center;
        }

        .security-note svg {
          flex-shrink: 0;
          margin-top: 1px;
        }

        .setup-aside {
          position: relative;
          display: flex;
          min-width: 0;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
          padding: 35px 30px 24px;
          background: #111;
          color: #fff;
        }

        .aside-pattern {
          position: absolute;
          top: -120px;
          right: -150px;
          width: 360px;
          height: 360px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 50%;
          pointer-events: none;
        }

        .aside-pattern::before,
        .aside-pattern::after {
          position: absolute;
          content: "";
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 50%;
        }

        .aside-pattern::before {
          inset: 28px;
        }

        .aside-pattern::after {
          inset: 58px;
        }

        .aside-content {
          position: relative;
          z-index: 1;
        }

        .aside-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .aside-kicker {
          color: #a3a3a3;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 1.7px;
        }

        .aside-icon {
          display: grid;
          width: 39px;
          height: 39px;
          place-items: center;
          border: 1px solid #3f3f46;
          border-radius: 12px;
          background: #262626;
          color: white;
        }

        .aside-message {
          margin-top: 53px;
        }

        .aside-overline {
          color: #a3a3a3;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 1.8px;
        }

        .aside-message h2 {
          margin: 13px 0 13px;
          font-size: clamp(25px, 2.8vw, 34px);
          font-weight: 850;
          line-height: 1.18;
          letter-spacing: -1.4px;
        }

        .aside-message h2 span {
          color: #a3a3a3;
        }

        .aside-message p {
          max-width: 310px;
          margin: 0;
          color: #a3a3a3;
          font-size: 12px;
          line-height: 1.9;
        }

        .preview-card {
          margin-top: 33px;
          padding: 17px;
          border: 1px solid #404040;
          border-radius: 16px;
          background: #1c1c1c;
          box-shadow: 0 18px 35px rgba(0, 0, 0, 0.16);
        }

        .preview-card-top {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 10px;
        }

        .preview-restaurant-icon {
          display: grid;
          width: 42px;
          height: 42px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid #404040;
          border-radius: 12px;
          background: #292929;
          color: white;
        }

        .preview-restaurant-info {
          display: flex;
          min-width: 0;
          flex: 1;
          flex-direction: column;
          gap: 5px;
        }

        .restaurant-preview-name {
          overflow: hidden;
          color: white;
          font-size: 12px;
          font-weight: 800;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .restaurant-preview-caption {
          color: #a3a3a3;
          font-size: 10px;
        }

        .live-indicator {
          display: inline-flex;
          flex-shrink: 0;
          align-items: center;
          gap: 5px;
          color: #d4d4d4;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.7px;
        }

        .live-indicator span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #a3a3a3;
        }

        .preview-divider {
          height: 1px;
          margin: 16px 0;
          background: #383838;
        }

        .menu-preview-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 13px;
        }

        .menu-line {
          height: 7px;
          border-radius: 999px;
          background: #404040;
        }

        .menu-line-long {
          width: 47%;
        }

        .menu-line-short {
          width: 19%;
        }

        .menu-line-medium {
          width: 34%;
        }

        .menu-line-shorter {
          width: 25%;
        }

        .preview-menu-button {
          display: flex;
          min-height: 42px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: 19px;
          padding: 0 12px;
          border: 1px solid #525252;
          border-radius: 10px;
          background: #fff;
          color: #171717;
          font-size: 11px;
          font-weight: 800;
        }

        .preview-menu-button span {
          flex: 1;
        }

        .preview-card-footer {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 14px;
          color: #a3a3a3;
          font-size: 10px;
          overflow-wrap: anywhere;
        }

        .preview-card-footer svg {
          flex-shrink: 0;
        }

        .benefit-list {
          display: flex;
          flex-direction: column;
          gap: 15px;
          margin-top: 28px;
        }

        .benefit-item {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #d4d4d4;
          font-size: 11px;
          line-height: 1.5;
        }

        .benefit-check {
          display: grid;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          place-items: center;
          border: 1px solid #525252;
          border-radius: 50%;
          background: #292929;
          color: #fff;
        }

        .aside-footer {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 35px;
          padding-top: 17px;
          border-top: 1px solid #383838;
          color: #737373;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 1.1px;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (min-width: 1100px) {
          .setup-modal {
            overflow: hidden;
          }

          .setup-main {
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: #d4d4d4 transparent;
          }

          .setup-aside {
            overflow-y: auto;
          }
        }

        @media (max-width: 850px) {
          .setup-overlay {
            padding: 18px;
          }

          .setup-modal {
            grid-template-columns: minmax(0, 1fr);
            max-width: 570px;
            max-height: calc(100dvh - 36px);
            border-radius: 22px;
          }

          .setup-main {
            padding: 27px 30px 30px;
          }

          .setup-aside {
            display: none;
          }

          .setup-topbar {
            margin-bottom: 27px;
          }
        }

        @media (max-width: 480px) {
          .setup-overlay {
            align-items: flex-start;
            padding: 10px;
          }

          .setup-modal {
            max-height: calc(100dvh - 20px);
            border-radius: 18px;
          }

          .setup-main {
            padding: 22px 18px 25px;
          }

          .setup-topbar {
            margin-bottom: 26px;
          }

          .brand-mark {
            width: 34px;
            height: 34px;
          }

          .brand-word {
            font-size: 17px;
          }

          .partner-badge {
            padding: 7px 8px;
            font-size: 8px;
            letter-spacing: 0.6px;
          }

          .setup-heading-block h1 {
            font-size: 31px;
            letter-spacing: -1.4px;
          }

          .heading-description {
            font-size: 12px;
          }

          .progress-card {
            padding: 14px;
          }

          .progress-subtitle {
            max-width: 210px;
            line-height: 1.5;
          }

          .section-heading p {
            font-size: 10px;
          }

          .input-shell,
          .slug-shell {
            min-height: 47px;
            gap: 9px;
            padding-right: 10px;
          }

          .input-shell input,
          .slug-shell input {
            font-size: 13px;
          }

          .slug-prefix {
            gap: 5px;
            padding: 0 9px;
            font-size: 11px;
          }

          .slug-check {
            margin-right: 0;
          }

          .preview-status {
            display: none;
          }

          .submit-button {
            min-height: 50px;
            padding: 0 13px;
            font-size: 11px;
          }

          .security-note {
            font-size: 9px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .loading-icon {
            animation-duration: 2.5s;
          }

          .progress-fill,
          .input-shell,
          .slug-shell,
          .submit-button {
            transition: none;
          }
        }
          /* Scroll fix — preserve existing design */

/* Overlay */
.setup-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 20px;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-y: contain;
}

/* Modal */
.setup-modal {
  width: 100%;
  max-height: calc(100dvh - 40px);
  min-height: 0;
  flex-shrink: 0;
  margin: auto;
  overflow: hidden;
}

/* Desktop: scroll each panel independently */
@media (min-width: 851px) {
  .setup-overlay {
    align-items: center;
  }

  .setup-modal {
    max-height: calc(100dvh - 40px);
    overflow: hidden;
  }

  .setup-main,
  .setup-aside {
    min-height: 0;
    max-height: calc(100dvh - 40px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior-y: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #d4d4d4 transparent;
  }
}

/* Mobile and tablet: scroll the whole modal */
@media (max-width: 850px) {
  .setup-overlay {
    display: block;
    padding: 10px;
  }

  .setup-modal {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    width: 100%;
    max-width: 570px;
    max-height: none;
    height: auto;
    margin: 0 auto;
    overflow: visible;
    border-radius: 22px;
  }

  .setup-main {
    min-height: auto;
    max-height: none;
    overflow: visible;
    padding: 27px 30px 30px;
  }

  .setup-aside {
    display: none;
  }

  .setup-topbar {
    margin-bottom: 27px;
  }
}

/* Small mobile screens */
@media (max-width: 480px) {
  .setup-overlay {
    padding: 8px;
  }

  .setup-modal {
    max-height: none;
    border-radius: 18px;
  }

  .setup-main {
    padding: 22px 18px 25px;
  }

  .setup-topbar {
    margin-bottom: 26px;
  }

  .brand-mark {
    width: 34px;
    height: 34px;
  }

  .brand-word {
    font-size: 17px;
  }

  .partner-badge {
    padding: 7px 8px;
    font-size: 8px;
    letter-spacing: 0.6px;
  }

  .setup-heading-block h1 {
    font-size: 31px;
    letter-spacing: -1.4px;
  }

  .heading-description {
    font-size: 12px;
  }

  .progress-card {
    padding: 14px;
  }

  .progress-subtitle {
    max-width: 210px;
    line-height: 1.5;
  }

  .section-heading p {
    font-size: 10px;
  }

  .input-shell,
  .slug-shell {
    min-height: 47px;
    gap: 9px;
    padding-right: 10px;
  }

  .input-shell input,
  .slug-shell input {
    font-size: 13px;
  }

  .slug-prefix {
    gap: 5px;
    padding: 0 9px;
    font-size: 11px;
  }

  .slug-check {
    margin-right: 0;
  }

  .preview-status {
    display: none;
  }

  .submit-button {
    min-height: 50px;
    padding: 0 13px;
    font-size: 11px;
  }

  .security-note {
    font-size: 9px;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .loading-icon {
    animation-duration: 2.5s;
  }

  .progress-fill,
  .input-shell,
  .slug-shell,
  .submit-button {
    transition: none;
  }
}
      `}</style>
    </div>
  );
}