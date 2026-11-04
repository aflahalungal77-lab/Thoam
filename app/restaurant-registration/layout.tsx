import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { absolute: "Restaurant registration | Tho'am" },
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function PrivateRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
