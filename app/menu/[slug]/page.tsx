
import { createClient } from "@/lib/supabase/server";
import PublicMenu from "@/components/menu/PublicMenu";
import type { MenuProduct } from "@/components/menu/MenuProductCard";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PublicMenuPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: restaurant, error: restaurantError } = await supabase
    .from("restaurants")
    .select(
      "id, name, slug, whatsapp_number, logo_url, description, delivery_fee, is_open, status"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (restaurantError) {
    console.error("Restaurant query error:", restaurantError);
    return (
      <main className="menu-message">
        <h1>Unable to load menu</h1>
        <p>Please try again later.</p>
      </main>
    );
  }

  if (!restaurant) {
    return (
      <main className="menu-message">
        <h1>Restaurant not found</h1>
        <p>This restaurant menu may no longer be available.</p>
      </main>
    );
  }

  if (!restaurant.whatsapp_number) {
    return (
      <main className="menu-message">
        <h1>{restaurant.name}</h1>
        <p>
          Online WhatsApp ordering is not configured for this restaurant yet.
        </p>
      </main>
    );
  }

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select(
      "id, name, description, price, image_url, category, is_available"
    )
    .eq("restaurant_id", restaurant.id)
    .eq("is_available", true)
    .order("name");

  if (productsError) {
    console.error("Products query error:", productsError);
    return (
      <main className="menu-message">
        <h1>Menu temporarily unavailable</h1>
        <p>Please refresh the page and try again.</p>
      </main>
    );
  }

  return (
    <>
      <PublicMenu
        restaurant={{
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
          whatsapp_number: restaurant.whatsapp_number,
          logo_url: restaurant.logo_url,
          description: restaurant.description,
          delivery_fee: restaurant.delivery_fee,
          is_open: restaurant.is_open,
        }}
        products={(products ?? []) as MenuProduct[]}
      />

      
    </>
  );
}
