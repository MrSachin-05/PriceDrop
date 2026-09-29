import { NextResponse } from "next/server";
import { upsertUser } from "@/lib/db";
import { signSessionToken, COOKIE_NAME } from "@/lib/auth/jwt";

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(new URL("/?auth_error=" + encodeURIComponent(error || "OAuth failed"), origin));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/google/callback`;

  try {
    // 1. Exchange code for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      throw new Error(tokenData.error_description || tokenData.error || "Failed to exchange code");
    }

    // 2. Fetch user profile from Google
    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await profileResponse.json();
    if (!profile.email) {
      throw new Error("Could not retrieve email from Google account");
    }

    // 3. Upsert user in our custom database
    const user = await upsertUser({
      email: profile.email,
      name: profile.name || profile.given_name || profile.email.split("@")[0],
      avatar_url: profile.picture || "",
    });

    // 4. Create JWT session token
    const sessionToken = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
    });

    // 5. Set session cookie and redirect home
    const response = NextResponse.redirect(new URL("/", origin));
    response.cookies.set(COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return response;
  } catch (err) {
    console.error("Google auth callback error:", err);
    return NextResponse.redirect(new URL("/?auth_error=" + encodeURIComponent(err.message), origin));
  }
}
