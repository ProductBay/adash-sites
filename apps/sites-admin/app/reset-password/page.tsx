import Link from "next/link";
import { notFound } from "next/navigation";
import { trustedTenantRequest } from "../../lib/trusted-origin";
import { completeReset } from "./actions";

const messages: Record<string, string> = { invalid: "This reset link is invalid.", expired: "This reset link has expired. Request a new one.", used: "This reset link has already been used. Request a new one if needed.", mismatch: "The passwords do not match.", weak: "Password must contain 12–256 characters." };
export const dynamic = "force-dynamic";
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const context = await trustedTenantRequest();
  if (!context) notFound();
  const { token = "", error = "" } = await searchParams;
  const malformed = !/^[A-Za-z0-9_-]{43}$/.test(token);
  return <main className="login"><p className="eyebrow">A’Dash Sites</p><h1>Choose a new password</h1><p>Update the password for your {context.tenant.name} admin account.</p>{(malformed || error) && <p role="alert" className="notice">{malformed ? messages.invalid : messages[error] ?? messages.invalid}</p>}{!malformed && <form action={completeReset}><input type="hidden" name="token" value={token} /><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /><small className="field-help">Use 12–256 characters.</small></label><label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={256} required /></label><button>Update password</button></form>}<p>{malformed || ["invalid", "expired", "used"].includes(error) ? <Link href="/forgot-password">Request another reset link</Link> : <Link href="/login">Back to sign in</Link>}</p></main>;
}
