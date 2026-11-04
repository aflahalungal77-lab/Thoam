import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";

export const revalidate = 3600;

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://thoam.vercel.app").replace(/\/+$/, "");

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicPages: MetadataRoute.Sitemap = [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/restaurants`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/owner`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/challenges`, changeFrequency: "daily", priority: 0.6 },
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return publicPages;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data, error } = await supabase
      .from("restaurants")
      .select("slug")
      .eq("status", "approved");

    if (error || !data) {
      return publicPages;
    }

    const restaurantPages: MetadataRoute.Sitemap = data
      .filter((restaurant) => typeof restaurant.slug === "string" && restaurant.slug.length > 0)
      .map((restaurant) => ({
        url: `${siteUrl}/restaurants/${encodeURIComponent(restaurant.slug)}`,
        changeFrequency: "weekly",
        priority: 0.8,
      }));

    return [...publicPages, ...restaurantPages];
  } catch {
    return publicPages;
  }
}
