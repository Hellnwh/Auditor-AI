import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI, Type } from '@google/genai';
import admin from 'firebase-admin';
import fs from 'fs';
import { Resend } from 'resend';
import { internalEmailHTML, userEmailHTML } from './emails';

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || '';
const EMAIL_TEST_MODE = process.env.EMAIL_TEST_MODE === 'true';

async function sendInternalAlert(subject: string, html: string): Promise<void> {
  if (!resend || !NOTIFICATION_EMAIL) {
    console.warn('Email notifications not configured - skipping internal alert');
    return;
  }
  
  const finalSubject = EMAIL_TEST_MODE ? `[TEST] ${subject}` : subject;
  
  try {
    const { error } = await resend.emails.send({
      from: 'Auditor AI <onboarding@resend.dev>',
      to: NOTIFICATION_EMAIL,
      subject: finalSubject,
      html,
    });
    if (error) console.error('Resend internal alert error:', error);
  } catch (err) {
    console.error('Failed to send internal alert:', err);
  }
}

async function sendUserEmail(toEmail: string, subject: string, html: string, uid?: string | null): Promise<void> {
  if (!resend) {
    console.warn('Email notifications not configured - skipping user email');
    return;
  }

  if (uid) {
    try {
      const doc = await db.collection('users').doc(uid).get();
      if (doc.exists && doc.data()?.emailPreferences?.transactional === false) {
        console.log(`User ${uid} opted out of transactional emails. Skipping.`);
        return;
      }
    } catch (e) {
      console.warn('Failed to check user email preferences, sending anyway', e);
    }
  }
  
  let finalTo = toEmail;
  let finalSubject = subject;
  if (EMAIL_TEST_MODE) {
    finalTo = NOTIFICATION_EMAIL;
    finalSubject = `[TEST -> ${toEmail}] ${subject}`;
  }
  
  try {
    const { error } = await resend.emails.send({
      from: 'Auditor AI <onboarding@resend.dev>',
      to: finalTo,
      subject: finalSubject,
      html,
    });
    if (error) console.error('Resend user email error:', error);
  } catch (err) {
    console.error('Failed to send user email:', err);
  }
}

// In-memory rate limit for public endpoints
const publicRateLimits = new Map<string, { count: number, resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const limit = publicRateLimits.get(ip);
  
  if (!limit || now > limit.resetAt) {
    publicRateLimits.set(ip, { count: 1, resetAt: now + 3600000 }); // 1 hour
    return false;
  }
  
  if (limit.count >= 5) return true;
  
  limit.count++;
  return false;
}

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

const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '(default)';
const db = admin.firestore();
if (FIRESTORE_DATABASE_ID !== '(default)') {
  db.settings({ databaseId: FIRESTORE_DATABASE_ID, ignoreUndefinedProperties: true });
} else {
  db.settings({ ignoreUndefinedProperties: true });
}

console.log(`[startup] Using Firestore database: ${FIRESTORE_DATABASE_ID}`);

export { db };

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
- Pick the SINGLE most specific category for each item from this list: "Goods", "Services", "Food & Beverage", "Travel", "Utilities", "Professional Fees", "Tax", "Shipping", "Other". Do NOT default to 'Other' unless absolutely no other category fits. Office stationery, computer hardware, packaging, raw materials → 'Goods'. Coffee, food, restaurants → 'Food & Beverage'. Hosting, electricity, internet → 'Utilities'. Lawyers, accountants, consulting → 'Professional Fees'.
- Extract dominant_category (string): Calculate the category with the highest total amount from the items array. If there is a tie, pick the one that appears first alphabetically.
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
    dominant_category: { type: Type.STRING, description: 'The most common or dominant category by amount' },
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
    'vendor', 'date', 'currency', 'payment_method', 'dominant_category', 'items',
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

  app.post('/api/feedback', async (req: any, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, error: 'Too many submissions. Please try again in an hour.' });
    }

    const { message, email, page, website } = req.body;
    
    // Honeypot check
    if (website) {
      return res.json({ success: true });
    }

    if (!message) return res.status(400).json({ success: false, error: 'Message is required' });

    // Optional auth check
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    let userUid = null;
    if (token) {
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        userUid = decoded.uid;
      } catch (e) {}
    }

    try {
      const timestamp = admin.firestore.FieldValue.serverTimestamp();
      
      await db.collection('feedback').add({
        message,
        email: email || null,
        page: page || null,
        userUid,
        timestamp,
        ip
      });

      await sendInternalAlert(
        '📝 New feedback',
        internalEmailHTML({
          title: '📝 New feedback',
          intro: `Feedback received from ${email || 'Anonymous'}`,
          data: {
            'User': email || 'Not provided',
            'UID': userUid || 'Anonymous',
            'Page': page || 'N/A',
            'Submitted': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
          },
          message: message,
          actionLabel: 'Open in Firestore',
          actionUrl: `https://console.firebase.google.com/project/${process.env.FIREBASE_PROJECT_ID || '_'}/firestore/databases/(default)/data/~2Ffeedback`
        })
      );

      if (email) {
        await sendUserEmail(
          email,
          'Thanks for your feedback — we hear you',
          userEmailHTML({
            greeting: 'Thanks for your feedback',
            bodyParagraphs: [
              "Got your feedback. I read every message personally and will get back to you within 2 business days if it needs a reply.",
              "Keep the feedback coming — it's how this product gets better."
            ]
          }),
          userUid
        );
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Feedback submission error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/waitlist', async (req, res) => {
    const ip = (req.ip || req.headers['x-forwarded-for'] || 'unknown').toString();
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, error: 'Too many submissions. Please try again in an hour.' });
    }

    const { email, plan, website } = req.body;
    
    if (website) {
      return res.json({ success: true });
    }

    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    try {
      const waitlistRef = db.collection('waitlist');
      
      // Check for duplicate
      const existing = await waitlistRef.where('email', '==', email).limit(1).get();
      if (!existing.empty) {
        return res.json({ success: true, message: 'Already on waitlist' });
      }

      await waitlistRef.add({
        email,
        plan: plan || 'FREE',
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ip
      });

      const totalCount = (await waitlistRef.count().get()).data().count;

      await sendInternalAlert(
        '🎉 New PRO waitlist signup',
        internalEmailHTML({
          title: '🎉 New PRO waitlist signup',
          intro: `User joined the waitlist for ${plan || 'PRO'}`,
          data: {
            'Email': email,
            'Plan Interest': plan || 'Not specified',
            'Total Waitlist Count': String(totalCount),
            'Timestamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          }
        })
      );

      await sendUserEmail(
        email,
        "You're on the waitlist for Auditor AI Pro",
        userEmailHTML({
          greeting: "You're on the waitlist",
          bodyParagraphs: [
            "You're in early. We'll email you the moment Pro launches with founding-member pricing locked in.",
            "In the meantime, your free account is good for 5 receipts per month — keep using it."
          ],
          ctaLabel: 'Open Auditor AI',
          ctaUrl: process.env.FRONTEND_ORIGIN || 'https://auditor.ai/dashboard'
        })
      );

      res.json({ success: true });
    } catch (err: any) {
      console.error('Waitlist submission error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/contact', async (req: any, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (isRateLimited(ip)) {
      return res.status(429).json({ success: false, error: 'Too many submissions. Please try again in an hour.' });
    }

    const { subject, message, reason, email, website } = req.body;
    
    if (website) {
      return res.json({ success: true });
    }

    if (!subject || !message || !reason) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    let userUid = null;
    if (token) {
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        userUid = decoded.uid;
      } catch (e) {}
    }

    try {
      await db.collection('contact_requests').add({
        subject,
        message,
        reason,
        email: email || null,
        userUid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ip
      });

      let emoji = '❓';
      let userSubject = 'We got your message';
      let userBody = `Got your message about: ${subject}. I'll reply within 2 business days from this email — you can just reply to this thread.`;
      
      if (reason === 'delete_account') {
        emoji = '🗑️';
        userSubject = 'Your deletion request was received';
        userBody = "Got it. Your account and all associated data will be permanently deleted within 30 days, as committed in our Privacy Policy. You'll get a confirmation email once it's done. If you change your mind, just reply to this email within the next few days.";
      } else if (reason === 'enterprise') {
        emoji = '💼';
        userSubject = "We'll be in touch about Enterprise";
        userBody = "Got your enterprise inquiry. I'll personally reply within 1 business day to set up a 30-min call to understand your needs.";
      }

      const countdownStr = reason === 'delete_account' ? ' (Process within 30 days)' : '';

      await sendInternalAlert(
        `${emoji} Contact request: ${reason}`,
        internalEmailHTML({
          title: `${emoji} Contact request: ${reason}`,
          intro: `User submitted a contact form for ${reason}`,
          data: {
            'Subject': subject,
            'User Email': email || 'Not provided',
            'User UID': userUid || 'Anonymous',
            'Action Required': countdownStr || 'Reply to user email',
            'Timestamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          },
          message
        })
      );

      if (email) {
        await sendUserEmail(
          email,
          userSubject,
          userEmailHTML({
            greeting: 'Hi there,',
            bodyParagraphs: [userBody]
          }),
          userUid
        );
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Contact submission error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post('/api/welcome', requireAuth, async (req: any, res: any) => {
    try {
      const userRef = db.collection('users').doc(req.uid);
      const doc = await userRef.get();
      const userData = doc.data() || {};
      
      if (userData.welcomeEmailSent) {
        return res.json({ success: true, message: 'Already sent' });
      }

      const email = req.body.email || (await admin.auth().getUser(req.uid)).email || 'unknown';
      const name = (email || 'there').split('@')[0];
      
      await sendInternalAlert(
        '🆕 New signup',
        internalEmailHTML({
          title: '🆕 New signup',
          intro: 'New user joined Auditor AI',
          data: {
            'Email': email,
            'UID': req.uid,
            'Timestamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
          }
        })
      );

      await sendUserEmail(
        email,
        'Welcome to Auditor AI 👋',
        userEmailHTML({
          greeting: `Hi ${name},`,
          bodyParagraphs: [
            "You're in. Your free account gives you 5 receipt audits per month — enough to try it out on your real workflow.",
            "Here's how to get started:",
            "1. Upload a receipt (image, PDF, or Excel)",
            "2. Watch the AI extract every line item in seconds",
            "3. Get an instant math check to catch errors"
          ],
          ctaLabel: "Upload your first receipt →",
          ctaUrl: process.env.FRONTEND_ORIGIN || "https://auditor.ai/dashboard"
        }),
        req.uid
      );

      await userRef.set({ welcomeEmailSent: true }, { merge: true });
      res.json({ success: true });
    } catch (err: any) {
      console.error('Welcome email error:', err);
      res.status(500).json({ error: err.message });
    }
  });
  
  app.post('/api/email-preferences', requireAuth, async (req: any, res: any) => {
    try {
      const userRef = db.collection('users').doc(req.uid);
      await userRef.set({ emailPreferences: req.body }, { merge: true });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/audit', requireAuth, async (req: any, res) => {
    const isAllowed = await rateLimit(req.uid);
    if (!isAllowed) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }
  
    // 1. Quota Enforcement
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
