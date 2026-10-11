"use server";
import { notFound, redirect } from "next/navigation";
import { requestPasswordReset } from "@adash/site-auth";
import { trustedTenantRequest } from "../../lib/trusted-origin";
import { sendPasswordResetEmail } from "../../lib/password-reset-email";

export async function requestReset(form: FormData) {
  const context = await trustedTenantRequest(true);
  if (!context) notFound();
  await requestPasswordReset({ tenantId: context.tenant.id, email: String(form.get("email") ?? ""), origin: context.origin, sendEmail: sendPasswordResetEmail });
  redirect("/forgot-password?sent=1");
}
