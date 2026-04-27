export interface User {
  id: string;
  name: string;
  email: string;
  plan: "FREE" | "PRO" | "ENTERPRISE";
  scansLeft: number;
  picture?: string;
  companyName?: string;
  jobTitle?: string;
  phoneNumber?: string;
}

export interface Expense {
  id: string;
  amount: number;
  subtotal: number | null;
  taxAmount: number | null;
  currency: string | null;
  date: string;
  vendor: string;
  category: string | null;
  paymentMethod: string | null;
  documentType: string | null;
  vendorAddress: string | null;
  dueDate: string | null;
  invoiceNumber: string | null;
  discount: number | null;
  userRating: number | null;
  userFeedback: string | null;
  discrepancy: "yes" | "no" | null;
  discrepancyReason: string | null;
  rawText: string;
  confidence: number | null;
  createdAt: string;
}

export type SortKey = "date" | "vendor" | "amount";
export type SortDirection = "asc" | "desc";
