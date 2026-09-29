import { NextResponse } from "next/server";
import { verifyOtpCode, upsertUser, getUserByEmail } from "@/lib/db";
import { signSessionToken, COOKIE_NAME, getSessionCookieOptions } from "@/lib/auth/jwt";

export async function POST(request) {
  try {
    const { email, code } = await request.json();

    if (!email || !code) {
      return NextResponse.json(
        { error: "Email and verification code are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanCode = String(code).trim();

    // 1. Verify OTP
    const verification = await verifyOtpCode({ email: cleanEmail, code: cleanCode });
    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Invalid verification code." },
        { status: 400 }
      );
    }

    // 2. Fetch or create user in custom database
    let user = await getUserByEmail(cleanEmail);
    if (!user) {
      user = await upsertUser({
        email: cleanEmail,
        name: cleanEmail.split("@")[0],
      });
    }

    // 3. Generate JWT session token
    const token = await signSessionToken({
      userId: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
    });

    // 4. Set secure HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      message: "Authentication successful",
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar_url: user.avatar_url,
      },
    });

    response.cookies.set(COOKIE_NAME, token, getSessionCookieOptions(false));

    return response;
  } catch (error) {
    console.error("OTP verify error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify code." },
      { status: 500 }
    );
  }
}
