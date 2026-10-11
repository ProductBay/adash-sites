import { revokeSession, SESSION_COOKIE } from "@adash/site-auth";
import { type NextRequest, NextResponse } from "next/server";
import { validatedOrigin } from "../../../lib/trusted-origin";

export async function POST(request: NextRequest) {
  const requestOrigin = request.headers.get("origin");
  if (!requestOrigin) return new NextResponse("Invalid request", { status: 400 });
  const origin = validatedOrigin({ host: request.headers.get("host"), origin: requestOrigin, forwardedProto: request.headers.get("x-forwarded-proto"), production: process.env.NODE_ENV === "production" });
  if (!origin) return new NextResponse("Invalid request", { status: 400 });

  await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.redirect(new URL("/login", origin), 303);
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
