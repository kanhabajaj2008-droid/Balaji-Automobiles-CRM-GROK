import { Link, useRouterState } from "@tanstack/react-router";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  PhoneCall,
  Settings,
  Shield,
  Users,
  BarChart3,
} from "lucide-react";
import { type ReactNode } from "react";
import { UserButton } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { hasGateSessionMarker } from "@/lib/auth/gate-session-marker";
import { recordLogout } from "@/lib/crm/session";
import type { SessionInfo } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/lib/crm/constants";

type Item = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  ownerOnly?: boolean;
  mobile?: boolean;
};

const NAV: Item[] = [
  { to: "/", label: "Home", icon: LayoutDashboard, mobile: true },
  { to: "/enquiries", label: "Enquiries", icon: ClipboardList, mobile: true },
  { to: "/follow-ups", label: "Follow-ups", icon: PhoneCall, mobile: true },
  { to: "/reports", label: "Reports", icon: BarChart3, ownerOnly: true },
  { to: "/staff", label: "Staff", icon: Users, ownerOnly: true },
  { to: "/audit", label: "Audit", icon: Shield, ownerOnly: true },
  { to: "/settings", label: "Settings", icon: Settings, ownerOnly: true, mobile: true },
];

export function AppShell({
  session,
  children,
}: {
  session: SessionInfo;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isOwner = session.profile.role === "owner";
  const items = NAV.filter((i) => !i.ownerOnly || isOwner);
  const mobileItems = items.filter((i) => i.mobile || !i.ownerOnly).slice(0, 4);
  if (isOwner && !mobileItems.find((i) => i.to === "/settings")) {
    mobileItems.push(NAV.find((i) => i.to === "/settings")!);
  }

  return (
    <div className="min-h-dvh bg-bg">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="border-b border-line px-4 py-4">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="" className="size-12 rounded-xl" />
            <div className="min-w-0">
              <p className="font-display text-xl leading-none text-ink">{APP_NAME}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
                Hero MotoCorp
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            {session.profile.full_name} · {isOwner ? "Owner" : "Staff"}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {items.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                  active ? "bg-ink text-accent-fg" : "text-ink-soft hover:bg-surface-2",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line p-4">
          <SignOutRow />
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <img src="/logo.png" alt="" className="size-9 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg leading-none text-ink">{APP_NAME}</p>
            <p className="text-[11px] text-muted">{isOwner ? "Owner" : "Staff"}</p>
          </div>
        </div>
        <UserButton />
      </header>

      <div className="lg:pl-60">
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-4 lg:px-8 lg:pb-10 lg:pt-8">{children}</div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
        {(isOwner ? items.filter((i) => ["/", "/enquiries", "/follow-ups", "/reports"].includes(i.to)) : items.slice(0, 4)).map(
          (item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-accent" : "text-muted",
                )}
              >
                <Icon className="size-5" />
                {item.label}
              </Link>
            );
          },
        )}
      </nav>
    </div>
  );
}

function SignOutRow() {
  const gate = typeof window !== "undefined" && hasGateSessionMarker();
  if (gate) {
    return (
      <div className="text-xs text-muted">
        Signed in with Grok
      </div>
    );
  }
  return (
    <button
      type="button"
      className="flex h-10 w-full items-center gap-2 rounded-md px-2 text-sm text-ink-soft hover:bg-surface-2"
      onClick={async () => {
        try {
          await recordLogout();
        } catch {
          /* still sign out */
        }
        await signOut("/login");
      }}
    >
      <LogOut className="size-4" />
      Sign out
    </button>
  );
}
