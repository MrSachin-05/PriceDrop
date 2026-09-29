import * as cheerio from "cheerio";
import FirecrawlApp from "@mendable/firecrawl-js";

// In-memory scrape cache (5 minutes TTL)
const scrapeCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Normalizes e-commerce URLs by removing tracking, affiliate, and session query params
 */
export function normalizeProductUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);

    // If it's a shortlink (Flipkart or Amazon or bitly), preserve path so redirect works
    if (parsed.hostname.includes("dl.flipkart.com") || parsed.hostname.includes("amzn.to")) {
      return rawUrl.trim();
    }

    // Amazon canonicalization: amazon.com/dp/ASIN
    const amazonMatch = parsed.pathname.match(/\/([A-Z0-9]{10})(?:[/?]|$)/i);
    if ((parsed.hostname.includes("amazon.") || parsed.hostname.includes("amzn.")) && amazonMatch) {
      return `${parsed.protocol}//${parsed.hostname}/dp/${amazonMatch[1].toUpperCase()}`;
    }

    // Flipkart canonicalization on main web site
    if (parsed.hostname.includes("flipkart.com") && !parsed.hostname.includes("dl.flipkart.com")) {
      const pid = parsed.searchParams.get("pid");
      if (pid) {
        return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}?pid=${pid}`;
      }
    }

    // Strip common tracking and analytics parameters
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "ref_", "tag", "ascsubtag", "fbclid", "gclid", "dclid", "_refId", "_appId"
    ];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));

    return parsed.toString();
  } catch (_) {
    return rawUrl;
  }
}

/**
 * Robust price parser supporting INR (₹), USD ($), EUR (€), GBP (£) and European number formats
 */
export function parsePriceFromText(text, fallbackCurrency = "USD") {
  if (!text || typeof text !== "string") return null;

  let currency = fallbackCurrency;
  if (text.includes("₹") || text.toLowerCase().includes("inr")) currency = "INR";
  else if (text.includes("$")) currency = "USD";
  else if (text.includes("€") || text.toLowerCase().includes("eur")) currency = "EUR";
  else if (text.includes("£") || text.toLowerCase().includes("gbp")) currency = "GBP";

  // Clean non-digit characters except dots and commas
  const cleaned = text.replace(/[^0-9.,]/g, "").trim();
  if (!cleaned) return null;

  let num = null;
  // Handle European comma/dot reversal (e.g. 1.250,50 vs 1,250.50)
  if (cleaned.includes(",") && cleaned.includes(".")) {
    if (cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")) {
      num = parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
    } else {
      num = parseFloat(cleaned.replace(/,/g, ""));
    }
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    if (parts.length === 2 && parts[1].length === 2) {
      num = parseFloat(cleaned.replace(",", "."));
    } else {
      num = parseFloat(cleaned.replace(/,/g, ""));
    }
  } else {
    num = parseFloat(cleaned);
  }

  return isNaN(num) || num <= 0 ? null : { price: num, currency };
}

/**
 * Direct scraper using Cheerio, embedded state inspection, and leaf element fallback
 */
async function scrapeDirect(url) {
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,hi;q=0.8",
    "Sec-Ch-Ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"Windows"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control": "max-age=0",
  };

  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  });

  const finalUrl = response.url || url;

  if (!response.ok && response.status !== 404) {
    throw new Error(`HTTP ${response.status} from retailer server`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Check if Amazon served an automated bot CAPTCHA
  const isAmazonCaptcha =
    html.includes("api-services-support@amazon.com") ||
    html.includes("Type the characters you see in this image") ||
    ($("title").text().trim() === "Amazon.in" && html.length < 10000);

  if (isAmazonCaptcha) {
    throw new Error(
      "Amazon triggered anti-bot verification. Configure FIRECRAWL_API_KEY in .env.local to bypass Amazon bot detection, or track from Flipkart, Walmart, and other supported retailers!"
    );
  }

  // Detect default currency based on domain
  let detectedCurrency = "USD";
  if (finalUrl.includes(".in") || finalUrl.includes("flipkart")) detectedCurrency = "INR";
  else if (finalUrl.includes(".co.uk")) detectedCurrency = "GBP";
  else if (finalUrl.includes(".de") || finalUrl.includes(".fr") || finalUrl.includes(".it")) detectedCurrency = "EUR";

  // =========================================================================
  // 1. EXTRACT PRODUCT NAME
  // =========================================================================
  let productName =
    $("h1").first().text().trim() ||
    $("#productTitle, #title").first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    $('meta[name="twitter:title"]').attr("content") ||
    $("title").text().trim();

  if (productName) {
    productName = productName
      .replace(/\s+Online at Best Price.*$/i, "")
      .replace(/ - Flipkart.*$/i, "")
      .replace(/Search Icon.*$/i, "")
      .replace(/ - Amazon\.[a-z.]+$/i, "")
      .replace(/ : Amazon\.[a-z.]+$/i, "")
      .replace(/ \| Flipkart$/i, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // =========================================================================
  // 2. EXTRACT PRODUCT IMAGE
  // =========================================================================
  let productImageUrl =
    $('meta[property="og:image"]').attr("content") ||
    $('meta[name="twitter:image"]').attr("content") ||
    $("#landingImage").attr("data-old-hires") ||
    $("#landingImage").attr("src") ||
    $("#imgBlkFront").attr("src") ||
    "";

  // Clean relative image URLs
  if (productImageUrl && productImageUrl.startsWith("//")) {
    productImageUrl = `https:${productImageUrl}`;
  }

  // =========================================================================
  // 3. EXTRACT PRODUCT PRICE (Multi-Tier Hierarchy)
  // =========================================================================
  let currentPrice = null;
  let currencyCode = detectedCurrency;

  // Tier 1: JSON-LD Structured Data
  $('script[type="application/ld+json"]').each((_, el) => {
    if (currentPrice) return;
    try {
      const json = JSON.parse($(el).text());
      const findOffer = (node) => {
        if (!node || currentPrice) return;
        if (node.offers) {
          const offer = Array.isArray(node.offers) ? node.offers[0] : node.offers;
          if (offer.price) {
            const parsed = parseFloat(offer.price);
            if (!isNaN(parsed) && parsed > 0) {
              currentPrice = parsed;
              if (offer.priceCurrency) currencyCode = offer.priceCurrency;
            }
          }
        }
        if (!productImageUrl && node.image) {
          productImageUrl = Array.isArray(node.image) ? node.image[0] : (node.image.url || node.image);
        }
        if (node["@graph"] && Array.isArray(node["@graph"])) {
          node["@graph"].forEach(findOffer);
        }
      };
      findOffer(json);
    } catch (_) {}
  });

  // Tier 2: Embedded State in script tags (Flipkart, Amazon, Shopify, Next.js hydration)
  if (!currentPrice) {
    $("script").each((_, el) => {
      if (currentPrice) return;
      const content = $(el).html() || "";
      if (content.length > 50 && (content.includes("price") || content.includes("Price"))) {
        const patterns = [
          /"(?:finalPrice|specialPrice|sellingPrice|priceAmount)"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
          /"price"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
          /"decimalValue"\s*:\s*"?([0-9.]+)"?/i,
          /"value"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?),\s*"currency"\s*:\s*"([A-Z]{3})"/i,
        ];
        for (const p of patterns) {
          const m = content.match(p);
          if (m && parseFloat(m[1]) > 0) {
            currentPrice = parseFloat(m[1]);
            if (m[2]) currencyCode = m[2];
            break;
          }
        }
      }
    });
  }

  // Tier 3: Store Selectors (Amazon, Flipkart, Walmart)
  if (!currentPrice) {
    const selectorCandidates = [
      ".apexPriceToPay .a-offscreen",
      "#corePrice_desktop .a-offscreen",
      ".a-price .a-offscreen",
      "#priceblock_dealprice",
      "#priceblock_ourprice",
      "._30jeq3",
      ".Nx9bqj",
      "div[class*='v1zwn2']",
      "[itemprop='price']",
      ".price-characteristic",
      ".current-price",
    ];
    for (const sel of selectorCandidates) {
      const text = $(sel).first().text().trim();
      const parsed = parsePriceFromText(text, detectedCurrency);
      if (parsed) {
        currentPrice = parsed.price;
        currencyCode = parsed.currency;
        break;
      }
    }
  }

  // Tier 4: OpenGraph & Twitter Price Meta tags
  if (!currentPrice) {
    const ogPrice = $('meta[property="product:price:amount"]').attr("content");
    const ogCurrency = $('meta[property="product:price:currency"]').attr("content");
    if (ogPrice) {
      const parsed = parseFloat(ogPrice);
      if (!isNaN(parsed) && parsed > 0) {
        currentPrice = parsed;
        if (ogCurrency) currencyCode = ogCurrency;
      }
    }
  }

  // Tier 5: Leaf text nodes starting with currency symbols (₹, $, €, £)
  if (!currentPrice) {
    $("*").each((_, el) => {
      if (currentPrice) return;
      const text = $(el).text().trim();
      if ($(el).children().length === 0 && /^[\$₹€£]\s*[0-9,]+(?:\.[0-9]{2})?$/.test(text)) {
        const parsed = parsePriceFromText(text, detectedCurrency);
        if (parsed) {
          currentPrice = parsed.price;
          currencyCode = parsed.currency;
        }
      }
    });
  }

  if (!productName || currentPrice === null || isNaN(currentPrice)) {
    throw new Error("Could not extract product name or price from page DOM");
  }

  return {
    productName,
    currentPrice,
    currencyCode,
    productImageUrl,
    canonicalUrl: finalUrl,
  };
}

/**
 * Fallback to Firecrawl if configured
 */
async function scrapeWithFirecrawl(url) {
  if (!process.env.FIRECRAWL_API_KEY) {
    throw new Error("FIRECRAWL_API_KEY not configured");
  }

  const firecrawl = new FirecrawlApp({
    apiKey: process.env.FIRECRAWL_API_KEY,
  });

  const result = await firecrawl.scrapeUrl(url, {
    formats: ["extract"],
    extract: {
      prompt:
        "Extract the product name as 'productName', current price as a number as 'currentPrice', currency code (USD, INR, EUR, etc) as 'currencyCode', and product image URL as 'productImageUrl' if available",
      schema: {
        type: "object",
        properties: {
          productName: { type: "string" },
          currentPrice: { type: "number" },
          currencyCode: { type: "string" },
          productImageUrl: { type: "string" },
        },
        required: ["productName", "currentPrice"],
      },
    },
  });

  const extractedData = result.extract;
  if (!extractedData || !extractedData.productName) {
    throw new Error("No data extracted from URL by Firecrawl");
  }

  return extractedData;
}

/**
 * Master scraper with shortlink resolution, caching, and multi-tier fallback
 */
export async function scrapeProduct(url, { bypassCache = false } = {}) {
  const normalizedUrl = normalizeProductUrl(url);

  // Check in-memory cache
  if (!bypassCache && scrapeCache.has(normalizedUrl)) {
    const cached = scrapeCache.get(normalizedUrl);
    if (Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return cached.data;
    }
    scrapeCache.delete(normalizedUrl);
  }

  let resultData = null;
  let directErrorMessage = "";

  // Strategy 1: Direct native scraping (Cheerio + Embedded State)
  try {
    const data = await scrapeDirect(normalizedUrl);
    if (data.productName && data.currentPrice) {
      resultData = data;
    }
  } catch (directError) {
    directErrorMessage = directError.message;
    console.warn(`Direct scraper note for ${normalizedUrl}: ${directError.message}. Trying Firecrawl fallback...`);
  }

  // Strategy 2: Firecrawl fallback (if API key configured)
  if (!resultData) {
    try {
      resultData = await scrapeWithFirecrawl(normalizedUrl);
    } catch (firecrawlError) {
      console.error("All scraper strategies failed:", firecrawlError.message);
      // Surface helpful retailer-specific guidance
      if (directErrorMessage && directErrorMessage.includes("anti-bot")) {
        throw new Error(directErrorMessage);
      }
      throw new Error(
        "Could not extract product details from this URL. Please verify the link points to a live product page."
      );
    }
  }

  // Store in cache
  scrapeCache.set(normalizedUrl, {
    data: resultData,
    timestamp: Date.now(),
  });

  return resultData;
}
