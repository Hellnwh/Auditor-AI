import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from '@google/genai';
import admin from 'firebase-admin';
import fs from 'fs';

// Initialize Firebase Admin to verify user tokens
if (!admin.apps.length) {
  const renderSecretPath = '/etc/secrets/serviceAccount.json';

  if (fs.existsSync(renderSecretPath)) {
    // Render deployment: read the secret file
    const serviceAccount = JSON.parse(fs.readFileSync(renderSecretPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    // Fallback: base64-encoded env var
    const serviceAccount = JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
    );
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Local dev or GCP-managed runtime
    let projectId = process.env.FIREBASE_PROJECT_ID;
    try {
      const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
      if (config.projectId) projectId = config.projectId;
    } catch(e) {}
    
    console.log('Firebase Admin initializing with projectId:', projectId);

    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      ...(projectId && { projectId })
    });
  }
}

// Initialize Gemini with the server-side key
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

// Auth middleware: requires a Firebase ID token
async function requireAuth(req: any, res: any, next: any) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    next();
  } catch (error) {
    console.error('Invalid auth token error:', error);
    return res.status(401).json({ error: 'Invalid auth token' });
  }
}

// Production-ready rate limit via Firestore
async function rateLimit(uid: string, maxPerMinute = 20): Promise<boolean> {
  const db = admin.firestore();
  const rateLimitRef = db.collection('rate_limits').doc(uid);
  const now = Date.now();
  
  try {
    return await db.runTransaction(async (t) => {
      const doc = await t.get(rateLimitRef);
      if (!doc.exists) {
        t.set(rateLimitRef, { calls: [now] });
        return true;
      }
      
      let calls = doc.data()?.calls || [];
      calls = calls.filter((time: number) => now - time < 60_000);
      
      if (calls.length >= maxPerMinute) {
        return false;
      }
      
      calls.push(now);
      t.set(rateLimitRef, { calls }, { merge: true });
      return true;
    });
  } catch (err) {
    console.error('Firestore rate limit error:', err);
    // Fallback securely: allow if DB fails to prevent total outage
    return true; 
  }
}

const SYSTEM_INSTRUCTION = `You are an Elite Financial Auditor. Your job is to extract structured financial data from a document (image, PDF, or spreadsheet text) and verify its mathematical integrity.

EXTRACTION RULES
- Extract: vendor, date (YYYY-MM-DD, or "Unknown" if illegible), currency (ISO 4217 code such as INR, USD, EUR), payment_method (cash/card/UPI/bank transfer/unknown), and an items array.
- For each item extract: description (string), quantity (number, default 1 if not stated), unit_price (number), amount (number = quantity * unit_price), category (string from the allowed list). When a quantity column is present, use it; otherwise infer 1.
- Pick the SINGLE most specific category from this list. Do NOT default to 'Other' unless absolutely no other category fits. Office stationery, computer hardware, packaging, raw materials → 'Goods'. Coffee, food, restaurants → 'Food & Beverage'. Hosting, electricity, internet → 'Utilities'. Lawyers, accountants, consulting → 'Professional Fees'. Allowed: "Goods", "Services", "Food & Beverage", "Travel", "Utilities", "Professional Fees", "Tax", "Shipping", "Other".
- All monetary fields (amount, subtotal, tax, discount, total_amount) must be numbers, not strings. Use 0 if a field is absent.

SPREADSHEET INPUT
- If the input is spreadsheet text (rows of cells), each row in the items section represents one line item.
- Identify the items section by looking for column headers like "Description", "Item", "Qty", "Amount", or "Total".
- Extract every data row in that section as a separate item.
- Ignore header rows, footer rows, instructions, README content, and metadata rows.
- If multiple sheets are provided, focus on the one that looks like a single invoice (has a vendor name, items, subtotal, total).

VERIFICATION RULES
- Compute sum_of_items = sum of all items[].amount.
- Check 1: sum_of_items must equal subtotal (tolerance 0.05).
- Check 2: subtotal + tax - discount must equal total_amount (tolerance 0.05).
- If either check fails, set discrepancy = "yes" and write a precise discrepancy_reason naming the exact numbers and the difference (e.g., "Sum of items is 450.00 but subtotal shows 400.00, difference of 50.00").
- If both checks pass, set discrepancy = "no" and discrepancy_reason = null.

CONFIDENCE
- Output a confidence value between 0 and 1.
- Reduce confidence for blurry images, partial documents, illegible totals, or ambiguous categories.

OUTPUT
- Return only the JSON object matching the configured schema. No prose, no markdown, no commentary.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    vendor: { type: Type.STRING },
    date: { type: Type.STRING, description: 'YYYY-MM-DD or "Unknown"' },
    currency: { type: Type.STRING, description: 'ISO 4217 code, e.g. INR, USD' },
    payment_method: { type: Type.STRING, description: 'cash/card/UPI/bank transfer/unknown' },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          quantity: { type: Type.NUMBER },
          unit_price: { type: Type.NUMBER },
          amount: { type: Type.NUMBER },
          category: { type: Type.STRING },
        },
        required: ['description', 'quantity', 'unit_price', 'amount', 'category'],
      },
    },
    subtotal: { type: Type.NUMBER },
    tax: { type: Type.NUMBER },
    discount: { type: Type.NUMBER },
    total_amount: { type: Type.NUMBER },
    discrepancy: { type: Type.STRING, enum: ['yes', 'no'] },
    discrepancy_reason: { type: Type.STRING, nullable: true },
    confidence: { type: Type.NUMBER, description: '0 to 1' },
  },
  required: [
    'vendor', 'date', 'currency', 'payment_method', 'items',
    'subtotal', 'tax', 'discount', 'total_amount',
    'discrepancy', 'confidence',
  ],
};

import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors({ origin: process.env.FRONTEND_ORIGIN || true }));
  app.use(express.json({ limit: "25mb" }));

  // API routes (keeping health check or other routes if any)
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post('/api/audit', requireAuth, async (req: any, res) => {
    const isAllowed = await rateLimit(req.uid);
    if (!isAllowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
  
    // 1. Quota Enforcement
    const db = admin.firestore();
    const userRef = db.collection('users').doc(req.uid);
    const now = new Date();
    
    let quotaError: { status: number, message: string, resetDate: string } | null = null;

    try {
      await db.runTransaction(async (t) => {
        const userDoc = await t.get(userRef);
        let userData = userDoc.data() || {};
        
        const plan = userData.plan || 'FREE';
        if (plan === 'FREE') {
          let count = userData.monthlyScanCount || 0;
          let resetDate = userData.quotaResetDate ? userData.quotaResetDate.toDate() : null;

          // If no reset date or reset date passed, reset the count
          if (!resetDate || now > resetDate) {
            count = 0;
            resetDate = new Date(now);
            resetDate.setMonth(resetDate.getMonth() + 1);
            t.set(userRef, { 
              monthlyScanCount: count, 
              quotaResetDate: admin.firestore.Timestamp.fromDate(resetDate) 
            }, { merge: true });
          }

          if (count >= 5) {
            quotaError = {
              status: 402,
              message: `You've used all 5 free scans this month. Upgrade to Pro for unlimited scans, or wait until ${resetDate.toLocaleDateString()}.`,
              resetDate: resetDate.toISOString()
            };
            return;
          }

          // Increment count for this audit
          t.update(userRef, { monthlyScanCount: count + 1 });
        }
      });
    } catch (err) {
      console.error('Quota transaction failed:', err);
      // Proceed if user doc doesn't exist yet, but first-time users should be created elsewhere
    }

    if (quotaError) {
      return res.status((quotaError as any).status).json({ 
        error: 'quota_exceeded', 
        message: (quotaError as any).message,
        resetDate: (quotaError as any).resetDate
      });
    }
  
    const { contents, useGoogleSearch } = req.body;
    if (!contents) return res.status(400).json({ error: 'Missing contents' });
  
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 16384,
          // googleSearch is incompatible with responseSchema — only enable when explicitly requested,
          // and in that case we drop responseSchema and rely on tolerant parsing.
          ...(useGoogleSearch
            ? {
                tools: [{ googleSearch: {} }],
                responseSchema: undefined,
                responseMimeType: undefined,
              }
            : {}),
        },
      });
  
      res.json({ text: result.text });
    } catch (err: any) {
      console.error('Gemini error:', err);
      res.status(500).json({ error: err.message || 'Audit failed' });
    }
  });

  // Global Error Handler for API routes
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error("API Error middleware caught:", err);
    res.status(500).json({ error: err.message || "An unexpected error occurred" });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
