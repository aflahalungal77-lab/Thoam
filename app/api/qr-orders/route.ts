
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InputItem = {
  productId: string;
  quantity: number;
};

type OrderResult = {
  id?: string;
  order_number?: number | string;
  total_amount?: number | string;
  status?: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  // 1. Validate server configuration
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("QR order creation failed: Missing server configuration.");

    return errorResponse(
      "The ordering service is temporarily unavailable.",
      503
    );
  }

  // 2. Parse request body
  let body: Record<string, unknown>;

  try {
    const parsed: unknown = await req.json();

    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed)
    ) {
      return errorResponse("Invalid request body.", 400);
    }

    body = parsed as Record<string, unknown>;
  } catch {
    return errorResponse("Invalid request body.", 400);
  }

  // 3. Read and normalize input
  const restaurantId = String(body.restaurantId ?? "").trim();
  const tableCode = String(body.tableCode ?? "").trim();
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const notes = String(body.notes ?? "").trim();

  const rawItems = Array.isArray(body.items) ? body.items : [];

  // 4. Validate restaurant
  if (!uuidPattern.test(restaurantId)) {
    return errorResponse("Invalid restaurant.", 400);
  }

  // 5. Validate table
  if (!tableCode || tableCode.length > 50) {
    return errorResponse("Invalid table QR code.", 400);
  }

  // QR dine-in orders intentionally do not collect customer identity.\n\n  if (notes.length > 500) {
    return errorResponse(
      "Special instructions must be under 500 characters.",
      400
    );
  }

  // 7. Validate cart
  if (rawItems.length < 1 || rawItems.length > 40) {
    return errorResponse(
      "Your cart is empty or contains too many items.",
      400
    );
  }

  const items: InputItem[] = [];
  const seen = new Set<string>();

  for (const rawItem of rawItems) {
    if (
      !rawItem ||
      typeof rawItem !== "object" ||
      Array.isArray(rawItem)
    ) {
      return errorResponse("Invalid product or quantity.", 400);
    }

    const item = rawItem as Record<string, unknown>;
    const productId = String(item.productId ?? "").trim();
    const quantity = Number(item.quantity);

    if (
      !uuidPattern.test(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50
    ) {
      return errorResponse("Invalid product or quantity.", 400);
    }

    if (seen.has(productId)) {
      return errorResponse(
        "Duplicate products in cart. Please refresh the menu.",
        400
      );
    }

    seen.add(productId);
    items.push({ productId, quantity });
  }

  // 8. Create server-side Supabase client
  // Never expose the service-role key to the browser.
  const db = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 9. Create the dine-in order
  try {
    const { data, error } = await db.rpc(
      "create_qr_dine_in_order_v2",
      {
        p_restaurant_id: restaurantId,
        p_table_code: tableCode,
        p_customer_name: customerName,
        p_customer_phone: customerPhone,
        p_notes: notes,
        p_items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      }
    );

    // Log diagnostic information on the server.
    if (error) {
      console.error("QR order creation failed:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });

      const message = error.message ?? "";

      const unavailable =
        /closed|unavailable|inactive|invalid|not enough stock|disabled/i.test(
          message
        );

      return errorResponse(
        unavailable
          ? "A menu item, table, or restaurant is currently unavailable. Please refresh and try again."
          : "We could not place your order. Please try again.",
        unavailable ? 409 : 400
      );
    }

    if (!data) {
      console.error(
        "QR order creation failed: RPC returned no order data."
      );

      return errorResponse(
        "The order could not be confirmed. Please try again.",
        500
      );
    }

    // The RPC may return a single order object or an array.
    const rawOrder: unknown = Array.isArray(data) ? data[0] : data;

    if (
      !rawOrder ||
      typeof rawOrder !== "object" ||
      Array.isArray(rawOrder)
    ) {
      console.error(
        "QR order creation failed: Unexpected RPC response format."
      );

      return errorResponse(
        "The order could not be confirmed. Please try again.",
        500
      );
    }

    const order = rawOrder as OrderResult;

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    console.error(
      "Unexpected QR order API error:",
      error instanceof Error
        ? {
            message: error.message,
            name: error.name,
          }
        : "Unknown error"
    );

    return errorResponse(
      "An unexpected error occurred while placing your order.",
      500
    );
  }
}
