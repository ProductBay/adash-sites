import Link from "next/link";
import { notFound } from "next/navigation";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "@adash/site-auth";
import { trustedTenantRequest } from "../../lib/trusted-origin";
import { requestReset } from "./actions";

export const dynamic = "force-dynamic";
export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const context = await trustedTenantRequest();
  if (!context) notFound();
  const sent = (await searchParams).sent === "1";
  return <main className="login"><p className="eyebrow">A’Dash Sites</p><h1>Reset your password</h1><p>Enter the email address used for your {context.tenant.name} admin account.</p>{sent ? <p role="status" className="notice">{PASSWORD_RESET_GENERIC_MESSAGE}</p> : <form action={requestReset}><label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label><button>Send reset link</button></form>}<p><Link href="/login">Back to sign in</Link></p></main>;
}
