import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Restaurants in Malappuram",
  description:
    "Explore restaurants in Malappuram, browse local food menus and discover convenient online and QR-based ordering with Tho'am.",
  alternates: {
    canonical: "/restaurants",
  },
  openGraph: {
    title: "Restaurants in Malappuram | Tho'am",
    description:
      "Discover local restaurants in Malappuram and explore their digital menus with Tho'am.",
    url: "/restaurants",
    type: "website",
  },
};

export default function RestaurantsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
