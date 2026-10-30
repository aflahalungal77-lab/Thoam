
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

export default function MenuProductCard({
  product,
  quantity,
  onAdd,
  onRemove,
}: Props) {
  return (
    <article className="product-card">
      <div className="product-image">
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            sizes="(max-width: 760px) 50vw, (max-width: 1199px) 33vw, 280px"
            className="food-image"
            unoptimized
          />
        ) : (
          <div className="image-placeholder">
            <span aria-hidden="true">🍽️</span>
            <span>Delicious food</span>
          </div>
        )}

        {product.category && (
          <span className="product-category">{product.category}</span>
        )}
      </div>

      <div className="product-info">
        <h3 title={product.name}>{product.name}</h3>

        {product.description && (
          <p className="product-description">
            {product.description}
          </p>
        )}

        <div className="product-bottom">
          <div className="price-block">
            <span className="price-label">PRICE</span>
            <span className="product-price">
              ₹{Number(product.price).toFixed(2)}
            </span>
          </div>

          {quantity === 0 ? (
            <button
              type="button"
              disabled={!product.is_available}
              onClick={() => onAdd(product)}
              className="add-button"
            >
              {product.is_available ? (
                <>
                  <span>Add</span>
                  <span className="add-symbol">+</span>
                </>
              ) : (
                "Unavailable"
              )}
            </button>
          ) : (
            <div className="quantity-control">
              <button
                type="button"
                onClick={() => onRemove(product.id)}
                aria-label={`Remove one ${product.name}`}
              >
                −
              </button>

              <span aria-live="polite">{quantity}</span>

              <button
                type="button"
                onClick={() => onAdd(product)}
                aria-label={`Add one ${product.name}`}
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .product-card {
          display: flex;
          flex-direction: column;
          min-width: 0;
          overflow: hidden;
          padding: 10px;
          border: 1px solid #e9e5dc;
          border-radius: 20px;
          background: #fff;
          box-shadow:
            0 2px 5px rgb(30 25 15 / 2%),
            0 8px 22px rgb(30 25 15 / 4%);
          transition:
            transform 220ms ease,
            box-shadow 220ms ease,
            border-color 220ms ease;
        }

        .product-card:hover {
          transform: translateY(-4px);
          border-color: #d9d2c5;
          box-shadow:
            0 5px 12px rgb(30 25 15 / 4%),
            0 18px 34px rgb(30 25 15 / 9%);
        }

        .product-image {
          position: relative;
          width: 100%;
          aspect-ratio: 4 / 3;
          overflow: hidden;
          flex-shrink: 0;
          border-radius: 14px;
          background: #f0eee8;
          isolation: isolate;
        }

        .food-image {
          object-fit: cover;
          object-position: center;
          transition: transform 450ms cubic-bezier(0.2, 0.7, 0.2, 1);
        }

        .product-card:hover .food-image {
          transform: scale(1.045);
        }

        .image-placeholder {
          display: flex;
          width: 100%;
          height: 100%;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #8b8578;
        }

        .image-placeholder span:first-child {
          font-size: 35px;
        }

        .image-placeholder span:last-child {
          font-size: 10px;
          font-weight: 650;
        }

        .product-category {
          position: absolute;
          z-index: 2;
          right: 8px;
          bottom: 8px;
          max-width: calc(100% - 16px);
          overflow: hidden;
          padding: 6px 9px;
          border: 1px solid rgb(255 255 255 / 65%);
          border-radius: 999px;
          background: rgb(255 255 255 / 92%);
          color: #34332d;
          font-size: 9px;
          font-weight: 750;
          text-overflow: ellipsis;
          white-space: nowrap;
          backdrop-filter: blur(8px);
        }

        .product-info {
          display: flex;
          flex: 1;
          flex-direction: column;
          min-width: 0;
          padding: 13px 3px 3px;
        }

        .product-info h3 {
          display: -webkit-box;
          overflow: hidden;
          color: #24241f;
          font-size: 15px;
          font-weight: 800;
          letter-spacing: -0.3px;
          line-height: 1.45;
          overflow-wrap: anywhere;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .product-description {
          display: -webkit-box;
          overflow: hidden;
          margin-top: 6px;
          color: #858176;
          font-size: 11px;
          line-height: 1.65;
          overflow-wrap: anywhere;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
        }

        .product-bottom {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 7px;
          margin-top: auto;
          padding-top: 17px;
        }

        .price-block {
          display: grid;
          gap: 4px;
          min-width: 0;
        }

        .price-label {
          color: #9a9589;
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .product-price {
          color: #191916;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.5px;
          white-space: nowrap;
        }

        .add-button {
          display: inline-flex;
          min-height: 38px;
          align-items: center;
          justify-content: center;
          gap: 9px;
          padding: 0 12px;
          border: 1px solid #191916;
          border-radius: 11px;
          background: #191916;
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          white-space: nowrap;
          box-shadow: 0 3px 7px rgb(25 25 22 / 10%);
          transition:
            background 180ms ease,
            transform 180ms ease,
            box-shadow 180ms ease;
        }

        .add-button:hover:not(:disabled) {
          background: #37372f;
          box-shadow: 0 5px 12px rgb(25 25 22 / 15%);
        }

        .add-button:active:not(:disabled) {
          transform: scale(0.97);
        }

        .add-button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        .add-symbol {
          font-size: 16px;
          line-height: 1;
        }

        .quantity-control {
          display: flex;
          min-height: 37px;
          align-items: center;
          gap: 8px;
          padding: 3px 5px;
          border: 1px solid #e7e3da;
          border-radius: 11px;
          background: #faf9f6;
        }

        .quantity-control button {
          display: grid;
          width: 26px;
          height: 27px;
          place-items: center;
          border-radius: 7px;
          background: #fff;
          color: #24241f;
          font-size: 17px;
          font-weight: 800;
        }

        .quantity-control button:hover {
          background: #eae7df;
        }

        .quantity-control > span {
          min-width: 14px;
          color: #191916;
          font-size: 12px;
          font-weight: 800;
          text-align: center;
        }

        @media (max-width: 760px) {
          .product-card {
            padding: 8px;
            border-radius: 16px;
          }

          .product-image {
            border-radius: 11px;
          }

          .product-info {
            padding-top: 11px;
          }

          .product-info h3 {
            font-size: 13px;
            letter-spacing: -0.15px;
          }

          .product-description {
            font-size: 10px;
          }

          .product-bottom {
            align-items: center;
            flex-wrap: wrap;
            padding-top: 14px;
          }

          .product-price {
            font-size: 14px;
          }

          .price-label {
            font-size: 7px;
          }

          .add-button {
            min-height: 34px;
            gap: 6px;
            padding-inline: 9px;
            border-radius: 9px;
            font-size: 10px;
          }

          .quantity-control {
            gap: 4px;
            min-height: 33px;
          }

          .quantity-control button {
            width: 23px;
            height: 25px;
          }
        }

        @media (max-width: 360px) {
          .product-card {
            padding: 6px;
          }

          .product-bottom {
            gap: 5px;
          }

          .product-price {
            font-size: 12px;
          }

          .add-button {
            padding-inline: 7px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .product-card,
          .food-image,
          .add-button {
            transition: none;
          }
        }
      `}</style>
    </article>
  );
}
