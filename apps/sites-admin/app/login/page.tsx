import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { resolveTenant } from "@adash/site-core";
import { tenantPrincipal, SESSION_COOKIE } from "@adash/site-auth";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; reset?: string }> }) {
  const tenant = await resolveTenant((await headers()).get("host"), undefined, true);
  if (!tenant) notFound();
  if (await tenantPrincipal((await cookies()).get(SESSION_COOKIE)?.value, tenant.id)) redirect("/dashboard");
  const { error, reset } = await searchParams;
  return <main className="login"><p className="eyebrow">A’Dash Sites</p><h1>Welcome back to {tenant.name}</h1><p>Sign in to manage your business.</p>{reset === "success" && <p role="status" className="notice">Your password has been updated. Sign in with your new password.</p>}{error && <p role="alert">{error === "access" ? "This account does not have access to this business." : "Email or password not recognized."}</p>}<form action="/auth/login" method="post"><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label><button>Sign in</button></form><p><Link href="/forgot-password">Forgot password?</Link></p></main>;
}
