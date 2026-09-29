"use server";

import { getCurrentUser } from "@/lib/auth/session";
import {
  upsertProduct,
  deleteProduct as dbDeleteProduct,
  getProductsByUserId,
  getPriceHistory as dbGetPriceHistory,
  addPriceHistory,
  getProductById,
  seedDemoProductsForUser,
} from "@/lib/db";
import { scrapeProduct } from "@/lib/scraper";
import { sendPriceDropAlert } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth/jwt";

export async function addProduct(formData) {
  const url = formData.get("url");

  if (!url) {
    return { error: "URL is required" };
  }

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { error: "Not authenticated. Please sign in to track products." };
    }

    // Scrape product data with dual-engine scraper (Direct + Firecrawl)
    const productData = await scrapeProduct(url);

    if (!productData.productName || productData.currentPrice === null) {
      return {
        error: "Could not extract product information from this URL",
      };
    }

    const newPrice = parseFloat(productData.currentPrice);
    const currency = productData.currencyCode || "USD";
    const trackedUrl = productData.canonicalUrl || url;

    // Upsert product in custom database
    const { product, isUpdate } = await upsertProduct({
      userId: user.id,
      url: trackedUrl,
      name: productData.productName,
      currentPrice: newPrice,
      currency,
      imageUrl: productData.productImageUrl || "",
    });

    // Check existing price history
    const existingHistory = await dbGetPriceHistory(product.id);
    const lastEntry = existingHistory[existingHistory.length - 1];

    // Record price history on new product or when price changes
    if (!lastEntry || Number(lastEntry.price) !== newPrice) {
      await addPriceHistory({
        productId: product.id,
        price: newPrice,
        currency,
      });
    }

    revalidatePath("/");

    return {
      success: true,
      product,
      message: isUpdate
        ? "Product updated with latest price!"
        : "Product added successfully!",
    };
  } catch (error) {
    console.error("Add product error:", error);
    return {
      error: error.message || "Failed to add product",
    };
  }
}

export async function deleteProduct(productId) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: "Not authenticated" };
    }

    const success = await dbDeleteProduct(productId, user.id);

    if (!success) {
      return { error: "Product not found or unauthorized" };
    }

    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
}

export async function getProducts() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return [];
    }

    return await getProductsByUserId(user.id);
  } catch (error) {
    console.error("Get products error:", error);
    return [];
  }
}

export async function getPriceHistory(productId) {
  try {
    return await dbGetPriceHistory(productId);
  } catch (error) {
    console.error("Get price history error:", error);
    return [];
  }
}

/**
 * High-Value Feature: Simulates an instant price drop for demonstration & testing
 * Updates the database, appends to price history, and dispatches the alert email with graph
 */
export async function simulatePriceDropAction(productId, percentDrop = 15) {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "Not authenticated" };

    const product = await getProductById(productId);
    if (!product || product.user_id !== user.id) {
      return { error: "Product not found" };
    }

    const oldPrice = Number(product.current_price);
    const dropMultiplier = (100 - percentDrop) / 100;
    const newPrice = parseFloat((oldPrice * dropMultiplier).toFixed(2));

    // Update product
    await upsertProduct({
      userId: user.id,
      url: product.url,
      name: product.name,
      currentPrice: newPrice,
      currency: product.currency,
      imageUrl: product.image_url,
    });

    // Add price history entry
    await addPriceHistory({
      productId: product.id,
      price: newPrice,
      currency: product.currency,
    });

    // Fetch full history and dispatch alert email with price graph!
    const history = await dbGetPriceHistory(product.id);
    const emailResult = await sendPriceDropAlert(
      user.email,
      product,
      oldPrice,
      newPrice,
      history
    );

    revalidatePath("/");

    return {
      success: true,
      oldPrice,
      newPrice,
      savings: (oldPrice - newPrice).toFixed(2),
      emailProvider: emailResult?.provider,
      message: `Simulated a ${percentDrop}% price drop! Alert email with graph dispatched to ${user.email}.`,
    };
  } catch (error) {
    console.error("Simulate price drop error:", error);
    return { error: error.message || "Failed to simulate price drop" };
  }
}

/**
 * High-Value Feature: Seeds realistic demo tracked products with price fluctuation history
 */
export async function seedDemoProductsAction() {
  try {
    const user = await getCurrentUser();
    if (!user) return { error: "Not authenticated" };

    await seedDemoProductsForUser(user.id);
    revalidatePath("/");
    return { success: true, message: "Sample tracked products added!" };
  } catch (error) {
    console.error("Seed demo error:", error);
    return { error: error.message };
  }
}

/* =========================================================
   SIGN OUT
   ========================================================= */

export async function signOut() {
  try {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });

    revalidatePath("/", "layout");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Sign out error:", error);
    return {
      error: error.message || "Failed to sign out",
    };
  }
}