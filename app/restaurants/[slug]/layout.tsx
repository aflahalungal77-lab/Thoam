import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://thoam.vercel.app").replace(/\/+$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      title: "Restaurant Menu",
      description: "Explore local restaurant menus with Tho'am.",
      robots: { index: false, follow: false },
    };
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("restaurants")
      .select("name,description,area,city")
      .eq("slug", slug)
      .eq("status", "approved")
      .maybeSingle();

    if (error || !data) {
      return {
        title: "Restaurant not found",
        robots: { index: false, follow: false },
      };
    }

    const location = [data.area, data.city || "Malappuram"]
      .filter(Boolean)
      .join(", ");
    const fullTitle = `${data.name} Menu in ${location}`;
    const title = fullTitle.length <= 60 ? fullTitle : `${data.name} Menu | Tho'am`;
    const description = (
      `${data.description?.trim() ? data.description.trim() + " " : ""}Explore ${data.name}'s menu and order online in ${location} with Tho'am.`
    ).slice(0, 160);
    const canonicalPath = `/restaurants/${encodeURIComponent(slug)}`;

    return {
      title,
      description,
      alternates: {
        canonical: canonicalPath,
      },
      openGraph: {
        title: `${data.name} Menu | Tho'am`,
        description,
        url: `${siteUrl}${canonicalPath}`,
        siteName: "Tho'am",
        locale: "en_IN",
        type: "website",
      },
      twitter: {
        card: "summary",
        title: `${data.name} Menu | Tho'am`,
        description,
      },
    };
  } catch {
    return {
      title: "Restaurant Menu",
      description: "Explore local restaurant menus with Tho'am.",
      robots: { index: false, follow: false },
    };
  }
}

export default function RestaurantMenuLayout({ children }: Props) {
  return children;
}
