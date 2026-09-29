import fs from "fs";
import path from "path";
import crypto from "crypto";

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const DATA_DIR = process.env.DATA_DIR || (isServerless ? path.join("/tmp", "pricedrop-data") : path.join(process.cwd(), "data"));
const DB_FILE = path.join(DATA_DIR, "db.json");

const INITIAL_DATA = {
  users: [],
  otp_codes: [],
  products: [],
  price_history: [],
};

let cache = null;
let lastMtime = 0;
let writePromise = Promise.resolve();

function ensureDbFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    const bundledDbPath = path.join(process.cwd(), "data", "db.json");
    if (bundledDbPath !== DB_FILE && fs.existsSync(bundledDbPath)) {
      try {
        fs.copyFileSync(bundledDbPath, DB_FILE);
      } catch {
        fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2), "utf8");
      }
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DATA, null, 2), "utf8");
    }

    try {
      cache = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
      lastMtime = fs.statSync(DB_FILE).mtimeMs;
    } catch {
      cache = { ...INITIAL_DATA };
    }
  }
}

async function readDb() {
  ensureDbFile();

  try {
    const stats = await fs.promises.stat(DB_FILE);
    if (cache && stats.mtimeMs === lastMtime) {
      return cache;
    }

    const raw = await fs.promises.readFile(DB_FILE, "utf8");
    cache = JSON.parse(raw);
    lastMtime = stats.mtimeMs;
    return cache;
  } catch (err) {
    console.error("Error reading db file, re-initializing:", err);
    cache = { ...INITIAL_DATA };
    return cache;
  }
}

async function writeDb(data) {
  ensureDbFile();
  cache = data;

  writePromise = writePromise.then(async () => {
    try {
      await fs.promises.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf8");
      const stat = await fs.promises.stat(DB_FILE);
      lastMtime = stat.mtimeMs;
    } catch (err) {
      console.error("Error writing db file:", err);
    }
  });

  return writePromise;
}

/* =========================================================================
   USER OPERATIONS
========================================================================= */

export async function getUserById(id) {
  const db = await readDb();
  return db.users.find((u) => u.id === id) || null;
}

export async function getUserByEmail(email) {
  const db = await readDb();
  const cleanEmail = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === cleanEmail) || null;
}

export async function upsertUser({ email, name, avatar_url }) {
  const db = await readDb();
  const cleanEmail = email.trim().toLowerCase();
  let user = db.users.find((u) => u.email.toLowerCase() === cleanEmail);

  const now = new Date().toISOString();

  if (user) {
    user.name = name || user.name || cleanEmail.split("@")[0];
    user.avatar_url = avatar_url || user.avatar_url;
    user.updated_at = now;
  } else {
    user = {
      id: crypto.randomUUID(),
      email: cleanEmail,
      name: name || cleanEmail.split("@")[0],
      avatar_url: avatar_url || "",
      created_at: now,
      updated_at: now,
    };
    db.users.push(user);
  }

  await writeDb(db);
  return user;
}

/* =========================================================================
   OTP OPERATIONS (STEP-BY-STEP AUTH)
========================================================================= */

export async function saveOtp({ email, code, expiresMinutes = 10 }) {
  const db = await readDb();
  const cleanEmail = email.trim().toLowerCase();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + expiresMinutes * 60 * 1000).toISOString();

  // Invalidate previous unverified OTPs for this email
  db.otp_codes = db.otp_codes.filter(
    (item) => item.email.toLowerCase() !== cleanEmail || item.verified
  );

  const otpRecord = {
    id: crypto.randomUUID(),
    email: cleanEmail,
    code: String(code),
    expires_at: expiresAt,
    verified: false,
    attempts: 0,
    created_at: now.toISOString(),
  };

  db.otp_codes.push(otpRecord);
  await writeDb(db);
  return otpRecord;
}

export async function verifyOtpCode({ email, code }) {
  const db = await readDb();
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = String(code).trim();
  const now = new Date();

  const record = db.otp_codes
    .filter((o) => o.email.toLowerCase() === cleanEmail && !o.verified)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];

  if (!record) {
    return { valid: false, error: "No pending verification code found. Please request a new code." };
  }

  if (new Date(record.expires_at) < now) {
    return { valid: false, error: "Verification code has expired. Please request a new one." };
  }

  if (record.attempts >= 5) {
    return { valid: false, error: "Too many failed attempts. Please request a new code." };
  }

  if (record.code !== cleanCode) {
    record.attempts += 1;
    await writeDb(db);
    return {
      valid: false,
      error: `Invalid verification code. ${5 - record.attempts} attempts remaining.`,
    };
  }

  record.verified = true;
  await writeDb(db);

  return { valid: true };
}

/* =========================================================================
   PRODUCT OPERATIONS
========================================================================= */

export async function getProductsByUserId(userId) {
  const db = await readDb();
  const products = db.products
    .filter((p) => p.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Attach pre-calculated price drop stats to each product
  return products.map((product) => {
    const history = db.price_history
      .filter((h) => h.product_id === product.id)
      .sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));

    if (history.length === 0) {
      return {
        ...product,
        stats: {
          min: product.current_price,
          max: product.current_price,
          first: product.current_price,
          diff: 0,
          diffPercent: 0,
          trend: "flat",
          historyCount: 0,
        },
      };
    }

    const prices = history.map((h) => Number(h.price));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const first = prices[0];
    const current = Number(product.current_price);
    const diff = current - first;
    const diffPercent = first > 0 ? ((diff / first) * 100).toFixed(1) : 0;

    let trend = "flat";
    if (diff < -0.01) trend = "down";
    else if (diff > 0.01) trend = "up";

    return {
      ...product,
      stats: {
        min,
        max,
        first,
        current,
        diff,
        diffPercent: Math.abs(diffPercent),
        trend,
        historyCount: history.length,
        isLowestEver: current <= min,
      },
    };
  });
}

export async function getAllProducts() {
  const db = await readDb();
  return db.products;
}

export async function getProductById(id) {
  const db = await readDb();
  return db.products.find((p) => p.id === id) || null;
}

export async function upsertProduct({ userId, url, name, currentPrice, currency = "USD", imageUrl = "" }) {
  const db = await readDb();
  const now = new Date().toISOString();

  let product = db.products.find((p) => p.user_id === userId && p.url === url);
  const isUpdate = !!product;

  if (product) {
    product.name = name || product.name;
    product.current_price = Number(currentPrice);
    product.currency = currency || product.currency;
    product.image_url = imageUrl || product.image_url;
    product.updated_at = now;
  } else {
    product = {
      id: crypto.randomUUID(),
      user_id: userId,
      url,
      name,
      current_price: Number(currentPrice),
      currency: currency || "USD",
      image_url: imageUrl || "",
      created_at: now,
      updated_at: now,
    };
    db.products.unshift(product);
  }

  await writeDb(db);
  return { product, isUpdate };
}

export async function deleteProduct(id, userId) {
  const db = await readDb();
  const initialLength = db.products.length;

  db.products = db.products.filter((p) => !(p.id === id && p.user_id === userId));
  const deleted = db.products.length < initialLength;

  if (deleted) {
    db.price_history = db.price_history.filter((h) => h.product_id !== id);
    await writeDb(db);
  }

  return deleted;
}

/* =========================================================================
   PRICE HISTORY OPERATIONS
========================================================================= */

export async function addPriceHistory({ productId, price, currency = "USD", checkedAt }) {
  const db = await readDb();
  const historyItem = {
    id: crypto.randomUUID(),
    product_id: productId,
    price: Number(price),
    currency: currency || "USD",
    checked_at: checkedAt || new Date().toISOString(),
  };

  db.price_history.push(historyItem);
  await writeDb(db);
  return historyItem;
}

export async function getPriceHistory(productId) {
  const db = await readDb();
  return db.price_history
    .filter((h) => h.product_id === productId)
    .sort((a, b) => new Date(a.checked_at) - new Date(b.checked_at));
}

/* =========================================================================
   DEMO SEEDING & SIMULATION HELPERS
========================================================================= */

export async function seedDemoProductsForUser(userId) {
  const db = await readDb();
  const existingUrls = new Set(
    db.products.filter((p) => p.user_id === userId).map((p) => p.url)
  );

  const now = Date.now();
  const daysAgo = (d) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();
  const added = [];

  // 1. MacBook Air M2 - Demonstrating major price drop
  const macbookUrl = "https://www.amazon.com/dp/B0B3C57X27";
  if (!existingUrls.has(macbookUrl)) {
    const macbook = {
      id: crypto.randomUUID(),
      user_id: userId,
      url: macbookUrl,
      name: "Apple 2022 MacBook Air M2 Chip (13.6-inch, 8GB RAM, 256GB SSD Storage) - Midnight",
      current_price: 849.0,
      currency: "USD",
      image_url: "https://m.media-amazon.com/images/I/710TJuHTMhL._AC_SL1500_.jpg",
      created_at: daysAgo(14),
      updated_at: new Date().toISOString(),
    };
    db.products.push(macbook);
    added.push(macbook);

    db.price_history.push(
      { id: crypto.randomUUID(), product_id: macbook.id, price: 999.0, currency: "USD", checked_at: daysAgo(14) },
      { id: crypto.randomUUID(), product_id: macbook.id, price: 1049.0, currency: "USD", checked_at: daysAgo(9) },
      { id: crypto.randomUUID(), product_id: macbook.id, price: 949.0, currency: "USD", checked_at: daysAgo(5) },
      { id: crypto.randomUUID(), product_id: macbook.id, price: 849.0, currency: "USD", checked_at: new Date().toISOString() }
    );
  }

  // 2. Sony WH-1000XM5 - Demonstrating price surge then drop
  const sonyUrl = "https://www.amazon.com/dp/B09XS7JWHH";
  if (!existingUrls.has(sonyUrl)) {
    const sony = {
      id: crypto.randomUUID(),
      user_id: userId,
      url: sonyUrl,
      name: "Sony WH-1000XM5 Wireless Noise Canceling Headphones - Black",
      current_price: 328.0,
      currency: "USD",
      image_url: "https://m.media-amazon.com/images/I/61+elLbd3RL._AC_SL1500_.jpg",
      created_at: daysAgo(10),
      updated_at: new Date().toISOString(),
    };
    db.products.push(sony);
    added.push(sony);

    db.price_history.push(
      { id: crypto.randomUUID(), product_id: sony.id, price: 399.99, currency: "USD", checked_at: daysAgo(10) },
      { id: crypto.randomUUID(), product_id: sony.id, price: 349.99, currency: "USD", checked_at: daysAgo(7) },
      { id: crypto.randomUUID(), product_id: sony.id, price: 379.99, currency: "USD", checked_at: daysAgo(3) },
      { id: crypto.randomUUID(), product_id: sony.id, price: 328.0, currency: "USD", checked_at: new Date().toISOString() }
    );
  }

  if (added.length > 0) {
    await writeDb(db);
  }
  return added;
}
