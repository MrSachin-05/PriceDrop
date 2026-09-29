import { NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/auth/jwt";

export async function POST(request) {
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(new URL("/", origin));

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}

export async function GET(request) {
  return POST(request);
}
