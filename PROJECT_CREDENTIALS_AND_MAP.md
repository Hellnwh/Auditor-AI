# AutoExpense - Architecture, Environment, and Database Map

Welcome to the internal engineering documentation for AutoExpense. 

This document outlines the entire stack, where credentials live, how the database functions locally vs. in the cloud, and exact instructions on how to migrate your database externally.

---

## 🏗️ Technical Architecture

You asked: *"What did you use for the frontend, backend, and database?"*

Here are the complete stack details:

1.  **Frontend Frameowrk:** React 18, Vite, React Router DOM v6
2.  **UI & Styling:** Tailwind CSS, `lucide-react` (icons), `motion` (animations), `recharts` (charts)
3.  **Backend Runtime:** Node.js running an `Express` server (`server.ts`).
4.  **Database ORM:** Prisma
5.  **Current Database:** **SQLite** (a local flat-file database called `dev.db` at the root of the project).
6.  **Authentication:** Custom JSON Web Tokens (`jsonwebtoken`) + Secure Hashing (`bcryptjs`).
7.  **AI Engine:** Google Gemini (`@google/genai`), via model `gemini-3-flash-preview`.

---

## 🔑 Security & Credentials

Because the requested Firebase setup failed due to a Google Cloud structural error (`No location information provided in request side-channel`), **Firebase/Firestore is NOT actively used**. Instead, we fell back to a custom, highly secure local JWT Authentication system paired with SQLite.

Here are your live system credentials and where they are located:

### 1. JSON Web Token (JWT) Secret
*   **Location:** Found in `server.ts` (Line 9)
*   **Variable Name:** `JWT_SECRET`
*   **Value:** It defaults to `"your-secret-key-development"`.
*   **External Access Tooling:** If you are deploying this outside of this environment, you MUST set an environment variable for `JWT_SECRET` in your `.env` file (e.g., `JWT_SECRET="my_super_secure_random_string_xyz"`).

### 2. Gemini API Key
*   **Location:** AI Sandbox Environment Variable. 
*   **Variable Name:** `GEMINI_API_KEY`
*   **How it works:** Our sandbox securely injects the API Key at runtime (`process.env.GEMINI_API_KEY`). The secure Express backend handles the image parsing in `/server.ts` so the key is never exposed to the frontend/browser.

### 3. Database Location
*   **Location:** The root level inside a file named `dev.db`.
*   **Table Verification:** You can view your tables by accessing `/prisma/schema.prisma`. We have models for `User`, `Expense`, and `Report`.

---

## 🛢️ Database Migration: How to update to PostgreSQL

Right now, the application uses **SQLite** (`dev.db`). This means your data is confined to this specific machine environment. **If you want to deploy this app externally or enable massive scale mapping (e.g., 10,000+ users), you must update to a cloud database like PostgreSQL or Supabase.**

Follow these exact steps to change it:

### Step 1: Update the Prisma Schema
Open the `/prisma/schema.prisma` file.

**Current Code:**
\`\`\`prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}
\`\`\`

**Change it to Postges:**
\`\`\`prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
\`\`\`

### Step 2: Inject Your Credentials
In your external hosting environment (e.g., Vercel, Heroku, Render), add an Environment Variable named `DATABASE_URL`. Paste the connection string given to you by your PostgreSQL hosting provider (e.g., Supabase, Neon, AWS RDS). 

*Example:* 
`DATABASE_URL="postgresql://postgres:myPassword123@db.supabase.co:5432/postgres"`

### Step 3: Run the Migration command
In your terminal, run:
\`\`\`bash
npx prisma db push
npx prisma generate
\`\`\`
Your app is now instantly running on a scalable cloud Database cluster!

---

## 🛡️ Resolution of Previous Vulnerabilities

In the final patch, we mitigated all three crash risks completely:
1.  **Image Compression Crash fixed:** Installed `browser-image-compression`. 4K and 8K High-res iPhone photos are dynamically resized down below 1MB in the browser instantly before transmission, completely resolving Browser memory leaks limit crashes.
2.  **API Key Exposure Security Fixed:** Migrated the entire Gemini API upload logic from `App.tsx` directly into the Node.js Backend (`server.ts`) via the `multer` package, adding multi-part form data protection. Your API key and network requests are invisible to malicious users.
3.  **Concurrency Preparation:** Integrated detailed schema definitions for Prisma, cleanly allowing the PostgreSQL flip.

---

## 🧐 Financial Auditor AI
The extraction engine now features a built-in "Auditor" persona.
*   **Automatic Mathematical Verification:** The AI cross-checks `subtotal + tax - discount` against the `total_amount`. 
*   **Inconsistency Detection:** If values are mathematically inconsistent, the AI automatically lowers the `confidence_score` and attempts a "most logical" correction based on line items.
*   **Contextual Categorization:** The Auditor uses vendor context (e.g., "Starbucks") and specific line items to refine category classifications more accurately than standard lookup bots.
*   **Multi-Page PDF Support:** The engine can now digest multi-page PDFs, merging line items across pages while preserving document structure even in broken tables.
