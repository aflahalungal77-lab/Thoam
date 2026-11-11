
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InputItem = {
  productId: string;
  quantity: number;
  specialInstructions?: string;
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

    if (seen.has(productId)) {
      return errorResponse(
        "Duplicate products in cart. Please refresh the menu.",
        400
      );
    }

    const specialInstructions = String(item.specialInstructions ?? "").trim();
    if (specialInstructions.length > 300) {
      return errorResponse("Item instructions must be under 300 characters.", 400);
    }

    seen.add(productId);
    items.push({ productId, quantity, specialInstructions });
  }

  // 8. Create server-side Supabase client
  // Never expose the service-role key to the browser.
  const db = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 8a. Distributed rate limits: shared across Vercel instances and regions.
  // Keep the raw IP out of the database; only SHA-256 bucket keys are stored.
  const clientIp = (
    req.headers.get("x-vercel-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for") ||
    "unknown"
  ).split(",")[0].trim().slice(0, 64);
  const hashBucket = (value: string) =>
    createHash("sha256").update(value).digest("hex");

  const rateLimitChecks = [
    { key: hashBucket(`qr:ip:${clientIp}`), limit: 30 },
    { key: hashBucket(`qr:table:${restaurantId}:${tableCode}`), limit: 40 },
  ];

  for (const check of rateLimitChecks) {
    const { data: limitData, error: limitError } = await db.rpc(
      "consume_qr_order_rate_limit",
      {
        p_bucket_key: check.key,
        p_limit: check.limit,
        p_window_seconds: 60,
      }
    );

    if (limitError) {
      console.error("QR rate-limit check failed:", limitError.message);
      return errorResponse("Ordering is temporarily unavailable. Please try again shortly.", 503);
    }

    const limitRow = Array.isArray(limitData) ? limitData[0] : limitData;
    if (!limitRow || limitRow.allowed !== true) {
      const retryAfter = Math.max(1, Number(limitRow?.retry_after_seconds) || 60);
      return NextResponse.json(
        { error: "Too many orders in a short time. Please wait a moment and try again." },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  // 9. Create the dine-in order
  try {
    const { data, error } = await db.rpc(
      "create_qr_dine_in_order_v2",
      {
        p_restaurant_id: restaurantId,
        p_table_code: tableCode,
        p_notes: notes,
        p_items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions || "",
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
