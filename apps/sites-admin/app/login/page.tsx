import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { resolveTenant } from "@adash/site-core";
import { signIn, tenantPrincipal, SESSION_COOKIE, SESSION_SECONDS } from "@adash/site-auth";
import Link from "next/link";

async function login(form: FormData) {
  "use server";
  const tenant = await resolveTenant((await headers()).get("host"), undefined, true);
  if (!tenant) notFound();
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const host = requestHeaders.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new Error("Invalid request origin");
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const token = await signIn(email, password);
  if (!token) redirect("/login?error=credentials");
  const principal = await tenantPrincipal(token, tenant.id);
  if (!principal) { const { revokeSession } = await import("@adash/site-auth"); await revokeSession(token); redirect("/login?error=access"); }
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
  redirect("/dashboard");
}

export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const tenant = await resolveTenant((await headers()).get("host"), undefined, true);
  if (!tenant) notFound();
  if (await tenantPrincipal((await cookies()).get(SESSION_COOKIE)?.value, tenant.id)) redirect("/dashboard");
  const { error, reset } = await searchParams;
  return <main className="login"><p className="eyebrow">A’Dash Sites</p><h1>Welcome back to {tenant.name}</h1><p>Sign in to manage your business.</p>{reset === "success" && <p role="status" className="notice">Your password has been updated. Sign in with your new password.</p>}{error && <p role="alert">{error === "access" ? "This account does not have access to this business." : "Email or password not recognized."}</p>}<form action={login}><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button>Sign in</button></form><p><Link href="/forgot-password">Forgot password?</Link></p></main>;
}
