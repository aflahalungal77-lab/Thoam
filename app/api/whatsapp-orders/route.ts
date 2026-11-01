import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase server environment variables are missing.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const restaurantSlug = String(body.restaurantSlug ?? "").trim();
    const customerName = String(body.customerName ?? "").trim();
    const customerPhone = String(body.customerPhone ?? "").replace(/\D/g, "");
    const orderType = String(body.orderType ?? "").trim().toUpperCase();
    const address = String(body.address ?? "").trim();
    const notes = String(body.notes ?? "").trim();
    const offerId = body.offerId ? String(body.offerId).trim() : null;
    const items = body.items;

    // Validate customer details.
    if (
      !restaurantSlug ||
      customerName.length < 2 ||
      customerName.length > 100 ||
      customerPhone.length < 10 ||
      customerPhone.length > 15
    ) {
      return jsonError("Please check your customer details.", 400);
    }

    // Validate order type.
    if (!["DELIVERY", "TAKEAWAY"].includes(orderType)) {
      return jsonError("Invalid order type.", 400);
    }

    if (orderType === "DELIVERY" && address.length < 5) {
      return jsonError("A valid delivery address is required.", 400);
    }

    if (address.length > 1000 || notes.length > 500) {
      return jsonError("Order details are too long.", 400);
    }

    // Validate cart.
    if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
      return jsonError("Your cart is empty or invalid.", 400);
    }

    const normalizedItems: { productId: string; quantity: number }[] = [];

    for (const item of items) {
      const productId = String(item?.productId ?? "").trim();
      const quantity = Number(item?.quantity);

      if (
        !productId ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 50
      ) {
        return jsonError("One or more cart items are invalid.", 400);
      }

      normalizedItems.push({ productId, quantity });
    }

    const supabase = getAdminClient();

    // Find restaurant.
    const { data: restaurant, error: restaurantError } = await supabase
      .from("restaurants")
      .select(
        "id, name, slug, whatsapp_number, is_open, delivery_enabled, delivery_fee, status"
      )
      .eq("slug", restaurantSlug)
      .maybeSingle();

    if (restaurantError) {
      console.error("Restaurant lookup failed:", restaurantError);
      return jsonError("Could not load restaurant details.", 500);
    }

    if (!restaurant) {
      return jsonError("Restaurant not found.", 404);
    }

    if (restaurant.status && restaurant.status !== "approved") {
      return jsonError("This restaurant is not available.", 403);
    }

    if (!restaurant.whatsapp_number) {
      return jsonError("Restaurant WhatsApp number is not configured.", 400);
    }

    if (restaurant.is_open === false) {
      return jsonError("This restaurant is currently closed.", 400);
    }

    if (
      orderType === "DELIVERY" &&
      restaurant.delivery_enabled === false
    ) {
      return jsonError("This restaurant does not offer delivery.", 400);
    }

    // Fetch product prices from the database.
    // Never trust prices sent by the client.
    const uniqueProductIds = [
      ...new Set(normalizedItems.map((item) => item.productId)),
    ];

    const { data: products, error: productError } = await supabase
      .from("products")
      .select("id, name, price, is_available, restaurant_id")
      .eq("restaurant_id", restaurant.id)
      .in("id", uniqueProductIds);

    if (productError) {
      console.error("Product validation failed:", productError);
      return jsonError("Could not validate menu items.", 500);
    }

    if (!products || products.length !== uniqueProductIds.length) {
      return jsonError("One or more products are no longer available.", 400);
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    const validatedItems: {
      productId: string;
      name: string;
      price: number;
      quantity: number;
      lineTotal: number;
    }[] = [];

    for (const item of normalizedItems) {
      const product = productMap.get(item.productId);

      if (!product || product.is_available === false) {
        return jsonError("A selected product is unavailable.", 400);
      }

      const price = Number(product.price);

      if (!Number.isFinite(price) || price < 0) {
        console.error("Invalid product price:", product.id, product.price);
        return jsonError("Invalid product price.", 500);
      }

      validatedItems.push({
        productId: product.id,
        name: product.name,
        price,
        quantity: item.quantity,
        lineTotal: Number((price * item.quantity).toFixed(2)),
      });
    }

    // Calculate totals using database prices and validate any selected offer.
    const subtotal = Number(
      validatedItems
        .reduce((sum, item) => sum + item.lineTotal, 0)
        .toFixed(2)
    );

    let discountAmount = 0;
    let appliedOffer: { id: string; title: string } | null = null;

    if (offerId) {
      const { data: offer, error: offerError } = await supabase
        .from("offers")
        .select("id,title,scope,discount_type,discount_value,product_ids,min_order_amount,max_discount,starts_at,ends_at,is_active,restaurant_id")
        .eq("id", offerId)
        .eq("restaurant_id", restaurant.id)
        .maybeSingle();

      if (offerError) {
        console.error("Offer lookup failed:", offerError);
        return jsonError("Could not validate the selected offer.", 500);
      }
      if (!offer || !offer.is_active) {
        return jsonError("This offer is no longer available. Please select another offer.", 400);
      }

      const now = Date.now();
      if (
        (offer.starts_at && new Date(offer.starts_at).getTime() > now) ||
        (offer.ends_at && new Date(offer.ends_at).getTime() < now)
      ) {
        return jsonError("This offer is not currently valid.", 400);
      }
      if (subtotal < Number(offer.min_order_amount ?? 0)) {
        return jsonError(
          `This offer requires a minimum order of ₹${Number(offer.min_order_amount ?? 0).toFixed(2)}.`,
          400
        );
      }

      const eligibleItems =
        offer.scope === "products"
          ? validatedItems.filter((item) =>
              Array.isArray(offer.product_ids) && offer.product_ids.includes(item.productId)
            )
          : validatedItems;
      const eligibleSubtotal = Number(
        eligibleItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
      );
      if (eligibleSubtotal <= 0) {
        return jsonError("Your cart does not contain products eligible for this offer.", 400);
      }

      const discountValue = Number(offer.discount_value);
      if (
        !Number.isFinite(discountValue) ||
        discountValue <= 0 ||
        (offer.discount_type === "percentage" && discountValue > 100)
      ) {
        console.error("Invalid offer configuration:", offer.id);
        return jsonError("This offer is configured incorrectly.", 500);
      }

      const rawDiscount =
        offer.discount_type === "percentage"
          ? (eligibleSubtotal * discountValue) / 100
          : discountValue;
      const cappedDiscount =
        offer.max_discount !== null && offer.max_discount !== undefined
          ? Math.min(rawDiscount, Number(offer.max_discount))
          : rawDiscount;
      discountAmount = Number(Math.min(eligibleSubtotal, cappedDiscount).toFixed(2));
      appliedOffer = { id: offer.id, title: offer.title };
    }

    const deliveryFee =
      orderType === "DELIVERY"
        ? Number(restaurant.delivery_fee ?? 0)
        : 0;

    if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
      console.error("Invalid restaurant delivery fee:", restaurant.delivery_fee);
      return jsonError("Invalid delivery fee configuration.", 500);
    }

    // Keep this fee consistent with the platform's actual pricing policy.
    const platformFee = 1;

    const total = Number(
      Math.max(0, subtotal - discountAmount + deliveryFee + platformFee).toFixed(2)
    );

    // Map the UI order types to the PostgreSQL enum values.
    const databaseOrderType =
      orderType === "DELIVERY" ? "delivery" : "takeaway";

    /*
     * The database generates order_number automatically because
     * it is a BIGINT identity column. Do not insert a custom string.
     *
     * The actual schema uses:
     * status = placed
     * payment_method = cod
     * payment_status = pending
     */

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        customer_name: customerName,
        customer_phone: customerPhone,
        order_type: databaseOrderType,
        delivery_address: orderType === "DELIVERY" ? address : null,
        notes: [notes, appliedOffer ? `Offer applied: ${appliedOffer.title} (Discount: ₹${discountAmount.toFixed(2)})` : ""].filter(Boolean).join("\n") || null,
        subtotal,
        delivery_fee: deliveryFee,
        platform_fee: platformFee,
        total_amount: total,
        payment_method: "cod",
        payment_status: "pending",
        status: "placed",
      })
      .select("id, order_number")
      .single();

    if (orderError || !order) {
      console.error("Order insert failed:", orderError);
      return jsonError(
        "Could not save the order. Please try again or contact the restaurant.",
        500
      );
    }

    // Save order items.
    const orderItems = validatedItems.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.lineTotal,
    }));

    const { error: orderItemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (orderItemsError) {
      console.error("Order items insert failed:", orderItemsError);

      // Avoid leaving an order without its items.
      const { error: rollbackError } = await supabase
        .from("orders")
        .delete()
        .eq("id", order.id);

      if (rollbackError) {
        console.error("Order rollback failed:", rollbackError);
      }

      return jsonError("Could not save the order items.", 500);
    }

    // Return order details to the frontend.
    // The frontend can use whatsappNumber to open WhatsApp.
    return NextResponse.json({
      success: true,
      order: {
        id: order.id,
        orderNumber: order.order_number,
        whatsappNumber: restaurant.whatsapp_number,
        restaurantName: restaurant.name,
        items: validatedItems.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal,
        discountAmount,
        appliedOffer,
        deliveryFee,
        platformFee,
        total,
        orderType: databaseOrderType,
      },
    });
  } catch (error) {
    console.error("WhatsApp order API error:", error);

    return jsonError(
      error instanceof Error &&
        error.message.includes("environment variables")
        ? "Server configuration error."
        : "Unexpected server error.",
      500
    );
  }
}