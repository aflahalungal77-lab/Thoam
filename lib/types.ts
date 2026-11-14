export type FoodCategory = { id: string; name: string; slug: string };
export type Restaurant = { id: string; name: string; slug: string; description?: string | null; area?: string | null; city?: string | null; logo_url?: string | null; latitude?: number | null; longitude?: number | null; delivery_radius_km?: number | null; is_open?: boolean; delivery_enabled?: boolean; qr_enabled?: boolean };
export type ProductVariant = { name: string; price: number; is_available?: boolean };
export type FoodProduct = { id: string; restaurant_id: string; name: string; description?: string | null; price: number; image_url?: string | null; category?: string | null; is_veg: boolean; is_available: boolean; variants?: ProductVariant[]; taste_tags?: string[]; cuisine_type?: string | null };
