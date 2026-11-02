"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Store, Trophy, ClipboardList } from "lucide-react";

const items = [
  { label: "Home", href: "/", icon: Home },
  { label: "Restaurants", href: "/restaurants", icon: Store },
  { label: "Challenges", href: null, icon: Trophy },
  { label: "My Orders", href: "/my-orders", icon: ClipboardList },
];

export default function MobileBottomNav() {
  const pathname = usePathname();

  // Keep this navigation exclusive to customer-facing pages.
  if (
    pathname.startsWith("/restaurant-admin") ||
    pathname.startsWith("/owner") ||
    pathname.startsWith("/restaurant-registration") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/menu/") ||
    pathname.startsWith("/qr/")
  ) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    if (href === "/restaurants") return pathname === "/restaurants" || pathname.startsWith("/restaurants/");
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="thoam-bottom-nav" aria-label="Customer navigation">
      {items.map(({ label, href, icon: Icon }) =>
        href ? (
          <Link
            key={label}
            href={href}
            className={`thoam-bottom-nav__item ${isActive(href) ? "is-active" : ""}`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <span className="thoam-bottom-nav__icon"><Icon size={20} strokeWidth={isActive(href) ? 2.2 : 1.8} /></span>
            <span className="thoam-bottom-nav__label">{label}</span>
          </Link>
        ) : (
          <div key={label} className="thoam-bottom-nav__item is-coming-soon" aria-disabled="true" title="Coming soon">
            <span className="thoam-bottom-nav__icon"><Icon size={20} strokeWidth={1.8} /></span>
            <span className="thoam-bottom-nav__label">{label}</span>
            <span className="thoam-bottom-nav__soon">Soon</span>
          </div>
        )
      )}
    </nav>
  );
}
