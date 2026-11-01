"use client";

import Image from "next/image";

export interface MenuProduct {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  category?: string | null;
  is_available: boolean;
}

interface Props {
  product: MenuProduct;
  quantity: number;
  onAdd: (product: MenuProduct) => void;
  onRemove: (productId: string) => void;
}

export default function MenuProductCard({ product, quantity, onAdd, onRemove }: Props) {
  return (
    <article className="product-card">
      <div className="product-image">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 520px) 48vw, (max-width: 900px) 32vw, 280px"
            className="food-image"
            unoptimized
          />
        ) : (
          <div className="image-placeholder" aria-label="Food image unavailable">
            <span aria-hidden="true">🍽</span>
            <span>Image coming soon</span>
          </div>
        )}
        {product.category && <span className="product-category">{product.category}</span>}
        {!product.is_available && <span className="unavailable-badge">Currently unavailable</span>}
      </div>

      <div className="product-info">
        <div className="product-title-row">
          <h3 title={product.name}>{product.name}</h3>
          <span className="fresh-dot" aria-label={product.is_available ? "Available" : "Unavailable"} />
        </div>
        {product.description && <p className="product-description">{product.description}</p>}
        <div className="product-bottom">
          <div className="price-block">
            <span className="price-label">PRICE</span>
            <span className="product-price">₹{Number(product.price).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
          {quantity === 0 ? (
            <button type="button" disabled={!product.is_available} onClick={() => onAdd(product)} className="add-button">
              {product.is_available ? <>Add <span className="add-symbol">+</span></> : "Unavailable"}
            </button>
          ) : (
            <div className="quantity-control" aria-label={`Quantity of ${product.name}`}>
              <button type="button" onClick={() => onRemove(product.id)} aria-label={`Remove one ${product.name}`}>−</button>
              <span aria-live="polite">{quantity}</span>
              <button type="button" onClick={() => onAdd(product)} aria-label={`Add one ${product.name}`}>+</button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .product-card{display:flex;flex-direction:column;min-width:0;overflow:hidden;padding:9px;border:1px solid #e9e7e1;border-radius:19px;background:#fff;box-shadow:0 2px 5px rgb(20 20 18 / 3%),0 9px 24px rgb(20 20 18 / 4%);transition:transform .22s ease,border-color .22s ease,box-shadow .22s ease}
        .product-card:hover{transform:translateY(-4px);border-color:#cfcfc5;box-shadow:0 14px 32px rgb(20 20 18 / 10%)}
        .product-image{position:relative;width:100%;aspect-ratio:1.16/1;overflow:hidden;flex-shrink:0;border-radius:13px;background:linear-gradient(135deg,#f3f2ed,#e9e7df);isolation:isolate}
        .food-image{object-fit:cover;object-position:center;transition:transform .45s cubic-bezier(.2,.7,.2,1)}
        .product-card:hover .food-image{transform:scale(1.055)}
        .image-placeholder{display:flex;width:100%;height:100%;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#89877d}
        .image-placeholder span:first-child{font-size:34px}.image-placeholder span:last-child{font-size:10px;font-weight:650}
        .product-category{position:absolute;z-index:2;left:9px;top:9px;max-width:calc(100% - 18px);overflow:hidden;padding:6px 9px;border:1px solid rgb(255 255 255 / 75%);border-radius:999px;background:rgb(255 255 255 / 94%);color:#34342f;font-size:9px;font-weight:800;text-overflow:ellipsis;white-space:nowrap;backdrop-filter:blur(10px)}
        .unavailable-badge{position:absolute;inset:auto 8px 8px;padding:7px 9px;border-radius:9px;background:rgb(25 25 22 / 82%);color:white;font-size:9px;font-weight:750;text-align:center}
        .product-info{display:flex;flex:1;flex-direction:column;min-width:0;padding:12px 3px 3px}
        .product-title-row{display:flex;align-items:flex-start;gap:7px}
        .product-info h3{display:-webkit-box;flex:1;overflow:hidden;color:#20201d;font-size:14px;font-weight:850;letter-spacing:-.35px;line-height:1.4;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2}
        .fresh-dot{width:7px;height:7px;flex-shrink:0;margin-top:6px;border-radius:50%;background:#4b8758;box-shadow:0 0 0 3px #eaf2e9}
        .product-description{display:-webkit-box;overflow:hidden;margin-top:6px;color:#85847b;font-size:10px;line-height:1.6;overflow-wrap:anywhere;-webkit-box-orient:vertical;-webkit-line-clamp:2}
        .product-bottom{display:flex;align-items:center;justify-content:space-between;gap:7px;margin-top:auto;padding-top:15px}
        .price-block{display:grid;gap:4px;min-width:0}.price-label{color:#99988f;font-size:8px;font-weight:850;letter-spacing:.15em}
        .product-price{color:#171715;font-size:16px;font-weight:950;letter-spacing:-.55px;white-space:nowrap}
        .add-button{display:inline-flex;min-height:37px;align-items:center;justify-content:center;gap:8px;padding:0 12px;border:1px solid #191916;border-radius:10px;background:#191916;color:#fff;font-size:11px;font-weight:850;white-space:nowrap;box-shadow:0 4px 10px rgb(25 25 22 / 12%);transition:background .18s ease,transform .18s ease}
        .add-button:hover:not(:disabled){transform:translateY(-1px);background:#3a3a34}.add-button:active:not(:disabled){transform:scale(.97)}.add-button:disabled{cursor:not-allowed;opacity:.45}.add-symbol{font-size:16px;line-height:1}
        .quantity-control{display:flex;min-height:36px;align-items:center;gap:7px;padding:3px 5px;border:1px solid #e5e3dc;border-radius:10px;background:#f8f8f5}
        .quantity-control button{display:grid;width:25px;height:26px;place-items:center;border-radius:7px;background:#fff;color:#222;font-size:17px;font-weight:850}.quantity-control button:hover{background:#e9e9e2}
        .quantity-control>span{min-width:14px;color:#191916;font-size:12px;font-weight:850;text-align:center}
        @media(max-width:760px){.product-card{padding:7px;border-radius:16px}.product-image{border-radius:11px}.product-info{padding-top:10px}.product-info h3{font-size:12px}.product-description{font-size:9px}.product-bottom{gap:5px;padding-top:12px}.product-price{font-size:14px}.add-button{min-height:33px;padding-inline:9px;font-size:10px}.quantity-control{gap:4px;min-height:32px}.quantity-control button{width:22px;height:24px}}
        @media(max-width:360px){.product-card{padding:6px}.product-price{font-size:12px}.add-button{padding-inline:7px}}
        @media(prefers-reduced-motion:reduce){.product-card,.food-image,.add-button{transition:none}}
      `}</style>
    </article>
  );
}
