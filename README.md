# Auditor AI - Elite Financial Intelligence

Auditor AI is a high-precision financial auditing platform that extracts structured data from receipts and invoices using Gemini Vision AI. It doesn't just read data—it audits the math to ensure 100% accounting integrity.

This project is built using a **React + Vite** frontend and an **Express** backend, utilizing **Prisma ORM** with a zero-config **SQLite** database.

## Key Features 🛡️

* **Mathematical Auditing:** Standalone AI logic that verifies `subtotal + tax = total` to flag inconsistencies instantly.
* **Intelligent Extraction:** Extracts Vendor, Address, Invoice #, Due Date, Category, and detailed Line Items from PDFs and images.
* **Accuracy Scoring:** Visual confidence indicators based on mathematical integrity checks.
* **Premium Dashboard UI:** A clean, multi-page SaaS interface with dedicated Analytics and Reporting archival tools.
* **Professional Workflows:** Filter by category, audit range, and vendor; export precision-filtered CSVs for accounting systems.
* **Reports Architecture:** Group individual scans into structured archival reports for tax or team verification.
* **Zero Configuration:** Runs out of the box with a local SQLite database—zero external infrastructure required.

## Project Architecture & Key Files

* `package.json` - Custom entry-points launching our dual Vite Middleware + Express combo via `tsx server.ts`.
* `prisma/schema.prisma` - Establishes SQLite provider tracking string variables alongside complex JSON line item data mapping.
* `server.ts` - Node/Express backend that saves structured receipt variables securely to SQLite natively.
* `src/App.tsx` - Our monolithic responsive dashboard maintaining derived reactive states for search, sort, filters, modals, and managing the `@google/genai` library mapped onto specific structural JSON generation prompts via file uploads.
* `src/index.css` - Custom styling variables enforcing premium SaaS typography (`Inter` / `JetBrains Mono`) and hiding UI scrollbars for absolute cleanliness.

## Running Locally

Because this project uses SQLite, there is no need for external database setup!

**1. Install dependencies**
```bash
npm install
```

**2. Hydrate database & generate Prisma ORM methods**
```bash
npx prisma db push && npx prisma generate
```

**3. Start the dev server**
```bash
npm run dev
```

The Express backend natively launches on `http://localhost:3000` executing Vite SSR in development mode.

**Using the app**
Simply open your browser, click the upload box (or drag and drop depending on OS configuration), ensure the receipt is well-lit and the text contrasts heavily, and extract your data!
