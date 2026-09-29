import { NextResponse } from "next/server";
import {
  getAllProducts,
  upsertProduct,
  addPriceHistory,
  getPriceHistory,
  getUserById,
} from "@/lib/db";
import { scrapeProduct } from "@/lib/scraper";
import { sendPriceDropAlert } from "@/lib/email";

export async function POST(request) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Optional authorization check: if CRON_SECRET is set, enforce Bearer token
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const products = await getAllProducts();
    console.log(`[Cron] Found ${products.length} products to check`);

    const results = {
      total: products.length,
      updated: 0,
      failed: 0,
      priceChanges: 0,
      alertsSent: 0,
      details: [],
    };

    for (const product of products) {
      try {
        const productData = await scrapeProduct(product.url);

        if (!productData.currentPrice) {
          results.failed++;
          results.details.push({ id: product.id, status: "failed", reason: "no_price" });
          continue;
        }

        const newPrice = parseFloat(productData.currentPrice);
        const oldPrice = parseFloat(product.current_price);

        // Update product in database
        await upsertProduct({
          userId: product.user_id,
          url: product.url,
          name: productData.productName || product.name,
          currentPrice: newPrice,
          currency: productData.currencyCode || product.currency,
          imageUrl: productData.productImageUrl || product.image_url,
        });

        // If price changed, append to history
        if (oldPrice !== newPrice) {
          await addPriceHistory({
            productId: product.id,
            price: newPrice,
            currency: productData.currencyCode || product.currency,
          });

          results.priceChanges++;

          // If price DROPPED, alert user with price graph!
          if (newPrice < oldPrice) {
            const user = await getUserById(product.user_id);

            if (user?.email) {
              const fullHistory = await getPriceHistory(product.id);

              const emailResult = await sendPriceDropAlert(
                user.email,
                product,
                oldPrice,
                newPrice,
                fullHistory
              );

              if (emailResult.success) {
                results.alertsSent++;
              }
            }
          }
        }

        results.updated++;
        results.details.push({
          id: product.id,
          name: product.name,
          oldPrice,
          newPrice,
          changed: oldPrice !== newPrice,
        });
      } catch (error) {
        console.error(`[Cron] Error processing product ${product.id}:`, error.message);
        results.failed++;
        results.details.push({ id: product.id, status: "error", error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Price check cycle completed",
      results,
    });
  } catch (error) {
    console.error("Cron price check error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  // Allow GET for easy manual triggering/testing in browser or monitoring services
  return POST(request);
}
