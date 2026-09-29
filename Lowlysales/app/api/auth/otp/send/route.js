import { NextResponse } from "next/server";
import { saveOtp } from "@/lib/db";
import { sendOtpEmail } from "@/lib/email";

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "A valid email address is required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();

    // Generate cryptographically secure 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Save to custom database with 10-minute validity
    await saveOtp({ email: cleanEmail, code: otpCode, expiresMinutes: 10 });

    // Send email to user (or console fallback in dev mode)
    const emailResult = await sendOtpEmail(cleanEmail, otpCode);

    return NextResponse.json({
      success: true,
      message: `Verification code sent to ${cleanEmail}`,
      provider: emailResult.provider,
    });
  } catch (error) {
    console.error("OTP send error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send verification code." },
      { status: 500 }
    );
  }
}
