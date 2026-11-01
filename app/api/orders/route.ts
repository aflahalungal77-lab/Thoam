import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

type InputItem = {
  productId: string;
  quantity: number;
};

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon || !serviceKey) {
    return NextResponse.json(
      { error: "Server order configuration is incomplete." },
      { status: 503 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";

  if (!token) {
    return NextResponse.json(
      { error: "Please sign in before placing a delivery order." },
      { status: 401 }
    );
  }

  const authClient = createClient(url, anon, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error: authError,
  } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json(
      { error: "Your session expired. Sign in again." },
      { status: 401 }
    );
  }

  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const restaurantId = String(body.restaurantId || "");
  const customerName = String(body.customerName || "")
    .trim()
    .slice(0, 100);
  const customerPhone = String(body.customerPhone || "")
    .trim()
    .slice(0, 30);
  const deliveryAddress = String(body.deliveryAddress || "")
    .trim()
    .slice(0, 600);
  const notes = String(body.notes || "")
    .trim()
    .slice(0, 500);

  const offerId =
    body.offerId === null || body.offerId === undefined || body.offerId === ""
      ? null
      : String(body.offerId);

  const inputItems: InputItem[] = Array.isArray(body.items)
    ? body.items
    : [];

  if (
    !restaurantId ||
    !customerName ||
    customerPhone.replace(/\D/g, "").length < 10 ||
    deliveryAddress.length < 8
  ) {
    return NextResponse.json(
      {
        error:
          "Please provide your name, valid phone number and full delivery address.",
      },
      { status: 400 }
    );
  }

  if (offerId && !UUID_REGEX.test(offerId)) {
    return NextResponse.json(
      { error: "Invalid offer selected." },
      { status: 400 }
    );
  }

  if (!inputItems.length || inputItems.length > 40) {
    return NextResponse.json(
      { error: "Your cart is empty or has too many different items." },
      { status: 400 }
    );
  }

  const quantities = new Map<string, number>();

  for (const item of inputItems) {
    const id = String(item.productId || "");
    const quantity = Number(item.quantity);

    if (
      !UUID_REGEX.test(id) ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50
    ) {
      return NextResponse.json(
        { error: "Invalid product or quantity." },
        { status: 400 }
      );
    }

    quantities.set(id, (quantities.get(id) || 0) + quantity);
  }

  if ([...quantities.values()].some((quantity) => quantity > 50)) {
    return NextResponse.json(
      { error: "Maximum 50 of each item per order." },
      { status: 400 }
    );
  }

  const db = createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: order, error: orderError } = await db.rpc(
    "create_cod_delivery_order",
    {
      p_customer_id: user.id,
      p_restaurant_id: restaurantId,
      p_customer_name: customerName,
      p_customer_phone: customerPhone,
      p_delivery_address: deliveryAddress,
      p_notes: notes || null,
      p_items: [...quantities.entries()].map(
        ([productId, quantity]) => ({
          productId,
          quantity,
        })
      ),
      p_offer_id: offerId,
    }
  );

  if (orderError || !order) {
    const detail = orderError?.message || "Could not create order.";

    const conflict =
      /closed|unavailable|not enough stock|disabled delivery|offer/i.test(
        detail
      );

    return NextResponse.json(
      { error: detail },
      { status: conflict ? 409 : 400 }
    );
  }

  return NextResponse.json({ order }, { status: 201 });
}