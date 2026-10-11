"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavigationLink = { href: string; label: string };
type Props = { tenantName: string; email: string; role: string; links: NavigationLink[]; logout: () => Promise<void> };

function isActiveRoute(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationLinks({ links, pathname, onNavigate }: { links: NavigationLink[]; pathname: string; onNavigate?: () => void }) {
  return <nav aria-label="Dashboard">{links.map(({ href, label }) => {
    const active = isActiveRoute(pathname, href);
    return <Link key={href} href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined} onClick={onNavigate}>{label}</Link>;
  })}</nav>;
}

function Account({ email, role, logout }: Pick<Props, "email" | "role" | "logout">) {
  return <div className="account"><small>{email} · {role.replaceAll("_", " ")}</small><form action={logout}><button className="text-button">Log out</button></form></div>;
}

export function AdminNavigation({ tenantName, email, role, links, logout }: Props) {
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  function closeDrawer() { dialogRef.current?.close(); }
  function openDrawer() { dialogRef.current?.showModal(); setOpen(true); document.body.classList.add("mobile-nav-open"); }
  useEffect(() => () => document.body.classList.remove("mobile-nav-open"), []);

  return <>
    <aside className="sidebar desktop-sidebar">
      <Link className="brandmark" href="/dashboard">A’DASH <span>SITES</span></Link><p>{tenantName}</p>
      <NavigationLinks links={links} pathname={pathname} /><Account email={email} role={role} logout={logout} />
    </aside>
    <header className="mobile-admin-header">
      <Link className="brandmark" href="/dashboard">A’DASH <span>SITES</span></Link><span className="mobile-tenant-name">{tenantName}</span>
      <button ref={menuButtonRef} className="menu-button" type="button" aria-label="Open navigation" aria-haspopup="dialog" aria-controls="mobile-admin-navigation" aria-expanded={open} onClick={openDrawer}><span aria-hidden="true">☰</span></button>
    </header>
    <dialog ref={dialogRef} id="mobile-admin-navigation" className="mobile-nav-dialog" aria-labelledby="mobile-nav-title" onClick={(event) => { if (event.target === event.currentTarget) closeDrawer(); }} onClose={() => { setOpen(false); document.body.classList.remove("mobile-nav-open"); menuButtonRef.current?.focus(); }}>
      <div className="mobile-nav-panel">
        <div className="mobile-nav-heading"><div><span id="mobile-nav-title" className="brandmark">A’DASH <span>SITES</span></span><p>{tenantName}</p></div><button className="menu-close" type="button" aria-label="Close navigation" onClick={closeDrawer}>×</button></div>
        <NavigationLinks links={links} pathname={pathname} onNavigate={closeDrawer} /><Account email={email} role={role} logout={logout} />
      </div>
    </dialog>
  </>;
}
