
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InputItem = {
  productId: string;
  quantity: number;
  specialInstructions?: string;
  variantName?: string;
};

type OrderResult = {
  id?: string;
  order_number?: number | string;
  total_amount?: number | string;
  status?: string;
};

// Reuse the Supabase client across warm serverless invocations.
let cachedDb: ReturnType<typeof createClient> | null = null;

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
  const notes = String(body.notes ?? "").trim();
  const offerId = body.offerId == null || body.offerId === "" ? null : String(body.offerId).trim();

  const rawItems = Array.isArray(body.items) ? body.items : [];

  // 4. Validate restaurant
  if (!uuidPattern.test(restaurantId)) {
    return errorResponse("Invalid restaurant.", 400);
  }

  if (offerId !== null && !uuidPattern.test(offerId)) {
    return errorResponse("Invalid offer.", 400);
  }

  // 5. Validate table
  if (!tableCode || tableCode.length > 50) {
    return errorResponse("Invalid table QR code.", 400);
  }

  // QR dine-in orders intentionally do not collect customer identity.

  if (notes.length > 500) {
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

    const specialInstructions = String(item.specialInstructions ?? "").trim();
    const variantName = item.variantName == null ? "" : String(item.variantName).trim();
    if (variantName.length > 40) return errorResponse("Invalid product size.", 400);

    const itemKey = `${productId}::${variantName.toLowerCase()}`;
    if (seen.has(itemKey)) {
      return errorResponse(
        "Duplicate products in cart. Please refresh the menu.",
        400
      );
    }
    if (specialInstructions.length > 300) {
      return errorResponse("Item instructions must be under 300 characters.", 400);
    }

    seen.add(itemKey);
    items.push({ productId, quantity, specialInstructions, variantName: variantName || undefined });
  }

  // 8. Reuse the server-side client to avoid rebuilding it on every warm request.
  // Never expose the service-role key to the browser.
  const db = cachedDb ?? (cachedDb = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }));

  // 9. Create the dine-in order
  try {
    // This v3 RPC is present in the database but not yet in the generated Supabase types.
    const createQrOrder = db.rpc as unknown as (
      functionName: string,
      args: {
        p_restaurant_id: string;
        p_table_code: string;
        p_notes: string;
        p_offer_id: string | null;
        p_items: {
          productId: string;
          quantity: number;
          specialInstructions: string;
          variantName: string | null;
        }[];
      }
    ) => ReturnType<typeof db.rpc>;

    const { data, error } = await createQrOrder(
      "create_qr_dine_in_order_v3",
      {
        p_restaurant_id: restaurantId,
        p_table_code: tableCode,
        p_notes: notes,
        p_offer_id: offerId,
        p_items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || "",
          variantName: item.variantName || null,
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

      if (/offer|discount|minimum|eligible/i.test(message)) {
        return errorResponse("This offer is no longer valid for your cart. Please update your offer selection.", 409);
      }

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
