"use client";

import { useState, type FormEvent } from "react";

export interface CustomerOrderForm {
  customerName: string;
  customerPhone: string;
  orderType: "DELIVERY" | "TAKEAWAY";
  address: string;
  notes: string;
}

interface Props {
  loading: boolean;
  onSubmit: (data: CustomerOrderForm) => Promise<void>;
  onCancel: () => void;
}

export default function WhatsAppOrderForm({ loading, onSubmit, onCancel }: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<"DELIVERY" | "TAKEAWAY">("DELIVERY");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [validationError, setValidationError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError("");
    const cleanPhone = customerPhone.replace(/\D/g, "");

    if (customerName.trim().length < 2) {
      setValidationError("Please enter your name.");
      return;
    }
    if (cleanPhone.length < 10 || cleanPhone.length > 15) {
      setValidationError("Please enter a valid phone number.");
      return;
    }
    if (orderType === "DELIVERY" && address.trim().length < 5) {
      setValidationError("Please enter your delivery address.");
      return;
    }

    await onSubmit({
      customerName: customerName.trim(),
      customerPhone: cleanPhone,
      orderType,
      address: orderType === "DELIVERY" ? address.trim() : "",
      notes: notes.trim(),
    });
  }

  return (
    <form className="customer-form" onSubmit={handleSubmit}>
      <div className="form-heading">
        <span className="form-eyebrow">ORDER DETAILS</span>
        <h2>Almost there. <span>Let’s get your order ready.</span></h2>
        <p>Just a few details so the restaurant can confirm your order.</p>
      </div>

      {validationError && <p className="validation-error" role="alert">{validationError}</p>}

      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="customerName">Full name</label>
          <input id="customerName" type="text" autoComplete="name" required minLength={2} maxLength={100}
            value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Your name" />
        </div>
        <div className="form-field">
          <label htmlFor="customerPhone">Phone number</label>
          <input id="customerPhone" type="tel" autoComplete="tel" inputMode="tel" required maxLength={20}
            value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Your contact number" />
        </div>
      </div>

      <fieldset className="order-type-field">
        <legend>How would you like to receive your order?</legend>
        <div className="order-type-options">
          <button type="button" className={`order-type-option ${orderType === "DELIVERY" ? "selected" : ""}`}
            aria-pressed={orderType === "DELIVERY"} onClick={() => setOrderType("DELIVERY")}>
            <span className="option-icon" aria-hidden="true">⌂</span>
            <span className="option-copy"><strong>Delivery</strong><small>Bring it to me</small></span>
            <span className="radio-mark" aria-hidden="true" />
          </button>
          <button type="button" className={`order-type-option ${orderType === "TAKEAWAY" ? "selected" : ""}`}
            aria-pressed={orderType === "TAKEAWAY"} onClick={() => setOrderType("TAKEAWAY")}>
            <span className="option-icon" aria-hidden="true">▣</span>
            <span className="option-copy"><strong>Takeaway</strong><small>I’ll collect it</small></span>
            <span className="radio-mark" aria-hidden="true" />
          </button>
        </div>
      </fieldset>

      {orderType === "DELIVERY" && (
        <div className="form-field address-field">
          <label htmlFor="address">Delivery address</label>
          <textarea id="address" autoComplete="street-address" required minLength={5} maxLength={1000}
            value={address} onChange={(event) => setAddress(event.target.value)}
            placeholder="House name, street, locality and landmark" rows={2} />
        </div>
      )}

      <div className="form-field notes-field">
        <label htmlFor="notes">Special instructions <span>Optional</span></label>
        <textarea id="notes" maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)}
          placeholder="Any preferences? (e.g. less spicy)" rows={2} />
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="submit-button">
          <span>{loading ? "Preparing your order..." : "Continue to WhatsApp"}</span>
          {!loading && <span className="submit-arrow" aria-hidden="true">→</span>}
        </button>
        <button type="button" onClick={onCancel} disabled={loading} className="cancel-button">Back to menu</button>
      </div>

      <div className="whatsapp-notice">
        <span aria-hidden="true">✓</span>
        <p>Your order is saved first. WhatsApp opens with your order message ready. Tap <strong>Send</strong> there to confirm.</p>
      </div>

      <style jsx>{`
        .customer-form{padding:22px;border:1px solid #e5e9e5;border-radius:20px;background:#fff;box-shadow:0 12px 32px rgb(20 40 25 / 5%);color:#17231c;font-family:Arial,Helvetica,sans-serif}
        .form-heading{margin-bottom:18px}
        .form-eyebrow{color:#16834b;font-size:9px;font-weight:900;letter-spacing:.18em}
        .form-heading h2{margin-top:7px;font-size:20px;font-weight:850;letter-spacing:-.7px;line-height:1.25}
        .form-heading h2 span{color:#65736a}
        .form-heading p{margin-top:6px;color:#78847c;font-size:11px;line-height:1.55}
        .form-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .form-field{display:grid;gap:6px;margin-top:13px;min-width:0}
        .form-field label,.order-type-field legend{color:#34443a;font-size:11px;font-weight:800}
        .form-field label span{margin-left:5px;color:#929d95;font-size:9px;font-weight:600}
        .form-field input,.form-field textarea{width:100%;min-height:43px;padding:10px 12px;border:1px solid #dfe7e1;border-radius:10px;outline:none;background:#f9fbf9;color:#1e2b22;font:inherit;font-size:12px;line-height:1.45;transition:border-color .18s,box-shadow .18s,background .18s}
        .form-field textarea{min-height:58px;resize:vertical}
        .form-field input::placeholder,.form-field textarea::placeholder{color:#a0aaa3}
        .form-field input:focus,.form-field textarea:focus{border-color:#2b9b60;background:#fff;box-shadow:0 0 0 3px rgb(43 155 96 / 11%)}
        .order-type-field{min-width:0;margin-top:17px;padding:0;border:0}
        .order-type-field legend{margin-bottom:9px}
        .order-type-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
        .order-type-option{display:flex;min-width:0;min-height:58px;align-items:center;gap:9px;padding:9px 10px;border:1px solid #e1e8e2;border-radius:12px;background:#fff;text-align:left;transition:.18s}
        .order-type-option:hover{border-color:#9ac9aa;background:#fbfefb}
        .order-type-option.selected{border-color:#29965a;background:#eff9f2;box-shadow:inset 0 0 0 1px #29965a}
        .option-icon{display:grid;width:31px;height:31px;flex-shrink:0;place-items:center;border-radius:9px;background:#eaf4ed;color:#277b4b;font-size:19px;font-weight:800}
        .option-copy{display:grid;min-width:0;flex:1;gap:3px}
        .option-copy strong{color:#26372c;font-size:11px;font-weight:850}
        .option-copy small{color:#78877d;font-size:9px}
        .radio-mark{position:relative;width:15px;height:15px;flex-shrink:0;border:1px solid #cbd7ce;border-radius:50%;background:#fff}
        .selected .radio-mark{border-color:#16834b}
        .selected .radio-mark:after{position:absolute;inset:3px;border-radius:50%;background:#16834b;content:""}
        .form-actions{display:grid;grid-template-columns:1fr auto;gap:9px;margin-top:18px}
        .submit-button{display:flex;min-height:48px;align-items:center;justify-content:space-between;gap:10px;padding:0 15px;border:1px solid #16834b;border-radius:11px;background:#16834b;color:#fff;font-size:12px;font-weight:850;box-shadow:0 6px 14px rgb(22 131 75 / 18%);transition:background .18s,transform .18s,box-shadow .18s}
        .submit-button:hover:not(:disabled){transform:translateY(-1px);background:#116b3d;box-shadow:0 8px 18px rgb(22 131 75 / 22%)}
        .submit-button:disabled{cursor:wait;opacity:.65}
        .submit-arrow{font-size:19px;font-weight:400}
        .cancel-button{min-height:48px;padding:0 13px;border:1px solid #e2e7e3;border-radius:11px;background:#f7f9f7;color:#5d6b61;font-size:11px;font-weight:750;transition:.18s}
        .cancel-button:hover:not(:disabled){border-color:#c6d4ca;background:#edf3ee;color:#314b39}
        .cancel-button:disabled{cursor:wait;opacity:.5}
        .validation-error{margin-bottom:10px;padding:10px 12px;border:1px solid #f1d2ce;border-radius:10px;background:#fff5f3;color:#a52e25;font-size:11px}
        .whatsapp-notice{display:flex;align-items:flex-start;gap:9px;margin-top:14px;padding-top:12px;border-top:1px solid #edf0ed}
        .whatsapp-notice>span{display:grid;width:18px;height:18px;flex-shrink:0;place-items:center;border-radius:50%;background:#e7f5eb;color:#16834b;font-size:10px;font-weight:900}
        .whatsapp-notice p{color:#7c8980;font-size:10px;line-height:1.6}
        .whatsapp-notice strong{color:#53645a}
        @media(max-width:520px){.customer-form{padding:17px;border-radius:16px}.form-grid{grid-template-columns:1fr;gap:0}.form-field{margin-top:11px}.form-heading h2{font-size:18px}.order-type-option{gap:6px;padding:8px}.option-icon{width:28px;height:28px}.form-actions{grid-template-columns:1fr}.cancel-button{min-height:42px}}
        @media(prefers-reduced-motion:reduce){.customer-form *{transition:none!important}}
      `}</style>
    </form>
  );
}
