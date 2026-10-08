import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getBootstrapState } from "@/lib/crm/session";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { APP_NAME, APP_TAGLINE } from "@/lib/crm/constants";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const bootstrap = useQuery({
    queryKey: ["bootstrap"],
    queryFn: () => getBootstrapState(),
  });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ownerExists = bootstrap.data?.ownerExists === true;
  const showSignup = !ownerExists && mode === "signup";

  const emailAuth = useMutation({
    mutationFn: async () => {
      setError(null);
      if (showSignup) {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name.trim() || "Owner",
        });
        if (err) throw new Error(err.message ?? "Could not create account");
        await authClient.getSession();
        window.location.href = "/";
        return;
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
        if (err) throw new Error(err.message ?? "Invalid email or password");
        await authClient.getSession();
        window.location.href = "/";
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink">
        <div className="h-10 w-40 animate-pulse rounded-md bg-white/10" />
      </main>
    );
  }
  if (user) return <Navigate to="/" />;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-ink text-accent-fg lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="pointer-events-none absolute inset-0 opacity-40">
          <div className="absolute -left-24 top-20 h-80 w-80 rounded-full bg-accent/40 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-full bg-gradient-to-t from-black/40 to-transparent" />
        </div>
        <div className="relative">
          <img src="/logo.png" alt="" className="mb-6 size-20 rounded-2xl" />
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/60">
            Hero MotoCorp dealer
          </p>
          <h1 className="mt-4 font-display text-6xl leading-none text-white">{APP_NAME}</h1>
          <p className="mt-3 max-w-md text-base text-white/70">{APP_TAGLINE}</p>
        </div>
        <ul className="relative space-y-3 text-sm text-white/75">
          <li>Track every walk-in, phone and online lead</li>
          <li>Follow-ups for today, overdue and upcoming</li>
          <li>Owner reports with staff-level access control</li>
        </ul>
      </section>

      <section className="flex items-center justify-center bg-bg px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <img src="/logo.png" alt="" className="mb-3 size-16 rounded-2xl" />
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Hero MotoCorp dealer
            </p>
            <h1 className="mt-1 font-display text-4xl text-ink">{APP_NAME}</h1>
            <p className="text-sm text-muted">{APP_TAGLINE}</p>
          </div>

          <h2 className="font-display text-3xl text-ink">
            {showSignup ? "Create owner account" : "Sign in"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {showSignup
              ? "This is the first account and becomes the showroom owner."
              : "Owner: sign in with Google. Staff use the email the owner created."}
          </p>

          {authEnabled ? (
            <div className="mt-6 space-y-3">
              {GROK_PROVIDERS.map((p) => (
                <Button
                  key={p.providerId}
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setError(null);
                    void signIn(p.providerId, { callbackURL: "/" }).catch((e: unknown) => {
                      setError(e instanceof Error ? e.message : "Google sign-in failed");
                    });
                  }}
                >
                  Continue with {p.label}
                </Button>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Sign-in is disabled.</p>
          )}

          <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted">
            <span className="h-px flex-1 bg-line" />
            Email
            <span className="h-px flex-1 bg-line" />
          </div>

          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              emailAuth.mutate();
            }}
          >
            {showSignup ? (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={showSignup ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </div>
            {error ? <p className="text-sm text-lost">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={emailAuth.isPending}>
              {emailAuth.isPending ? "Please wait…" : showSignup ? "Create owner account" : "Sign in"}
            </Button>
          </form>

          {!ownerExists ? (
            <button
              type="button"
              className="mt-4 text-sm text-accent"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            >
              {mode === "signin" ? "First time? Create the owner account" : "Already have an account? Sign in"}
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}
