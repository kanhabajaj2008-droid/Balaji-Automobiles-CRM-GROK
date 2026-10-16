import { type ReactNode, useEffect, useState } from "react";
import { recordCaptureAttempt } from "@/lib/crm/session";
import type { SessionInfo } from "@/lib/crm/types";

function stamp(name: string) {
  const now = new Date();
  const time = now.toLocaleString("en-IN", { hour12: false });
  return `${name} · ${time}`;
}

export function StaffCaptureGuard({
  session,
  children,
}: {
  session: SessionInfo;
  children: ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const [mark, setMark] = useState(() => stamp(session.profile.full_name));

  useEffect(() => {
    if (session.profile.role === "owner") return;

    const name = session.profile.full_name;
    let lastLog = 0;

    function conceal() {
      setHidden(true);
    }
    function reveal() {
      if (document.visibilityState === "visible") setHidden(false);
    }
    function logAttempt() {
      const now = Date.now();
      if (now - lastLog < 20_000) return;
      lastLog = now;
      void recordCaptureAttempt().catch(() => undefined);
    }
    function onKey(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      const shot =
        key === "printscreen" ||
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (key === "s" || key === "3" || key === "4" || key === "5"));
      if (!shot) return;
      e.preventDefault();
      conceal();
      logAttempt();
      window.setTimeout(reveal, 1500);
    }
    function onHide() {
      if (document.visibilityState !== "visible") conceal();
      else reveal();
    }
    function block(e: Event) {
      e.preventDefault();
    }

    const clock = window.setInterval(() => setMark(stamp(name)), 30_000);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", conceal);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("contextmenu", block);
    document.addEventListener("copy", block);
    document.addEventListener("cut", block);

    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    document.body.style.setProperty("-webkit-touch-callout", "none");
    document.body.style.setProperty("-webkit-user-select", "none");

    return () => {
      window.clearInterval(clock);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", conceal);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("copy", block);
      document.removeEventListener("cut", block);
      document.body.style.userSelect = prevSelect;
      document.body.style.removeProperty("-webkit-touch-callout");
      document.body.style.removeProperty("-webkit-user-select");
    };
  }, [session.profile.full_name, session.profile.role]);

  if (session.profile.role === "owner") return children;

  return (
    <div className="staff-guard relative">
      {children}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[70] overflow-hidden opacity-[0.13]"
      >
        <div className="absolute left-1/2 top-1/2 grid w-[160%] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] grid-cols-2 gap-16">
          {Array.from({ length: 18 }).map((_, i) => (
            <p key={i} className="whitespace-nowrap text-sm font-semibold uppercase tracking-wide text-ink">
              {mark}
            </p>
          ))}
        </div>
      </div>
      {hidden ? (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink px-6 text-center text-accent-fg">
          <div>
            <p className="font-display text-3xl">Screen hidden</p>
            <p className="mt-2 text-sm text-white/70">Come back to {session.profile.full_name}'s session to continue.</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
