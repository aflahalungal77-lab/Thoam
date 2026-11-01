
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

export default function WhatsAppOrderForm({
  loading,
  onSubmit,
  onCancel,
}: Props) {
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<
    "DELIVERY" | "TAKEAWAY"
  >("DELIVERY");
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
        <p className="form-eyebrow">YOUR DETAILS</p>
        <h2>Where should we send your order?</h2>
        <p>Enter your details so the restaurant can confirm your order.</p>
      </div>

      {validationError && (
        <p className="validation-error" role="alert">
          <span aria-hidden="true">!</span>
          {validationError}
        </p>
      )}

      <div className="form-field">
        <label htmlFor="customerName">Full name</label>
        <input
          id="customerName"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          maxLength={100}
          value={customerName}
          onChange={(event) => setCustomerName(event.target.value)}
          placeholder="Enter your full name"
        />
      </div>

      <div className="form-field">
        <label htmlFor="customerPhone">Phone number</label>
        <input
          id="customerPhone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          required
          maxLength={20}
          value={customerPhone}
          onChange={(event) => setCustomerPhone(event.target.value)}
          placeholder="Your contact number"
        />
        <p className="field-hint">
          The restaurant can use this number to contact you about your order.
        </p>
      </div>

      <fieldset className="order-type-field">
        <legend>How would you like your order?</legend>

        <div className="order-type-options">
          <button
            type="button"
            className={`order-type-option ${
              orderType === "DELIVERY" ? "selected" : ""
            }`}
            aria-pressed={orderType === "DELIVERY"}
            onClick={() => setOrderType("DELIVERY")}
          >
            <span className="option-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3 7h11v11H3zM14 11h4l3 4v3h-7z" />
                <circle cx="7.5" cy="19" r="1.8" />
                <circle cx="17.5" cy="19" r="1.8" />
              </svg>
            </span>

            <span className="option-copy">
              <strong>Delivery</strong>
              <span>To my address</span>
            </span>

            <span className="radio-mark" aria-hidden="true" />
          </button>

          <button
            type="button"
            className={`order-type-option ${
              orderType === "TAKEAWAY" ? "selected" : ""
            }`}
            aria-pressed={orderType === "TAKEAWAY"}
            onClick={() => setOrderType("TAKEAWAY")}
          >
            <span className="option-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M4 9h16l-1 12H5L4 9zM8 9V6a4 4 0 0 1 8 0v3" />
              </svg>
            </span>

            <span className="option-copy">
              <strong>Takeaway</strong>
              <span>I'll collect it</span>
            </span>

            <span className="radio-mark" aria-hidden="true" />
          </button>
        </div>
      </fieldset>

      {orderType === "DELIVERY" && (
        <div className="form-field address-field">
          <label htmlFor="address">Delivery address</label>
          <textarea
            id="address"
            autoComplete="street-address"
            required
            minLength={5}
            maxLength={1000}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="House name, street, locality and landmark"
            rows={4}
          />
          <p className="field-hint">
            Include a nearby landmark to help the restaurant identify your
            location.
          </p>
        </div>
      )}

      <div className="form-field">
        <label htmlFor="notes">
          Special instructions <span>(optional)</span>
        </label>
        <textarea
          id="notes"
          maxLength={500}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Any preferences or requests?"
          rows={3}
        />
      </div>

      <div className="form-actions">
        <button
          type="submit"
          disabled={loading}
          className="submit-button"
        >
          <span>{loading ? "Preparing your order..." : "Continue to WhatsApp"}</span>

          {!loading && (
            <span className="submit-arrow" aria-hidden="true">
              →
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="cancel-button"
        >
          Back to menu
        </button>
      </div>

      <div className="whatsapp-notice">
        <span className="notice-icon" aria-hidden="true">
          ✓
        </span>
        <p>
          Your order details will be saved first. WhatsApp will then open with
          your order message ready to send. You must press Send in WhatsApp.
        </p>
      </div>

      <style jsx>{`
        .customer-form {
          padding: 25px;
          border: 1px solid #e8e4db;
          border-radius: 21px;
          background: #fff;
          box-shadow:
            0 3px 8px rgb(30 25 15 / 2%),
            0 12px 30px rgb(30 25 15 / 4%);
          color: #191916;
          font-family: Arial, Helvetica, sans-serif;
        }

        .form-heading {
          margin-bottom: 25px;
        }

        .form-eyebrow {
          color: #898375;
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 0.2em;
        }

        .form-heading h2 {
          margin-top: 9px;
          font-size: 23px;
          font-weight: 850;
          letter-spacing: -0.8px;
          line-height: 1.3;
        }

        .form-heading > p:last-child {
          margin-top: 9px;
          color: #817d73;
          font-size: 12px;
          line-height: 1.75;
        }

        .validation-error {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-bottom: 18px;
          padding: 12px 13px;
          border: 1px solid #f0d2ce;
          border-radius: 12px;
          background: #fff5f3;
          color: #a52e25;
          font-size: 12px;
          line-height: 1.6;
        }

        .validation-error span {
          display: grid;
          width: 18px;
          height: 18px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 50%;
          background: #f5deda;
          font-weight: 850;
        }

        .form-field {
          display: grid;
          gap: 8px;
          margin-top: 19px;
        }

        .form-field label,
        .order-type-field legend {
          color: #38372f;
          font-size: 12px;
          font-weight: 800;
        }

        .form-field label span {
          color: #999387;
          font-weight: 500;
        }

        .form-field input,
        .form-field textarea {
          display: block;
          width: 100%;
          min-height: 48px;
          padding: 13px 14px;
          border: 1px solid #e5e1d8;
          border-radius: 12px;
          outline: none;
          background: #fdfdfb;
          color: #24241f;
          font: inherit;
          font-size: 13px;
          line-height: 1.6;
          transition:
            border-color 180ms ease,
            box-shadow 180ms ease,
            background 180ms ease;
        }

        .form-field input::placeholder,
        .form-field textarea::placeholder {
          color: #aaa59a;
        }

        .form-field input:focus,
        .form-field textarea:focus {
          border-color: #928b7b;
          background: #fff;
          box-shadow: 0 0 0 4px rgb(70 65 50 / 5%);
        }

        .form-field textarea {
          min-height: 85px;
          resize: vertical;
        }

        .field-hint {
          color: #918c80;
          font-size: 10px;
          line-height: 1.7;
        }

        .order-type-field {
          min-width: 0;
          margin-top: 23px;
          padding: 0;
          border: 0;
        }

        .order-type-field legend {
          margin-bottom: 11px;
        }

        .order-type-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .order-type-option {
          display: flex;
          min-width: 0;
          align-items: center;
          gap: 9px;
          padding: 12px 10px;
          border: 1px solid #e6e2d9;
          border-radius: 13px;
          background: #fff;
          text-align: left;
          transition:
            border-color 180ms ease,
            background 180ms ease,
            box-shadow 180ms ease;
        }

        .order-type-option:hover {
          border-color: #c8c1b3;
        }

        .order-type-option.selected {
          border-color: #292923;
          background: #f8f7f3;
          box-shadow: inset 0 0 0 1px #292923;
        }

        .option-icon {
          display: grid;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 10px;
          background: #f1efe9;
          color: #37362f;
        }

        .option-icon svg {
          width: 20px;
          height: 20px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .option-copy {
          display: grid;
          min-width: 0;
          flex: 1;
          gap: 4px;
        }

        .option-copy strong {
          color: #292923;
          font-size: 11px;
          font-weight: 800;
        }

        .option-copy > span {
          color: #89857b;
          font-size: 9px;
          line-height: 1.4;
        }

        .radio-mark {
          position: relative;
          width: 15px;
          height: 15px;
          flex-shrink: 0;
          border: 1px solid #d5d0c5;
          border-radius: 50%;
          background: #fff;
        }

        .order-type-option.selected .radio-mark {
          border-color: #191916;
        }

        .order-type-option.selected .radio-mark::after {
          position: absolute;
          inset: 3px;
          border-radius: 50%;
          background: #191916;
          content: "";
        }

        .form-actions {
          display: grid;
          gap: 10px;
          margin-top: 25px;
        }

        .submit-button {
          display: flex;
          min-height: 51px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 16px;
          border: 1px solid #191916;
          border-radius: 13px;
          background: #191916;
          color: #fff;
          font-size: 12px;
          font-weight: 800;
          box-shadow: 0 5px 12px rgb(25 25 22 / 12%);
          transition:
            background 180ms ease,
            transform 180ms ease,
            box-shadow 180ms ease;
        }

        .submit-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: #383831;
          box-shadow: 0 8px 17px rgb(25 25 22 / 15%);
        }

        .submit-button:disabled {
          cursor: wait;
          opacity: 0.6;
        }

        .submit-arrow {
          font-size: 20px;
          font-weight: 400;
        }

        .cancel-button {
          min-height: 45px;
          border: 1px solid #e6e2d9;
          border-radius: 12px;
          background: #fff;
          color: #625f56;
          font-size: 12px;
          font-weight: 750;
          transition:
            border-color 180ms ease,
            background 180ms ease;
        }

        .cancel-button:hover:not(:disabled) {
          border-color: #c9c3b7;
          background: #f8f7f3;
        }

        .cancel-button:disabled {
          cursor: wait;
          opacity: 0.5;
        }

        .whatsapp-notice {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          margin-top: 21px;
          padding-top: 17px;
          border-top: 1px solid #efede7;
        }

        .notice-icon {
          display: grid;
          width: 20px;
          height: 20px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 50%;
          background: #e9eee5;
          color: #456747;
          font-size: 10px;
          font-weight: 900;
        }

        .whatsapp-notice p {
          color: #89857b;
          font-size: 10px;
          line-height: 1.8;
        }

        @media (max-width: 480px) {
          .customer-form {
            padding: 19px;
            border-radius: 18px;
          }

          .form-heading h2 {
            font-size: 21px;
          }

          .order-type-options {
            gap: 7px;
          }

          .order-type-option {
            gap: 7px;
            padding: 10px 7px;
          }

          .option-icon {
            width: 29px;
            height: 29px;
          }

          .option-copy strong {
            font-size: 10px;
          }

          .option-copy > span {
            font-size: 8px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .customer-form *,
          .customer-form *::before,
          .customer-form *::after {
            transition: none;
          }
        }

/* PREMIUM FORM FINISH */
.customer-form{padding:27px;border-color:#e5e4dc;border-radius:22px;box-shadow:0 12px 34px rgb(0 0 0 / 4%)}
.form-heading h2{letter-spacing:-.9px}
.form-field input,.form-field textarea{border-color:#e4e3dc;border-radius:13px;background:#fafaf8}
.form-field input:hover,.form-field textarea:hover{border-color:#c9c8bf}
.order-type-option{min-height:72px;border-radius:14px}
.order-type-option.selected{background:#f4f4ef}
.submit-button{min-height:54px;border-radius:14px;box-shadow:0 7px 17px rgb(0 0 0 / 13%)}
.cancel-button{border-radius:13px}
.whatsapp-notice{border-top-color:#e9e8e1}
@media(max-width:480px){.customer-form{padding:17px;border-radius:18px}.order-type-option{min-height:66px}}

      `}</style>
    </form>
  );
}
