import { NextResponse } from "next/server";

export async function GET(request) {
  const { origin } = new URL(request.url);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    // If Google OAuth credentials aren't configured yet, redirect with explanation
    return NextResponse.redirect(
      new URL("/?auth_error=" + encodeURIComponent("Google Client ID not configured in .env.local"), request.url)
    );
  }

  const redirectUri = `${origin}/api/auth/google/callback`;
  const scope = encodeURIComponent("openid email profile");
  const state = Math.random().toString(36).substring(7);

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;

  return NextResponse.redirect(googleAuthUrl);
}
