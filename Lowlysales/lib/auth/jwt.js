import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "auth_session";

function getSecretKey() {
  const secret = process.env.AUTH_SECRET || "price-drop-secure-auth-secret-key-32-chars-minimum-token!";
  return new TextEncoder().encode(secret);
}

export function getSessionCookieOptions(isClear = false) {
  const isHttps = process.env.NEXT_PUBLIC_APP_URL?.startsWith("https");
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" && Boolean(isHttps),
    sameSite: "lax",
    path: "/",
    maxAge: isClear ? 0 : 30 * 24 * 60 * 60, // 30 days or immediate expiry
  };
}

export { COOKIE_NAME };

export async function signSessionToken(payload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token) {
  try {
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload;
  } catch (error) {
    return null;
  }
}
