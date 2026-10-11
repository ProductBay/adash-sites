import { resolveTenant } from "@adash/site-core";
import { revokeSession, signIn, tenantPrincipal, SESSION_COOKIE, SESSION_SECONDS } from "@adash/site-auth";
import { type NextRequest, NextResponse } from "next/server";
import { validatedOrigin } from "../../../lib/trusted-origin";

function redirectTo(origin: string, path: string) {
  return NextResponse.redirect(new URL(path, origin), 303);
}

export async function POST(request: NextRequest) {
  const host = request.headers.get("host");
  const origin = validatedOrigin({ host, origin: request.headers.get("origin"), forwardedProto: request.headers.get("x-forwarded-proto"), production: process.env.NODE_ENV === "production" });
  const tenant = origin && await resolveTenant(host, undefined, true);
  if (!origin || !tenant) return new NextResponse("Invalid request", { status: 400 });

  const form = await request.formData();
  const token = await signIn(String(form.get("email") ?? ""), String(form.get("password") ?? ""));
  if (!token) return redirectTo(origin, "/login?error=credentials");

  if (!await tenantPrincipal(token, tenant.id)) {
    await revokeSession(token);
    return redirectTo(origin, "/login?error=access");
  }

  const response = redirectTo(origin, "/dashboard");
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_SECONDS });
  return response;
}
