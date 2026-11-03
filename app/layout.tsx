import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./mobile-bottom-nav.css";
import ServiceWorker from "@/components/ServiceWorker";
import MobileBottomNav from "@/components/MobileBottomNav";
export const metadata: Metadata = { title: "Tho'am — Good food, closer to you", description: "Discover local restaurants, order food, and explore QR menus with Tho'am.", applicationName: "Tho'am", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, statusBarStyle: "default", title: "Tho'am" }, icons: { icon: "/logo.png", apple: "/icon.svg" } };
export const viewport: Viewport = { themeColor: "#111111", width: "device-width", initialScale: 1 };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><ServiceWorker/>{children}<MobileBottomNav/></body></html>}
