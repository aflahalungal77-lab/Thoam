import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type InputItem = {
  productId: string;
  quantity: number;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Server configuration is incomplete." },
      { status: 503 }
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const restaurantId = String(body.restaurantId ?? "").trim();
  const tableCode = String(body.tableCode ?? "").trim();
  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const items: InputItem[] = Array.isArray(body.items)
    ? body.items as InputItem[]
    : [];

  if (!uuidPattern.test(restaurantId)) {
    return NextResponse.json(
      { error: "Invalid restaurant." },
      { status: 400 }
    );
  }

  if (!tableCode || tableCode.length > 50) {
    return NextResponse.json(
      { error: "Invalid table QR code." },
      { status: 400 }
    );
  }

  if (customerName.length < 1 || customerName.length > 100) {
    return NextResponse.json(
      { error: "Please enter your name." },
      { status: 400 }
    );
  }

  if (
    customerPhone.replace(/\D/g, "").length < 10 ||
    customerPhone.length > 30
  ) {
    return NextResponse.json(
      { error: "Please enter a valid phone number." },
      { status: 400 }
    );
  }

  if (notes.length > 500) {
    return NextResponse.json(
      { error: "Notes must be under 500 characters." },
      { status: 400 }
    );
  }

  if (items.length < 1 || items.length > 40) {
    return NextResponse.json(
      { error: "Your cart is empty or contains too many items." },
      { status: 400 }
    );
  }

  const seen = new Set<string>();

  for (const item of items) {
    const productId = String(item?.productId ?? "");
    const quantity = Number(item?.quantity);

    if (
      !uuidPattern.test(productId) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50
    ) {
      return NextResponse.json(
        { error: "Invalid product or quantity." },
        { status: 400 }
      );
    }

    if (seen.has(productId)) {
      return NextResponse.json(
        { error: "Duplicate products in cart. Please refresh the menu." },
        { status: 400 }
      );
    }

    seen.add(productId);
  }

  // The service-role key is used only on the server.
  // Never expose this key through NEXT_PUBLIC_* variables.
  const db = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

const { data, error } = await db.rpc("create_qr_dine_in_order", {
  p_restaurant_id: restaurantId,
  p_table_code: tableCode,
  p_customer_name: customerName,
  p_customer_phone: customerPhone,
  p_notes: notes || "",
  p_items: items.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity),
  })),
});

  if (error || !data) {
    console.error("QR order creation failed:", error?.message);

    const message = error?.message ?? "";

    const unavailable =
      /closed|unavailable|inactive|invalid|not enough stock|disabled/i.test(
        message
      );

    return NextResponse.json(
      {
        error: unavailable
          ? "A menu item, table, or restaurant is currently unavailable. Please refresh and try again."
          : "We could not place your order. Please try again.",
      },
      { status: unavailable ? 409 : 400 }
    );
  }

  return NextResponse.json(
    { order: data },
    { status: 201 }
  );
}