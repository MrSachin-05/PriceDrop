"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
} from "lucide-react";

export default function AuthModal({ isOpen, onClose }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =====================================================
  // GOOGLE LOGIN (MANUAL OAUTH 2.0 FLOW)
  // =====================================================
  const handleGoogleLogin = () => {
    setError("");
    setSuccess("");
    setLoading(true);
    window.location.href = "/api/auth/google";
  };

  // =====================================================
  // SEND EMAIL OTP (MANUAL IN-HOUSE ENGINE)
  // =====================================================
  const handleSendOtp = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");

    const cleanEmail = email.trim();

    if (!cleanEmail) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to send verification code.");
        return;
      }

      setOtpSent(true);
      setOtp("");
      setResendTimer(60);
      setSuccess(`Verification code sent to ${cleanEmail}.`);
    } catch (err) {
      setError(err.message || "Failed to send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // VERIFY EMAIL OTP (STEP-BY-STEP AUTH)
  // =====================================================
  const handleVerifyOtp = async (e) => {
    if (e?.preventDefault) e.preventDefault();

    setError("");
    setSuccess("");

    const cleanEmail = email.trim();
    const cleanOtp = otp.trim();

    if (!cleanOtp) {
      setError("Please enter the verification code.");
      return;
    }

    if (cleanOtp.length !== 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: cleanOtp }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "OTP verification failed.");
        return;
      }

      setSuccess("Email verified successfully! Logging you in...");

      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (err) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // RESEND OTP
  // =====================================================
  const handleResendOtp = async () => {
    if (resendTimer > 0 || loading) {
      return;
    }

    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Failed to resend OTP.");
        return;
      }

      setOtp("");
      setResendTimer(60);
      setSuccess("A new verification code has been sent.");
    } catch (err) {
      setError(err.message || "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  // =====================================================
  // OTP COUNTDOWN
  // =====================================================
  useEffect(() => {
    if (resendTimer <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendTimer((current) => {
        if (current <= 1) {
          clearInterval(timer);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [resendTimer]);

  // =====================================================
  // RESET MODAL
  // =====================================================
  const resetModal = () => {
    setEmail("");
    setOtp("");
    setOtpSent(false);
    setLoading(false);
    setResendTimer(0);
    setError("");
    setSuccess("");
  };

  // =====================================================
  // CHANGE EMAIL
  // =====================================================
  const handleChangeEmail = () => {
    if (loading) {
      return;
    }

    setOtp("");
    setOtpSent(false);
    setResendTimer(0);
    setError("");
    setSuccess("");
  };

  // =====================================================
  // CLOSE MODAL
  // =====================================================
  const handleClose = (open) => {
    if (!open && !loading) {
      resetModal();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className="
          sm:max-w-md
          bg-neutral-950/95
          border-white/15
          text-white
          backdrop-blur-xl
          shadow-[0_0_50px_rgba(0,0,0,0.7)]
        "
      >
        {/* =================================================
            EMAIL LOGIN SCREEN
        ================================================= */}
        {!otpSent && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white">
                Sign in to continue
              </DialogTitle>

              <DialogDescription className="text-white/60">
                Track product prices and get alerts on price drops
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-5 py-4">
              {/* GOOGLE LOGIN */}
              <Button
                onClick={handleGoogleLogin}
                variant="outline"
                disabled={loading}
                className="
                  w-full
                  gap-2
                  h-12
                  bg-white
                  text-black
                  border-white
                  font-bold
                  rounded-xl
                  transition-all
                  duration-300
                  hover:bg-white
                  hover:text-black
                  hover:scale-[1.02]
                  hover:shadow-[0_0_25px_rgba(255,255,255,0.35)]
                  disabled:opacity-50
                "
                size="lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />

                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />

                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />

                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>

                Continue with Google
              </Button>

              {/* DIVIDER */}
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/15" />

                <span className="text-xs font-medium text-white/40">
                  OR
                </span>

                <div className="h-px flex-1 bg-white/15" />
              </div>

              {/* EMAIL */}
              <form
                onSubmit={handleSendOtp}
                className="flex flex-col gap-4"
              >
                <div>
                  <label className="text-sm font-bold text-white/80 mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-orange-400" />
                    Email address
                  </label>

                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    placeholder="you@example.com"
                    disabled={loading}
                    autoComplete="email"
                    required
                    className="
                      h-12
                      bg-black/60
                      text-white
                      border-white/20
                      placeholder:text-white/35
                      font-medium
                      rounded-xl

                      focus:border-white
                      focus:ring-2
                      focus:ring-white/20
                      focus:shadow-[0_0_20px_rgba(255,255,255,0.15)]

                      hover:border-white/40

                      transition-all
                      duration-300
                    "
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="
                    w-full
                    h-12
                    bg-orange-500
                    hover:bg-orange-600
                    text-white
                    font-black
                    rounded-xl

                    transition-all
                    duration-300

                    hover:scale-[1.02]
                    hover:shadow-[0_0_25px_rgba(249,115,22,0.5)]

                    active:scale-95

                    disabled:opacity-50
                    disabled:hover:scale-100
                    disabled:hover:shadow-none
                  "
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Sending OTP...
                    </>
                  ) : (
                    "Send OTP"
                  )}
                </Button>
              </form>

              {/* ERROR */}
              {error && (
                <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* SUCCESS */}
              {success && (
                <div className="rounded-lg border border-green-400/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  {success}
                </div>
              )}
            </div>
          </>
        )}

        {/* =================================================
            OTP VERIFICATION SCREEN
        ================================================= */}
        {otpSent && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white flex items-center gap-2">
                <Mail className="w-6 h-6 text-orange-400" />
                Verify your email
              </DialogTitle>

              <DialogDescription className="text-white/60">
                Enter the 6-digit code sent to{" "}
                <span className="text-white font-semibold">
                  {email}
                </span>
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleVerifyOtp} className="flex flex-col gap-5 py-4">
              {/* OTP INPUT */}
              <div>
                <label className="text-sm font-bold text-white/80 mb-2 block">
                  Verification code
                </label>

                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value
                      .replace(/\D/g, "")
                      .slice(0, 6);

                    setOtp(value);
                    setError("");
                  }}
                  placeholder="000000"
                  disabled={loading}
                  autoFocus
                  className="
                    h-14
                    text-center
                    text-2xl
                    tracking-[0.5em]
                    font-black

                    bg-black/60
                    text-white
                    border-white/20

                    placeholder:text-white/20

                    rounded-xl

                    focus:border-white
                    focus:ring-2
                    focus:ring-white/20
                    focus:shadow-[0_0_25px_rgba(255,255,255,0.2)]

                    transition-all
                    duration-300
                  "
                />
              </div>

              {/* VERIFY */}
              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="
                  w-full
                  h-12
                  bg-orange-500
                  hover:bg-orange-600
                  text-white
                  font-black
                  rounded-xl

                  transition-all
                  duration-300

                  hover:scale-[1.02]
                  hover:shadow-[0_0_25px_rgba(249,115,22,0.5)]

                  active:scale-95

                  disabled:opacity-50
                  disabled:hover:scale-100
                  disabled:hover:shadow-none
                "
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 w-4 h-4" />
                    Verify & Continue
                  </>
                )}
              </Button>

              {/* SUCCESS */}
              {success && (
                <div className="rounded-lg border border-green-400/30 bg-green-500/10 px-4 py-3 text-sm text-green-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {success}
                </div>
              )}

              {/* ERROR */}
              {error && (
                <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              )}

              {/* BOTTOM ACTIONS */}
              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  disabled={loading}
                  className="
                    flex
                    items-center
                    gap-1
                    text-white/60
                    hover:text-white
                    transition-colors
                    duration-200
                    disabled:opacity-40
                  "
                >
                  <ArrowLeft className="w-4 h-4" />
                  Change email
                </button>

                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendTimer > 0 || loading}
                  className="
                    flex
                    items-center
                    gap-1
                    text-orange-300
                    hover:text-orange-200
                    transition-colors
                    duration-200
                    disabled:text-white/30
                    disabled:cursor-not-allowed
                  "
                >
                  <RefreshCw className="w-4 h-4" />

                  {resendTimer > 0
                    ? `Resend in ${resendTimer}s`
                    : "Resend OTP"}
                </button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}