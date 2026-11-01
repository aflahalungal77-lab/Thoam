export interface WhatsAppOrderItem {
  name: string;
  price: number;
  quantity: number;
}

export interface WhatsAppOrderDetails {
  orderNumber: string;
  restaurantName: string;
  customerName: string;
  customerPhone: string;
  orderType: "DELIVERY" | "TAKEAWAY";
  address?: string;
  notes?: string;
  items: WhatsAppOrderItem[];
  subtotal: number;
  discountAmount?: number;
  offerTitle?: string | null;
  deliveryFee: number;
  total: number;
}

export function createWhatsAppOrderMessage(
  order: WhatsAppOrderDetails
): string {
  const itemLines = order.items
    .map(
      (item, index) =>
        `${index + 1}. ${item.name} x ${item.quantity} = ₹${(
          item.price * item.quantity
        ).toFixed(2)}`
    )
    .join("\n");

  return [
    "🍽️ NEW ORDER — THO'AM",
    "",
    `Order ID: ${order.orderNumber}`,
    `Restaurant: ${order.restaurantName}`,
    "",
    "📦 ORDER ITEMS",
    itemLines,
    "",
    `Subtotal: ₹${order.subtotal.toFixed(2)}`,
    ...(order.discountAmount && order.discountAmount > 0
      ? [`Offer: ${order.offerTitle || "Discount"}`, `Discount: -₹${order.discountAmount.toFixed(2)}`]
      : []),
    `Delivery Fee: ₹${order.deliveryFee.toFixed(2)}`,
    `TOTAL: ₹${order.total.toFixed(2)}`,
    "",
    "👤 CUSTOMER DETAILS",
    `Name: ${order.customerName}`,
    `Phone: ${order.customerPhone}`,
    `Order Type: ${order.orderType}`,
    ...(order.address ? [`Address: ${order.address}`] : []),
    ...(order.notes ? [`Instructions: ${order.notes}`] : []),
    "",
    "Please confirm my order.",
  ].join("\n");
}

export function getWhatsAppUrl(
  phone: string,
  message: string
): string {
  // WhatsApp number must contain country code and digits only.
  const cleanPhone = phone.replace(/\D/g, "");

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}