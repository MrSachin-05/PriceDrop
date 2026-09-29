import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  // Forward to our manual Google OAuth callback
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  const forwardUrl = new URL("/api/auth/google/callback", origin);
  if (code) forwardUrl.searchParams.set("code", code);
  if (error) forwardUrl.searchParams.set("error", error);

  return NextResponse.redirect(forwardUrl);
}
