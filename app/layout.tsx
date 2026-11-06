import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile-bottom-nav.css";
import ServiceWorker from "@/components/ServiceWorker";
import MobileBottomNav from "@/components/MobileBottomNav";
import { LanguageProvider } from "@/components/LanguageProvider";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import "@/components/LanguageGlobalStyles.css";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://thoam.vercel.app").replace(/\/+$/, "");

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${siteUrl}/#organization`,
    name: "Tho'am",
    url: siteUrl,
    logo: `${siteUrl}/logo.png`,
    description:
      "A local food discovery and ordering platform connecting customers with restaurants in Malappuram, Kerala.",
    areaServed: {
      "@type": "City",
      name: "Malappuram",
      containedInPlace: {
        "@type": "State",
        name: "Kerala",
      },
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: "Tho'am",
    url: siteUrl,
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: "en-IN",
  },
];

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Tho'am | Online Food Ordering in Malappuram",
    template: "%s | Tho'am",
  },
  description:
    "Discover local restaurants in Malappuram, explore digital menus and order your favourite food with Tho'am. Enjoy online and QR-based dine-in ordering.",
  applicationName: "Tho'am",
  verification: {
    google: "zDWb1KzchDqxqok1Hd_yvosImkSxDO8hPIDG7kZPPho",
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Tho'am",
  },
  icons: {
    icon: "/logo.png",
    apple: "/icon.svg",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "Tho'am",
    locale: "en_IN",
    title: "Tho'am | Online Food Ordering in Malappuram",
    description:
      "Discover local restaurants in Malappuram, explore digital menus and order your favourite food with Tho'am.",
  },
  twitter: {
    card: "summary",
    title: "Tho'am | Online Food Ordering in Malappuram",
    description:
      "Discover local restaurants in Malappuram, explore digital menus and order your favourite food with Tho'am.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>
        <ServiceWorker />
        {children}
        <MobileBottomNav />
      </body>
    </html>
  );
}
