"use server";
import { notFound, redirect } from "next/navigation";
import { resetPassword } from "@adash/site-auth";
import { trustedTenantRequest } from "../../lib/trusted-origin";

export async function completeReset(form: FormData) {
  const context = await trustedTenantRequest(true);
  if (!context) notFound();
  const token = String(form.get("token") ?? "");
  const result = await resetPassword({ tenantId: context.tenant.id, token, password: String(form.get("password") ?? ""), confirmPassword: String(form.get("confirmPassword") ?? "") });
  if (result.success) redirect("/login?reset=success");
  redirect(`/reset-password?token=${encodeURIComponent(token)}&error=${result.error}`);
}
