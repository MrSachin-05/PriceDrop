import { Resend } from "resend";
import nodemailer from "nodemailer";

function getEmailTransporter() {
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  return null;
}

function getResendClient() {
  if (process.env.RESEND_API_KEY) {
    return new Resend(process.env.RESEND_API_KEY);
  }
  return null;
}

/**
 * Universal email dispatcher
 */
async function dispatchEmail({ to, subject, html, text }) {
  const fromEmail = process.env.EMAIL_FROM || process.env.RESEND_FROM_EMAIL || "Deal Drop <onboarding@resend.dev>";
  const resend = getResendClient();
  const smtp = getEmailTransporter();

  let resendWarning = null;

  // 1. Try SMTP first if configured (e.g. user provided Gmail SMTP credentials)
  if (smtp) {
    try {
      const info = await smtp.sendMail({
        from: fromEmail,
        to,
        subject,
        html,
        text,
      });
      return { success: true, provider: "smtp", info };
    } catch (err) {
      console.warn("SMTP dispatch failed, falling back to other transports:", err.message);
    }
  }

  // 2. Try Resend if configured and SMTP not available/failed
  if (resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to,
        subject,
        html,
        text,
      });

      if (error) {
        resendWarning = error.message;
        console.warn("Resend API returned error, falling back to other transports:", error);
      } else {
        return { success: true, provider: "resend", data };
      }
    } catch (err) {
      resendWarning = err.message;
      console.warn("Resend dispatch failed:", err.message);
    }
  }

  // 3. Fallback / Dev mode: Log to console so user can test without email credentials
  console.log("\n========================================================");
  console.log(`📧 [DEV EMAIL SIMULATOR] To: ${to}`);
  console.log(`📌 Subject: ${subject}`);
  if (text) console.log(`📝 Body:\n${text}`);
  console.log("========================================================\n");

  return { success: true, provider: "dev-simulator", warning: resendWarning };
}

/**
 * Generates a QuickChart URL for embedding price history graph in emails
 */
export function generateChartUrl(history, currency = "USD") {
  if (!history || history.length === 0) return null;

  const labels = history.map((item) =>
    new Date(item.checked_at).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })
  );
  const data = history.map((item) => Number(item.price));
  const isDrop = data.length > 1 && data[data.length - 1] < data[0];
  const themeColor = isDrop ? "#10B981" : "#FA5D19";
  const bgFill = isDrop ? "rgba(16, 185, 129, 0.15)" : "rgba(250, 93, 25, 0.15)";

  const chartConfig = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `Price (${currency})`,
          data,
          borderColor: themeColor,
          backgroundColor: bgFill,
          fill: true,
          tension: 0.3,
          pointRadius: 6,
          pointBackgroundColor: themeColor,
          borderWidth: 3,
        },
      ],
    },
    options: {
      legend: { display: false },
      title: {
        display: true,
        text: `Price History Trend (${currency})`,
        fontSize: 16,
        fontColor: "#111827",
      },
      scales: {
        yAxes: [
          {
            ticks: {
              fontColor: "#6B7280",
              callback: (val) => `${currency} ${val}`,
            },
            gridLines: { color: "#F3F4F6" },
          },
        ],
        xAxes: [
          {
            ticks: { fontColor: "#6B7280" },
            gridLines: { display: false },
          },
        ],
      },
    },
  };

  return `https://quickchart.io/chart?c=${encodeURIComponent(
    JSON.stringify(chartConfig)
  )}&w=580&h=260&bkg=white`;
}

/**
 * Step-to-step OTP email sender
 */
export async function sendOtpEmail(userEmail, otpCode) {
  const subject = `Your Deal Drop Verification Code: ${otpCode}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #111827; background-color: #f9fafb; margin: 0; padding: 24px;">
        <div style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
          <div style="background: linear-gradient(135deg, #09090b 0%, #1c1917 100%); padding: 32px 24px; text-align: center; border-bottom: 3px solid #f97316;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Deal Drop</h1>
            <p style="color: #fed7aa; margin: 6px 0 0; font-size: 14px;">Smart Price Tracking Authentication</p>
          </div>
          
          <div style="padding: 32px 24px; text-align: center;">
            <p style="margin: 0 0 16px; font-size: 15px; color: #4b5563;">Use the verification code below to sign in:</p>
            
            <div style="background: #fff7ed; border: 2px dashed #f97316; border-radius: 12px; padding: 18px 24px; margin: 24px 0; display: inline-block;">
              <span style="font-size: 38px; font-weight: 900; letter-spacing: 8px; color: #ea580c; font-family: monospace;">${otpCode}</span>
            </div>

            <p style="margin: 0 0 8px; font-size: 13px; color: #6b7280;">This single-use code is valid for <strong>10 minutes</strong>.</p>
            <p style="margin: 0; font-size: 12px; color: #9ca3af;">If you did not request this verification code, you can safely ignore this email.</p>
          </div>

          <div style="background: #f9fafb; padding: 16px 24px; text-align: center; border-top: 1px solid #f3f4f6; font-size: 12px; color: #9ca3af;">
            Deal Drop Price Tracker • Never Miss a Price Drop
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `Your Deal Drop verification code is: ${otpCode}\nValid for 10 minutes.\nIf you did not request this, please ignore.`;

  return await dispatchEmail({ to: userEmail, subject, html, text });
}

/**
 * Price Drop Alert email with embedded price chart/graph
 */
export async function sendPriceDropAlert(userEmail, product, oldPrice, newPrice, priceHistory = []) {
  try {
    const priceDrop = oldPrice - newPrice;
    const percentageDrop = ((priceDrop / oldPrice) * 100).toFixed(1);
    const chartUrl = generateChartUrl(priceHistory, product.currency || "USD");

    const subject = `🎉 Price Drop Alert: ${product.name} dropped by ${percentageDrop}%!`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f3f4f6; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
            
            <!-- Header Banner -->
            <div style="background: linear-gradient(135deg, #ea580c 0%, #f97316 100%); padding: 32px 24px; text-align: center; color: white;">
              <span style="background: rgba(255,255,255,0.2); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; padding: 4px 12px; border-radius: 9999px;">Instant Alert</span>
              <h1 style="color: white; margin: 12px 0 4px; font-size: 28px; font-weight: 900;">Price Drop Detected!</h1>
              <p style="margin: 0; color: #ffedd5; font-size: 15px;">A tracked product has hit a lower price!</p>
            </div>
            
            <div style="padding: 28px 24px;">
              ${
                product.image_url
                  ? `
                <div style="text-align: center; margin-bottom: 24px;">
                  <img src="${product.image_url}" alt="${product.name}" style="max-width: 220px; max-height: 200px; object-fit: contain; border-radius: 12px; border: 1px solid #e5e7eb; padding: 8px;">
                </div>
              `
                  : ""
              }
              
              <h2 style="color: #111827; font-size: 18px; margin: 0 0 16px; line-height: 1.4;">${product.name}</h2>
              
              <!-- Savings Highlight Box -->
              <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 16px; margin-bottom: 24px; text-align: center;">
                <p style="margin: 0; font-size: 16px; color: #065f46; font-weight: 700;">
                  🎉 Price dropped by ${percentageDrop}%! You save ${product.currency} ${priceDrop.toFixed(2)}
                </p>
              </div>
              
              <!-- Price Comparison Table -->
              <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px; background: #f9fafb; border-radius: 8px; width: 33%; text-align: center;">
                    <div style="font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Previous</div>
                    <div style="font-size: 18px; color: #9ca3af; text-decoration: line-through; font-weight: 600; margin-top: 4px;">
                      ${product.currency} ${Number(oldPrice).toFixed(2)}
                    </div>
                  </td>
                  <td style="padding: 14px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; width: 33%; text-align: center;">
                    <div style="font-size: 12px; color: #c2410c; font-weight: 700; text-transform: uppercase;">Current Price</div>
                    <div style="font-size: 24px; color: #ea580c; font-weight: 900; margin-top: 4px;">
                      ${product.currency} ${Number(newPrice).toFixed(2)}
                    </div>
                  </td>
                  <td style="padding: 14px; background: #dcfce7; border-radius: 8px; width: 33%; text-align: center;">
                    <div style="font-size: 12px; color: #15803d; font-weight: 600; text-transform: uppercase;">You Save</div>
                    <div style="font-size: 18px; color: #16a34a; font-weight: 800; margin-top: 4px;">
                      ${product.currency} ${priceDrop.toFixed(2)}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Embedded Price History Graph -->
              ${
                chartUrl
                  ? `
                <div style="margin: 28px 0; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; background: #ffffff; text-align: center;">
                  <div style="background: #f9fafb; padding: 10px 16px; border-bottom: 1px solid #e5e7eb; text-align: left;">
                    <strong style="font-size: 13px; color: #374151;">📊 Price History & Drop Trend</strong>
                  </div>
                  <div style="padding: 12px;">
                    <img src="${chartUrl}" alt="Price History Chart" style="width: 100%; max-width: 550px; height: auto; display: block; margin: 0 auto;" />
                  </div>
                </div>
              `
                  : ""
              }
              
              <!-- Call to Action Button -->
              <div style="text-align: center; margin: 32px 0 16px;">
                <a href="${product.url}" 
                   style="display: inline-block; background: #ea580c; color: white; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 16px; box-shadow: 0 4px 14px rgba(234, 88, 12, 0.4);">
                  View Product on Store →
                </a>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 28px; text-align: center; color: #6b7280; font-size: 12px;">
                <p style="margin: 0 0 6px;">You are receiving this notification because you are tracking this product on Deal Drop.</p>
                <p style="margin: 0;">
                  <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}" style="color: #ea580c; text-decoration: none; font-weight: 600;">
                    Manage your tracked products
                  </a>
                </p>
              </div>
            </div>
            
          </div>
        </body>
      </html>
    `;

    const text = `🎉 Price Drop Alert!\n${product.name}\nPrevious: ${product.currency} ${Number(oldPrice).toFixed(2)}\nNew: ${product.currency} ${Number(newPrice).toFixed(2)}\nSavings: ${product.currency} ${priceDrop.toFixed(2)} (${percentageDrop}%)\nView at: ${product.url}`;

    return await dispatchEmail({ to: userEmail, subject, html, text });
  } catch (error) {
    console.error("sendPriceDropAlert error:", error);
    return { error: error.message };
  }
}
