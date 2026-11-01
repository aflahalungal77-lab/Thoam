"use client";

import type { MenuProduct } from "./MenuProductCard";

export interface CartItem { product: MenuProduct; quantity: number; }
interface Props {
  items: CartItem[];
  onIncrease: (product: MenuProduct) => void;
  onDecrease: (productId: string) => void;
  onCheckout: () => void;
}

export default function MenuCart({ items, onIncrease, onDecrease, onCheckout }: Props) {
  const subtotal = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <section className="cart-card" aria-label="Your shopping cart">
      <div className="cart-header">
        <div className="cart-icon" aria-hidden="true"> <svg viewBox="0 0 24 24"><path d="M3 4h2l2.2 10.1a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H6"/><circle cx="10" cy="20" r="1.3"/><circle cx="18" cy="20" r="1.3"/></svg></div>
        <div className="cart-heading"><span className="cart-eyebrow">YOUR SELECTION</span><h2>Your order</h2><p>{totalQuantity ? "Your delicious picks, all in one place." : "A great meal starts with a great choice."}</p></div>
        <span className="item-badge">{totalQuantity}</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-cart">
          <div className="empty-cart-icon" aria-hidden="true"><svg viewBox="0 0 48 48"><path d="M8 11h4l4.5 21h20L42 17H15"/><circle cx="20" cy="39" r="2.5"/><circle cx="34" cy="39" r="2.5"/><path d="M23 8v12M17 14h12"/></svg></div>
          <h3>Your cart is empty</h3><p>Explore the menu and add your favourites. They’ll show up here.</p>
          <span className="empty-cart-hint">MADE FOR YOUR CRAVINGS</span>
        </div>
      ) : (
        <>
          <div className="cart-items">
            {items.map(({ product, quantity }) => (
              <div className="cart-item" key={product.id}>
                <div className="item-details"><p className="item-name" title={product.name}>{product.name}</p><p className="item-price">₹{Number(product.price).toFixed(2)} each</p><p className="item-line-total">₹{(Number(product.price) * quantity).toFixed(2)}</p></div>
                <div className="quantity-control" aria-label={`Quantity of ${product.name}`}>
                  <button type="button" onClick={() => onDecrease(product.id)} aria-label={`Remove one ${product.name}`}>−</button><span aria-live="polite">{quantity}</span><button type="button" onClick={() => onIncrease(product)} aria-label={`Add one ${product.name}`}>+</button>
                </div>
              </div>
            ))}
          </div>
          <div className="cart-total">
            <div className="subtotal-row"><span>Subtotal</span><strong>₹{subtotal.toFixed(2)}</strong></div>
            <p className="checkout-note">Delivery charges, if applicable, will be confirmed by the restaurant.</p>
            <button type="button" onClick={onCheckout} className="checkout-button"><span>Continue to checkout</span><span className="checkout-arrow" aria-hidden="true">→</span></button>
            <p className="secure-note"><span aria-hidden="true">✓</span> Order details are prepared before opening WhatsApp.</p>
          </div>
        </>
      )}
      <style jsx>{`
        .cart-card{position:relative;overflow:hidden;border:1px solid #e7e6df;border-radius:21px;background:#fff;box-shadow:0 4px 12px rgb(20 20 18 / 3%),0 16px 38px rgb(20 20 18 / 5%)}
        .cart-header{display:flex;align-items:center;gap:12px;padding:21px;border-bottom:1px solid #efeee9;background:linear-gradient(135deg,#fff 0%,#fafaf7 100%)}
        .cart-icon{display:grid;width:44px;height:44px;flex-shrink:0;place-items:center;border-radius:14px;background:#191916;color:#fff}
        .cart-icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
        .cart-heading{flex:1;min-width:0}.cart-eyebrow{color:#99988e;font-size:8px;font-weight:900;letter-spacing:.17em}
        .cart-heading h2{margin-top:4px;color:#20201d;font-size:18px;font-weight:900;letter-spacing:-.55px}.cart-heading p{margin-top:4px;color:#85847b;font-size:10px;line-height:1.5}
        .item-badge{display:grid;min-width:30px;height:30px;padding-inline:8px;place-items:center;border:1px solid #e5e4dc;border-radius:999px;background:#f5f5f0;color:#282823;font-size:11px;font-weight:900}
        .empty-cart{display:grid;justify-items:center;padding:34px 20px;text-align:center}.empty-cart-icon{display:grid;width:66px;height:66px;place-items:center;border:1px solid #e8e7df;border-radius:21px;background:#f7f7f2;color:#88877e}
        .empty-cart-icon svg{width:38px;height:38px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
        .empty-cart h3{margin-top:17px;color:#292923;font-size:15px;font-weight:900}.empty-cart>p{max-width:230px;margin-top:8px;color:#85847b;font-size:11px;line-height:1.75}
        .empty-cart-hint{margin-top:18px;color:#a09f95;font-size:8px;font-weight:850;letter-spacing:.14em}
        .cart-items{padding:4px 21px 0}.cart-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:17px 0;border-bottom:1px solid #efeee9}
        .item-details{min-width:0;flex:1}.item-name{overflow:hidden;color:#292923;font-size:12px;font-weight:850;line-height:1.5;text-overflow:ellipsis;white-space:nowrap}
        .item-price{margin-top:4px;color:#8b897f;font-size:10px}.item-line-total{margin-top:6px;color:#20201d;font-size:12px;font-weight:900}
        .quantity-control{display:flex;align-items:center;gap:6px;padding:3px;border:1px solid #e7e6de;border-radius:11px;background:#f8f8f4}
        .quantity-control button{display:grid;width:27px;height:28px;flex-shrink:0;place-items:center;border-radius:8px;background:#fff;color:#222;font-size:16px;font-weight:850}
        .quantity-control button:hover{background:#e9e9e2}.quantity-control>span{min-width:15px;color:#191916;font-size:11px;font-weight:900;text-align:center}
        .cart-total{padding:21px;background:#fafaf7}.subtotal-row{display:flex;align-items:center;justify-content:space-between;gap:12px}
        .subtotal-row>span{color:#69685f;font-size:12px;font-weight:700}.subtotal-row strong{color:#191916;font-size:23px;font-weight:950;letter-spacing:-.8px}
        .checkout-note{margin-top:9px;color:#8b897f;font-size:10px;line-height:1.7}
        .checkout-button{display:flex;width:100%;min-height:51px;align-items:center;justify-content:space-between;gap:12px;margin-top:18px;padding:0 17px;border:1px solid #191916;border-radius:13px;background:#191916;color:#fff;font-size:12px;font-weight:850;box-shadow:0 6px 15px rgb(25 25 22 / 13%);transition:background .18s ease,transform .18s ease,box-shadow .18s ease}
        .checkout-button:hover{transform:translateY(-1px);background:#373730;box-shadow:0 9px 20px rgb(25 25 22 / 17%)}.checkout-arrow{font-size:20px;font-weight:400;transition:transform .18s ease}.checkout-button:hover .checkout-arrow{transform:translateX(3px)}
        .secure-note{display:flex;align-items:flex-start;justify-content:center;gap:6px;margin-top:13px;color:#89877e;font-size:9px;line-height:1.6;text-align:center}.secure-note span{color:#4c7650;font-weight:950}
        @media(max-width:760px){.cart-card{border-radius:18px}.cart-header{padding:18px}.cart-items{padding-inline:17px}.cart-total{padding:18px}.empty-cart{padding:28px 18px}}
        @media(prefers-reduced-motion:reduce){.checkout-button,.checkout-arrow{transition:none}}
      `}</style>
    </section>
  );
}
