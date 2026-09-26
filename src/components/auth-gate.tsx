import { useQuery } from "@tanstack/react-query";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getSessionInfo } from "@/lib/crm/session";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import type { SessionInfo } from "@/lib/crm/types";
import type { ReactNode } from "react";

export function useCrmSession() {
  const { user, isPending } = useCurrentUserState();
  const session = useQuery({
    queryKey: ["crm-session", user?.id],
    queryFn: () => getSessionInfo(),
    enabled: Boolean(user),
    retry: false,
  });
  return { user, isPending, session };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "This Google/X account is not on the showroom team yet.";
}

export function Authenticated({
  children,
  ownerOnly,
}: {
  children: (session: SessionInfo) => ReactNode;
  ownerOnly?: boolean;
}) {
  const { user, isPending, session } = useCrmSession();

  if (isPending) return <BootSkeleton />;
  if (!user) return <RedirectToSignIn />;
  if (session.isPending) return <BootSkeleton />;
  if (session.isError) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-6 text-center">
        <div className="max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            BALAJI AUTOMOBILES
          </p>
          <h1 className="mt-2 font-display text-3xl text-ink">Couldn’t open the CRM</h1>
          <p className="mt-2 text-sm text-muted">{errorMessage(session.error)}</p>
          <p className="mt-3 text-sm text-muted">
            Sign in again with Google. The first Google login becomes the owner.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button type="button" variant="outline" onClick={() => session.refetch()}>
              Try again
            </Button>
            <Button type="button" onClick={() => signOut("/login")}>
              Sign out
            </Button>
          </div>
        </div>
      </main>
    );
  }
  const data = session.data!;
  if (ownerOnly && data.profile.role !== "owner") {
    return (
      <AppShell session={data}>
        <div className="rounded-xl border border-line bg-surface p-8 text-center">
          <h1 className="font-display text-2xl">Owner only</h1>
          <p className="mt-2 text-sm text-muted">
            Staff cannot open reports, audit history, staff management or showroom settings.
          </p>
        </div>
      </AppShell>
    );
  }
  return <AppShell session={data}>{children(data)}</AppShell>;
}

function BootSkeleton() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg p-6">
      <div className="w-full max-w-md text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          Hero MotoCorp dealer
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink">BALAJI AUTOMOBILES</h1>
        <p className="mt-2 text-sm text-muted">Sales Enquiry & Customer CRM</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      </div>
    </div>
  );
}