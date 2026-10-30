
"use client";

import type { MenuProduct } from "./MenuProductCard";

export interface CartItem {
  product: MenuProduct;
  quantity: number;
}

interface Props {
  items: CartItem[];
  onIncrease: (product: MenuProduct) => void;
  onDecrease: (productId: string) => void;
  onCheckout: () => void;
}

export default function MenuCart({
  items,
  onIncrease,
  onDecrease,
  onCheckout,
}: Props) {
  const subtotal = items.reduce(
    (sum, item) =>
      sum + Number(item.product.price) * item.quantity,
    0
  );

  const totalQuantity = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <section className="cart-card">
      <div className="cart-header">
        <div className="cart-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6" />
            <circle cx="10" cy="20" r="1.3" />
            <circle cx="18" cy="20" r="1.3" />
          </svg>
        </div>

        <div className="cart-heading">
          <h2>Your order</h2>
          <p>Good choices so far.</p>
        </div>

        <span className="item-badge">{totalQuantity}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-cart-icon" aria-hidden="true">
            <svg viewBox="0 0 48 48">
              <path d="M8 11h4l4.5 21h20L42 17H15" />
              <circle cx="20" cy="39" r="2.5" />
              <circle cx="34" cy="39" r="2.5" />
              <path d="M23 8v12M17 14h12" />
            </svg>
          </div>

          <h3>Your cart is waiting</h3>
          <p>Add something delicious and it will appear here.</p>

          <span className="empty-cart-hint">
            YOUR NEXT FAVOURITE MEAL AWAITS
          </span>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {items.map(({ product, quantity }) => (
              <div className="cart-item" key={product.id}>
                <div className="item-details">
                  <p className="item-name" title={product.name}>
                    {product.name}
                  </p>

                  <p className="item-price">
                    ₹{Number(product.price).toFixed(2)} each
                  </p>

                  <p className="item-line-total">
                    ₹{(Number(product.price) * quantity).toFixed(2)}
                  </p>
                </div>

                <div className="quantity-control">
                  <button
                    type="button"
                    onClick={() => onDecrease(product.id)}
                    aria-label={`Remove one ${product.name}`}
                  >
                    −
                  </button>

                  <span aria-live="polite">{quantity}</span>

                  <button
                    type="button"
                    onClick={() => onIncrease(product)}
                    aria-label={`Add one ${product.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-total">
            <div className="subtotal-row">
              <span>Subtotal</span>
              <strong>₹{subtotal.toFixed(2)}</strong>
            </div>

            <p className="checkout-note">
              Delivery charges, if applicable, will be confirmed by the
              restaurant.
            </p>

            <button
              type="button"
              onClick={onCheckout}
              className="checkout-button"
            >
              <span>Continue to order</span>
              <span className="checkout-arrow" aria-hidden="true">
                →
              </span>
            </button>

            <p className="secure-note">
              <span aria-hidden="true">✓</span>
              Your order will be prepared for WhatsApp
            </p>
          </div>
        </>
      )}

      <style jsx>{`
        .cart-card {
          overflow: hidden;
          border: 1px solid #e7e3da;
          border-radius: 21px;
          background: #fff;
          box-shadow:
            0 3px 8px rgb(30 25 15 / 2%),
            0 14px 36px rgb(30 25 15 / 5%);
        }

        .cart-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 21px;
          border-bottom: 1px solid #f0eee8;
        }

        .cart-icon {
          display: grid;
          width: 43px;
          height: 43px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 14px;
          background: #191916;
          color: #fff;
        }

        .cart-icon svg {
          width: 22px;
          height: 22px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.6;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .cart-heading {
          flex: 1;
          min-width: 0;
        }

        .cart-heading h2 {
          color: #22221e;
          font-size: 17px;
          font-weight: 850;
          letter-spacing: -0.4px;
        }

        .cart-heading p {
          margin-top: 4px;
          color: #89857b;
          font-size: 11px;
        }

        .item-badge {
          display: grid;
          min-width: 28px;
          height: 28px;
          padding-inline: 7px;
          place-items: center;
          border: 1px solid #e7e3da;
          border-radius: 999px;
          background: #f8f7f3;
          color: #37362f;
          font-size: 11px;
          font-weight: 850;
        }

        .empty-cart {
          display: grid;
          justify-items: center;
          padding: 31px 20px 29px;
          text-align: center;
        }

        .empty-cart-icon {
          display: grid;
          width: 64px;
          height: 64px;
          place-items: center;
          border: 1px solid #e9e5dc;
          border-radius: 21px;
          background: #f8f7f3;
          color: #8b8578;
        }

        .empty-cart-icon svg {
          width: 37px;
          height: 37px;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .empty-cart h3 {
          margin-top: 17px;
          color: #292923;
          font-size: 15px;
          font-weight: 850;
          letter-spacing: -0.25px;
        }

        .empty-cart > p {
          max-width: 220px;
          margin-top: 8px;
          color: #858176;
          font-size: 12px;
          line-height: 1.75;
        }

        .empty-cart-hint {
          margin-top: 19px;
          color: #a09a8d;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.13em;
          line-height: 1.6;
        }

        .cart-items {
          padding: 5px 21px 0;
        }

        .cart-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 17px 0;
          border-bottom: 1px solid #f0eee8;
        }

        .item-details {
          min-width: 0;
          flex: 1;
        }

        .item-name {
          overflow: hidden;
          color: #292923;
          font-size: 12px;
          font-weight: 800;
          line-height: 1.5;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-price {
          margin-top: 4px;
          color: #8b877d;
          font-size: 10px;
        }

        .item-line-total {
          margin-top: 6px;
          color: #292923;
          font-size: 12px;
          font-weight: 800;
        }

        .quantity-control {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px;
          border: 1px solid #e8e4db;
          border-radius: 11px;
          background: #faf9f6;
        }

        .quantity-control button {
          display: grid;
          width: 26px;
          height: 27px;
          flex-shrink: 0;
          place-items: center;
          border-radius: 8px;
          background: #fff;
          color: #24241f;
          font-size: 16px;
          font-weight: 800;
        }

        .quantity-control button:hover {
          background: #eae7df;
        }

        .quantity-control > span {
          min-width: 15px;
          color: #191916;
          font-size: 11px;
          font-weight: 800;
          text-align: center;
        }

        .cart-total {
          padding: 21px;
          background: #fdfcf9;
        }

        .subtotal-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .subtotal-row > span {
          color: #6e6a60;
          font-size: 12px;
          font-weight: 650;
        }

        .subtotal-row strong {
          color: #191916;
          font-size: 21px;
          font-weight: 900;
          letter-spacing: -0.7px;
        }

        .checkout-note {
          margin-top: 10px;
          color: #918c80;
          font-size: 10px;
          line-height: 1.7;
        }

        .checkout-button {
          display: flex;
          width: 100%;
          min-height: 50px;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-top: 19px;
          padding: 0 17px;
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

        .checkout-button:hover {
          transform: translateY(-1px);
          background: #36362f;
          box-shadow: 0 8px 17px rgb(25 25 22 / 15%);
        }

        .checkout-arrow {
          font-size: 19px;
          font-weight: 400;
          transition: transform 180ms ease;
        }

        .checkout-button:hover .checkout-arrow {
          transform: translateX(3px);
        }

        .secure-note {
          display: flex;
          align-items: flex-start;
          justify-content: center;
          gap: 6px;
          margin-top: 14px;
          color: #89857b;
          font-size: 9px;
          line-height: 1.6;
          text-align: center;
        }

        .secure-note span {
          color: #547653;
          font-weight: 900;
        }

        @media (max-width: 760px) {
          .cart-card {
            border-radius: 19px;
          }

          .cart-header {
            padding: 18px;
          }

          .cart-items {
            padding-inline: 17px;
          }

          .cart-total {
            padding: 18px;
          }

          .empty-cart {
            padding: 27px 18px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .checkout-button,
          .checkout-arrow {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
