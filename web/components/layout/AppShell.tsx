"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { appNav } from "@/lib/navigation";

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {appNav.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              active
                ? "bg-primary-soft text-primary"
                : "text-muted hover:bg-primary-soft hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AccountBox() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  if (!user) return null;
  return (
    <div className="mt-6 border-t border-border pt-4 text-sm">
      <p className="truncate text-muted" title={user.email ?? ""}>
        {user.email}
      </p>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.replace("/login");
        }}
        className="mt-2 rounded-md border border-border px-3 py-1.5 hover:bg-primary-soft"
      >
        Log out
      </button>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/" className="block text-base font-semibold text-primary">
      Tobacco FL Diagnosis
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-background">
        Skip to content
      </a>
      {/* Desktop / tablet sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface p-4 md:block">
        <div className="mb-6">
          <Brand />
        </div>
        <NavLinks />
        <AccountBox />
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 md:hidden">
        <Brand />
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-border px-3 py-1.5 text-sm"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="border-b border-border bg-surface p-4 md:hidden">
          <NavLinks onNavigate={() => setOpen(false)} />
          <AccountBox />
        </div>
      )}

      <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
