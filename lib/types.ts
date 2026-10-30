export type FoodCategory = { id: string; name: string; slug: string };
export type Restaurant = { id: string; name: string; slug: string; description?: string | null; area?: string | null; city?: string | null; logo_url?: string | null; is_open?: boolean; delivery_enabled?: boolean; qr_enabled?: boolean };
export type FoodProduct = { id: string; restaurant_id: string; name: string; description?: string | null; price: number; image_url?: string | null; category?: string | null; is_veg: boolean; is_available: boolean };
