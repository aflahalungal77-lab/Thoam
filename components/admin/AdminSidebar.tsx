"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

const links = [
  { href: "/thoam-admin", label: "Overview", icon: LayoutDashboard },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  return (
    <>
      <aside className="thoam-admin-side">
        <div className="thoam-admin-side-brand">THO’AM <span>ADMIN</span></div>
        <div className="thoam-admin-side-label">WORKSPACE</div>
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/thoam-admin" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} className={active ? "thoam-admin-side-link active" : "thoam-admin-side-link"}>
            <Icon size={17} /> <span>{label}</span>
          </Link>;
        })}
      </aside>
      <style jsx global>{`
        .thoam-admin-side{position:fixed;z-index:80;left:0;top:76px;bottom:0;width:226px;padding:25px 16px;background:#101010;color:#fff}
        .thoam-admin-side-brand{font-size:15px;font-weight:900;letter-spacing:.12em;padding:0 12px 28px}
        .thoam-admin-side-brand span{display:block;margin-top:5px;color:#8f8f8f;font-size:9px;letter-spacing:.2em}
        .thoam-admin-side-label{padding:0 12px 12px;color:#777;font-size:9px;font-weight:800;letter-spacing:.16em}
        .thoam-admin-side-link{display:flex;align-items:center;gap:12px;padding:13px 12px;margin:4px 0;border-radius:10px;color:#aaa;text-decoration:none;font-size:13px;font-weight:650}
        .thoam-admin-side-link.active{background:#fff;color:#111}
        .admin-container{margin-left:226px!important}
        @media(max-width:760px){.thoam-admin-side{position:static;display:flex;align-items:center;gap:7px;width:auto;height:auto;padding:10px 14px;overflow-x:auto}.thoam-admin-side-brand{display:none}.thoam-admin-side-label{display:none}.thoam-admin-side-link{flex:0 0 auto;margin:0;padding:10px 12px}.admin-container{margin-left:auto!important}}
      `}</style>
    </>
  );
}
