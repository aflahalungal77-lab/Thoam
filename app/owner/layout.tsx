import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Restaurant Partner Platform",
  description:
    "Bring your restaurant online with Tho'am. Manage your digital menu, customer orders, sales activity and QR-based dine-in ordering from one partner platform.",
  alternates: {
    canonical: "/owner",
  },
  openGraph: {
    title: "Restaurant Partner Platform | Tho'am",
    description:
      "Manage your restaurant menu, orders and QR-based dine-in ordering with Tho'am.",
    url: "/owner",
    type: "website",
  },
  manifest: "/owner/manifest.webmanifest",
  applicationName: "Tho'am Partner",
};

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
