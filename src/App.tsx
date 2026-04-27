import React, { useState, useEffect, useMemo } from "react";
import { UploadCloud, Receipt, Calendar, DollarSign, AlertCircle, Loader2, Trash2, Edit2, Check, X, Search, ChevronUp, ChevronDown, Download, AlertTriangle, Tag, ArrowLeft, User as UserIcon, Star, Mail, FileText, Filter, Zap } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { GoogleGenAI } from "@google/genai";
import * as xlsx from "xlsx";
import { Routes, Route, useNavigate, Navigate, Link, useLocation } from "react-router-dom";
import imageCompression from "browser-image-compression";
import Footer from "./components/Footer";
import FeedbackDialog from "./components/FeedbackDialog";
import ToastContainer, { useToasts } from "./components/Toast";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Landing from "./pages/Landing";
import Legal from "./pages/Legal";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./lib/firebase";
import { doc, getDoc, collection, onSnapshot, query, orderBy, deleteDoc, updateDoc } from "firebase/firestore";
import { AuthContext, useAuth } from "./context/AuthContext";
import { Sidebar, MobileNav } from "./components/Navigation";
import { User, Expense, SortKey, SortDirection } from "./types";

const formatCurrency = (amount: number, currency: string | null) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `${currency === 'INR' ? '₹' : '$'}${amount.toFixed(2)}`;
  }
};

export function DashboardContent({ expenses, authFetch, logout, addToast, updateToast }: any) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [filterVendor, setFilterVendor] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const hasActiveFilters = filterVendor !== "" || filterMinAmount !== "" || filterMaxAmount !== "" || filterCategory !== "All";
  const clearFilters = () => {
    setFilterVendor("");
    setFilterMinAmount("");
    setFilterMaxAmount("");
    setFilterCategory("All");
  };

  const [uploadConfirm, setUploadConfirm] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [viewingLineItems, setViewingLineItems] = useState<Expense | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [editForm, setEditForm] = useState({ 
    vendor: "", 
    date: "", 
    amount: "", 
    dueDate: "", 
    invoiceNumber: "", 
    vendorAddress: "",
    category: "",
    userRating: 0,
    userFeedback: ""
  });
  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [draftData, setDraftData] = useState<{ id: string, form: any } | null>(null);

  useEffect(() => {
    const draftId = localStorage.getItem('draft_edit_expense_id');
    const draftForm = localStorage.getItem('draft_edit_form');
    if (draftId && draftForm) {
      try {
        setDraftData({ id: draftId, form: JSON.parse(draftForm) });
        setDraftPromptOpen(true);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (editingExpense) {
      localStorage.setItem('draft_edit_expense_id', editingExpense.id);
      localStorage.setItem('draft_edit_form', JSON.stringify(editForm));
    }
  }, [editForm, editingExpense]);

  const clearDraft = () => {
    localStorage.removeItem('draft_edit_expense_id');
    localStorage.removeItem('draft_edit_form');
    setDraftData(null);
    setDraftPromptOpen(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    setFile(e.target.files?.[0] || null);
  };

  const handleUploadClick = () => {
    if (!file) return;
    setUploadConfirm(true);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  async function confirmUpload() {
    if (!file) return;
    setUploadConfirm(false);
    setUploading(true);
    setError("");

    const toastId = addToast("Initializing AI Extraction...", "loading");

    try {
      if (user?.plan === "FREE" && user.scansLeft <= 0) {
        const msg = "Scan Limit Reached. High-performance extraction is reserved for Pro licenses.";
        setError(msg);
        updateToast(toastId, msg, "error");
        setUploading(false);
        return;
      }

      // 1. Prepare Data
      let textContent = "";
      let base64Data = "";
      const isExcel = file.name.match(/\.(xlsx|xls|csv)$/i);

      if (isExcel) {
        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: "buffer" });
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          textContent += `\n--- Sheet: ${sheetName} ---\n`;
          textContent += xlsx.utils.sheet_to_csv(sheet);
        }
      } else {
        // Image or PDF
        let fileToProcess = file;
        if (file.type.startsWith("image/")) {
           const options = {
             maxSizeMB: 1,
             maxWidthOrHeight: 1920,
             useWebWorker: true,
           };
           fileToProcess = await imageCompression(file, options);
        }
        base64Data = await fileToBase64(fileToProcess);
      }

      // 2. Call Gemini API Directly from Frontend
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
      
      const prompt = `You are an Elite Financial Auditor with zero tolerance for mathematical or extraction errors. 
Analyze the provided document (image, PDF, or spreadsheet text) with extreme attention to detail.

STRICT INSTRUCTIONS:
1. Extract the following fields accurately:
   - vendor (company name)
   - date (YYYY-MM-DD or Unknown)
   - currency (e.g., INR, USD)
   - items: array of { description, amount, category }
   - subtotal, tax, discount, total_amount (numbers)

2. Perform rigorous mathematical verification:
   - CHECK: Is (Sum of item amounts) == Subtotal?
   - CHECK: Is (Subtotal + Tax - Discount) == Total_Amount?
   - Set "discrepancy": "yes" if ANY of these checks fail by more than 0.05.
   - If discrepancy is "yes", you MUST provide a detailed "discrepancy_reason" explaining the exact math error found (e.g., "Sum of items is 450 but subtotal says 400. Difference of 50 found.").

3. Output ONLY a valid JSON object.

Required JSON Schema:
{
  "vendor": "string",
  "date": "YYYY-MM-DD",
  "currency": "string",
  "items": [{ "description": "string", "amount": number, "category": "string" }],
  "subtotal": number,
  "tax": number,
  "discount": number,
  "total_amount": number,
  "discrepancy": "yes" | "no",
  "discrepancy_reason": "string" | null,
  "confidence": number
}

Now process the document:`;

      const finalPrompt = prompt + (textContent ? `\n\nSPREADSHEET DATA:\n${textContent}` : "");
      
      const contents = textContent 
        ? [{ parts: [{ text: finalPrompt }] }] 
        : [{ 
            parts: [
              { text: finalPrompt },
              { inlineData: { data: base64Data, mimeType: file.type } }
            ] 
          }];

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents,
        config: {
          responseMimeType: "application/json",
        }
      });

      if (!response.text) throw new Error("No intelligence returned from Auditor AI.");

      let rawText = response.text.trim();
      // Handle potential markdown fences if model Ignores responseMimeType
      if (rawText.startsWith("```json")) {
        rawText = rawText.replace(/^```json\n/, "").replace(/\n```$/, "");
      } else if (rawText.startsWith("```")) {
        rawText = rawText.replace(/^```\n/, "").replace(/\n```$/, "");
      }

      const parsed = JSON.parse(rawText);
      console.log("Extracted Data:", parsed);

      // 3. Save to Firebase
      const { doc, collection, setDoc, getDoc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('./lib/firebase');
      const { handleFirestoreError, OperationType } = await import('./lib/firestoreUtils');

      if (user) {
        const expensePath = `users/${user.id}/expenses`;
        const expenseRef = doc(collection(db, 'users', user.id, 'expenses'));
        const expenseData = {
          vendor: parsed.vendor || "Unknown",
          date: parsed.date || "Unknown",
          amount: parseFloat(parsed.total_amount) || 0,
          subtotal: parseFloat(parsed.subtotal) || null,
          taxAmount: parseFloat(parsed.tax) || null,
          currency: parsed.currency || "INR",
          category: parsed.category || "Other",
          lineItems: JSON.stringify(parsed.items || []),
          discrepancy: parsed.discrepancy || "no",
          discrepancyReason: parsed.discrepancy_reason || parsed.discrepancyReason || null,
          confidence: parsed.confidence || 0,
          rawText: rawText,
          createdAt: serverTimestamp()
        };

        try {
          await setDoc(expenseRef, expenseData);
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `${expensePath}/${expenseRef.id}`);
        }

        if (user.plan === "FREE") {
          const userRef = doc(db, 'users', user.id);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
             try {
               await updateDoc(userRef, { scansLeft: Math.max(0, userDoc.data().scansLeft - 1) });
             } catch (err) {
               handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
             }
             refreshUser();
          }
        }
      }

      setFile(null);
      updateToast(toastId, "Audit Complete: Precision Verified.", "success");
    } catch (e: any) {
      console.error("Extraction failed", e);
      let errorMsg = e.message || "Extraction failed.";
      if (errorMsg.includes("API_KEY_INVALID")) {
        errorMsg = "Audit Engine Key Error. Please ensure your environment is configured.";
      }
      setError(errorMsg);
      updateToast(toastId, errorMsg, "error");
    } finally {
      setUploading(false);
    }
  }

  const startEdit = (exp: Expense) => {
    setEditingExpense(exp);
    setEditForm({ 
      vendor: exp.vendor, 
      date: exp.date, 
      amount: exp.amount.toString(),
      dueDate: exp.dueDate || "",
      invoiceNumber: exp.invoiceNumber || "",
      vendorAddress: exp.vendorAddress || "",
      category: exp.category || "Other",
      userRating: exp.userRating || 0,
      userFeedback: exp.userFeedback || ""
    });
  };

  const submitEdit = async () => {
    if (!editingExpense || !user) return;
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('./lib/firebase');
      const { handleFirestoreError, OperationType } = await import('./lib/firestoreUtils');
      
      const expenseRef = doc(db, 'users', user.id, 'expenses', editingExpense.id);
      try {
        await updateDoc(expenseRef, {
          vendor: editForm.vendor, 
          date: editForm.date, 
          category: editForm.category, 
          amount: parseFloat(editForm.amount), 
          dueDate: editForm.dueDate || null, 
          invoiceNumber: editForm.invoiceNumber || null, 
          vendorAddress: editForm.vendorAddress || null,
          userRating: editForm.userRating > 0 ? editForm.userRating : null,
          userFeedback: editForm.userFeedback || null
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}/expenses/${editingExpense.id}`);
      }

      if (editForm.userRating > 0) {
         addToast("Feedback Logged: Thank you for your precision audit.", "success");
      } else {
         addToast("Changes committed successfully.", "success");
      }
      clearDraft();
      setEditingExpense(null);
    } catch (e) {
      console.error("Failed to edit", e);
      addToast("Failed to commit changes.", "error");
    }
  };

  const confirmDelete = async () => {
    if (!expenseToDelete || !user) return;
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      const { db } = await import('./lib/firebase');
      const { handleFirestoreError, OperationType } = await import('./lib/firestoreUtils');
      
      try {
        await deleteDoc(doc(db, 'users', user.id, 'expenses', expenseToDelete));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.id}/expenses/${expenseToDelete}`);
      }
      
      addToast("Audit record deleted.", "success");
      setExpenseToDelete(null);
    } catch (e) {
      console.error("Failed to delete", e);
      addToast("Failed to delete record.", "error");
    }
  };

  const processedExpenses = useMemo(() => {
    let result = [...expenses];
    if (filterVendor) {
      result = result.filter(e => e.vendor.toLowerCase().includes(filterVendor.toLowerCase()));
    }
    if (filterCategory !== "All") {
      result = result.filter(e => e.category === filterCategory);
    }
    if (filterMinAmount) {
      const min = parseFloat(filterMinAmount);
      if (!isNaN(min)) result = result.filter(e => e.amount >= min);
    }
    if (filterMaxAmount) {
      const max = parseFloat(filterMaxAmount);
      if (!isNaN(max)) result = result.filter(e => e.amount <= max);
    }
    if (sortConfig !== null) {
      result.sort((a, b) => {
        if (sortConfig.key === "amount") {
          return sortConfig.direction === "asc" ? a.amount - b.amount : b.amount - a.amount;
        }
        if (sortConfig.key === "date" || sortConfig.key === "vendor") {
          const valA = (a[sortConfig.key] || "").toLowerCase();
          const valB = (b[sortConfig.key] || "").toLowerCase();
          if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
          if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
          return 0;
        }
        return 0;
      });
    }
    return result;
  }, [expenses, sortConfig, filterVendor, filterMinAmount, filterMaxAmount, filterCategory]);

  const requestSort = (key: SortKey) => {
    let direction: SortDirection = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const renderSortIndicator = (key: SortKey) => {
    if (sortConfig?.key !== key) return <div className="w-4" />;
    return sortConfig.direction === "asc" ? <ChevronUp className="w-4 h-4 inline" /> : <ChevronDown className="w-4 h-4 inline" />;
  };

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr || dateStr.toLowerCase() === "unknown") return "Unknown";
    try {
      const parsedDate = new Date(dateStr);
      if (isNaN(parsedDate.getTime())) return dateStr;
      return parsedDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  const exportCSV = () => {
    const headers = ["ID", "Vendor", "Category", "Payment Method", "Date", "Currency", "Amount", "Subtotal", "Tax", "Confidence"];
    const rows = processedExpenses.map(exp => [
      exp.id,
      `"${exp.vendor.replace(/"/g, '""')}"`,
      `"${exp.category || "Other"}"`,
      `"${exp.paymentMethod || "Unknown"}"`,
      `"${exp.date}"`,
      exp.currency || "USD",
      exp.amount.toFixed(2),
      exp.subtotal !== null ? exp.subtotal.toFixed(2) : "",
      exp.taxAmount !== null ? exp.taxAmount.toFixed(2) : "",
      exp.confidence !== null ? exp.confidence.toFixed(1) : ""
    ].join(","));
    
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `expenses_gemini_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const parseLineItems = (jsonString: string | null) => {
    if (!jsonString) return [];
    try {
      const parsed = JSON.parse(jsonString);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-4 md:p-8 pb-24 lg:pb-8">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
           <div className="flex items-center space-x-4">
              <button 
                onClick={() => navigate(-1)} 
                className="p-2 hover:bg-white rounded-xl transition-colors border border-slate-200 shadow-sm"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Financial Overview</h1>
                <p className="text-slate-500 font-medium text-sm mt-1">Auditor AI: Precision extracted intelligence.</p>
              </div>
           </div>
           
           <div className="flex items-center space-x-3">
              <Link to="/settings" className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-all shadow-sm overflow-hidden" title="Audit Account">
                {user?.picture ? (
                  <img src={user.picture} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-5 h-5" />
                )}
              </Link>
              <button 
                onClick={() => setFeedbackOpen(true)}
                className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-amber-500 hover:bg-amber-50 transition-all shadow-sm" 
                title="Rate Auditor AI"
              >
                 <Star className="w-5 h-5 fill-current" />
              </button>
              <div className="flex -space-x-2 mr-2">
                {[1,2,3].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 overflow-hidden shrink-0">
                    <img src={`https://picsum.photos/seed/${i + 50}/100`} referrerPolicy="no-referrer" alt="Team" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
              <button 
                className="text-xs font-bold px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all text-slate-700 shadow-sm flex items-center" 
                onClick={() => {
                  const shareUrl = window.location.origin;
                  if (user?.plan === "FREE") {
                    if (navigator.share) {
                      navigator.share({
                        title: 'Auditor AI',
                        text: 'Analyze expenses with 100% precision with Auditor AI.',
                        url: shareUrl
                      }).then(() => {
                        addToast("Invitation shared.", "success");
                      }).catch(() => {
                        navigator.clipboard.writeText(shareUrl);
                        addToast("Invite link copied to clipboard.", "success");
                      });
                    } else {
                      navigator.clipboard.writeText(shareUrl);
                      addToast("Invite link copied to clipboard.", "success");
                    }
                  } else {
                    navigator.clipboard.writeText(shareUrl);
                    addToast(`Elite Invite Active: [${user?.plan} MODE]. Link copied.`, "success");
                  }
                }}
              >
                <Mail className="w-3 h-3 mr-2" /> Invite
              </button>
           </div>
        </header>

        {/* Mobile Navigation - Only visible on small screens */}
        <MobileNav />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <section className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 shadow-indigo-100/50">
              <div className="flex items-center justify-between mb-2">
                 <h2 className="text-base font-bold text-slate-900">Upload Document</h2>
                 <div className="flex space-x-1">
                   <div className="p-1 px-2 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">PDF</div>
                   <div className="p-1 px-2 bg-green-50 text-green-600 text-[10px] font-bold rounded uppercase">EXCEL</div>
                 </div>
              </div>
              <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">Scan JPG, PNG, WebP, PDF invoices, or Excel spreadsheets instantly.</p>

              <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-all group relative mb-4 p-4 text-center">
                {file ? (
                  <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} className="text-center">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-3 text-blue-600">
                       <FileText className="h-6 w-6" />
                    </div>
                    <span className="text-xs font-bold text-slate-900 break-all line-clamp-2 px-2 leading-tight">{file.name}</span>
                    <button onClick={(e) => { e.preventDefault(); setFile(null); }} className="mt-2 text-[10px] font-bold text-red-500 hover:text-red-600 underline">Remove</button>
                  </motion.div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <UploadCloud className="h-6 w-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900">Click or drag document</span>
                  </>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                  onChange={handleFileChange}
                />
              </label>

              {error && (
                <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-xl text-xs mb-4 border border-red-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <p className="font-bold leading-tight">{error}</p>
                </div>
              )}

              <button
                onClick={handleUploadClick}
                disabled={!file || uploading}
                className="w-full flex items-center justify-center py-4 px-4 rounded-2xl text-sm font-bold text-white transition-all bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-200"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Auditing...
                  </>
                ) : (
                  "Run Vision Audit"
                )}
              </button>
              
              <Footer />
            </div>
          </section>

          <section className="lg:col-span-3">
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-full shadow-indigo-100/30">
              <div className="p-6 border-b border-slate-50 flex flex-col space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">Processed Ledger</h2>
                    <p className="text-sm text-slate-500 font-medium">Precision Audits: {processedExpenses.length} entries</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button 
                      onClick={exportCSV} 
                      className="flex items-center space-x-2 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-100 transition-all shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </button>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center px-2">
                        <X className="w-3 h-3 mr-1"/> Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search Vendor..." 
                      value={filterVendor}
                      onChange={(e) => setFilterVendor(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:outline-none font-medium"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:outline-none font-medium appearance-none"
                    >
                      <option value="All">All Categories</option>
                      <option value="Food & Dining">Food & Dining</option>
                      <option value="Travel">Travel</option>
                      <option value="Transport">Transport</option>
                      <option value="Groceries">Groceries</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Office Supplies">Office Supplies</option>
                      <option value="Software & Subscriptions">Software & Subscriptions</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      placeholder="Min $" 
                      value={filterMinAmount}
                      onChange={(e) => setFilterMinAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:outline-none font-medium"
                    />
                    <span className="text-slate-300">-</span>
                    <input 
                      type="number" 
                      placeholder="Max $" 
                      value={filterMaxAmount}
                      onChange={(e) => setFilterMaxAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:outline-none font-medium"
                    />
                  </div>
                  <div className="flex items-center justify-end">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm flex items-center">
                       {user?.plan} MODE
                    </div>
                  </div>
                </div>
              </div>

              {processedExpenses.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100 text-slate-200">
                    <Receipt className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">No data extracted yet</h3>
                  <p className="text-sm text-slate-500 max-w-sm mt-2 font-medium">Upload your first document to begin the AI audit loop.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-separate border-spacing-0">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th 
                          onClick={() => requestSort("vendor")}
                          className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-100"
                        >
                          <div className="flex items-center space-x-1"><span>Vendor & Entity</span>{renderSortIndicator("vendor")}</div>
                        </th>
                        <th 
                          onClick={() => requestSort("date")}
                          className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer hover:bg-slate-100 transition-colors border-b border-slate-100"
                        >
                          <div className="flex items-center space-x-1"><span>Timeline</span>{renderSortIndicator("date")}</div>
                        </th>
                        <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100">
                           Confidence
                        </th>
                        <th 
                          onClick={() => requestSort("amount")}
                          className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest cursor-pointer text-right hover:bg-slate-100 transition-colors border-b border-slate-100"
                        >
                          <div className="flex items-center justify-end space-x-1"><span>Valuation</span>{renderSortIndicator("amount")}</div>
                        </th>
                        <th className="px-6 py-4 w-12 border-b border-slate-100"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {processedExpenses.map((exp) => (
                        <motion.tr 
                          key={exp.id} 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`${exp.discrepancy === 'yes' ? 'bg-red-50/50 hover:bg-red-100/60' : 'hover:bg-slate-50/80'} transition-all group border-l-4 ${exp.discrepancy === 'yes' ? 'border-l-red-500' : 'border-l-transparent'}`}
                        >
                          <td className="px-6 py-5">
                            <div className="flex items-center space-x-4">
                               <div className={`w-10 h-10 ${exp.discrepancy === 'yes' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'} rounded-xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm shrink-0`}>
                                  <Receipt className="w-5 h-5" />
                               </div>
                               <div>
                                  <div className="text-sm font-bold text-slate-900 underline decoration-slate-200 underline-offset-4 decoration-2 flex items-center flex-wrap gap-2">
                                    {exp.vendor}
                                    {exp.invoiceNumber && (
                                      <span className="text-[10px] text-slate-400 font-medium font-mono uppercase tracking-widest break-all">#{exp.invoiceNumber}</span>
                                    )}
                                    {exp.discrepancy === 'yes' && (
                                      <span 
                                        className="inline-flex items-center text-[9px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm animate-pulse cursor-help" 
                                        title={exp.discrepancyReason || "Mathematical audit failed. Data may be inconsistent."}
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5 mr-1" /> MATH DISCREPANCY
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center space-x-1 text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-0.5">
                                     <Tag className="w-3 h-3" />
                                     <span>{exp.category || 'Unclassified'}</span>
                                  </div>
                               </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-sm font-bold text-slate-600">{exp.date}</div>
                            {exp.paymentMethod && exp.paymentMethod !== "Unknown" && (
                              <div className="text-[10px] text-slate-400 font-medium capitalize mt-1">{exp.paymentMethod}</div>
                            )}
                          </td>
                          <td className="px-6 py-5">
                             <div className="flex items-center space-x-2">
                                <div className="h-1.5 flex-1 max-w-[60px] bg-slate-100 rounded-full overflow-hidden border border-slate-50">
                                   <div 
                                      className={`h-full rounded-full ${(exp.confidence || 0) > 90 ? 'bg-emerald-500' : (exp.confidence || 0) > 70 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                      style={{ width: `${(exp.confidence || 0)}%` }} 
                                   />
                                </div>
                                <span className={`text-[10px] font-bold ${(exp.confidence || 0) > 90 ? 'text-emerald-600' : (exp.confidence || 0) > 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                   {Math.round(exp.confidence || 0)}%
                                </span>
                                {exp.userRating && (
                                   <div className="flex items-center ml-2 bg-yellow-50 px-1.5 py-0.5 rounded border border-yellow-100" title="User Feedback Provided">
                                     <Star className="w-2.5 h-2.5 text-yellow-500 fill-current mr-1" />
                                     <span className="text-[9px] font-bold text-yellow-700">{exp.userRating}</span>
                                   </div>
                                )}
                             </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                             <div className="text-sm font-black text-slate-900 leading-none">{formatCurrency(exp.amount, exp.currency)}</div>
                             <div className="text-[10px] text-slate-400 font-bold mt-1">Tax: {formatCurrency(exp.taxAmount || 0, exp.currency)}</div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex items-center justify-end space-x-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                               <button 
                                onClick={() => setViewingLineItems(exp)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View Details"
                               >
                                 <FileText className="w-4 h-4" />
                               </button>
                               <button 
                                onClick={() => startEdit(exp)}
                                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors" title="Edit"
                               >
                                 <Edit2 className="w-4 h-4" />
                               </button>
                               <button 
                                onClick={() => setExpenseToDelete(exp.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete"
                               >
                                 <Trash2 className="w-4 h-4" />
                               </button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
          
          <div>
          </div>
        </div>
      </main>

      {uploadConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Analyze with Vision AI?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to extract data from <strong className="break-all text-slate-800">{file?.name}</strong>? Gemini will scan for line items, categories, and taxes.</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setUploadConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={uploading}
              >
                Cancel
              </button>
              <button 
                onClick={confirmUpload}
                disabled={uploading}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {uploading ? "Analyzing..." : "Analyze Receipt"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {expenseToDelete && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Expense?</h3>
            <p className="text-sm text-slate-500 mb-6">This action cannot be undone. The extracted receipt and its AI breakdown will be removed permanently.</p>
            <div className="flex justify-end space-x-3">
              <button 
                onClick={() => setExpenseToDelete(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {editingExpense && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center"><Edit2 className="w-5 h-5 mr-2 text-blue-600"/> Edit Audit Record</h3>
              <button 
                onClick={() => { clearDraft(); setEditingExpense(null); }}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-6 mb-8 overflow-y-auto max-h-[65vh] pr-2 custom-scrollbar">
              {/* Group 1: Identity & Location */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-slate-400 mb-1">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Identification</span>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase">Vendor Name</label>
                  <input 
                    type="text" 
                    value={editForm.vendor}
                    onChange={e => setEditForm({...editForm, vendor: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase">Physical Address</label>
                  <input 
                    type="text" 
                    value={editForm.vendorAddress}
                    onChange={e => setEditForm({...editForm, vendorAddress: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder="Extraction point address"
                  />
                </div>
              </div>

              {/* Group 2: Temporal & Identification */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-slate-400 mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Temporal Logic</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase">Tran. Date</label>
                    <input 
                      type="text" 
                      value={editForm.date}
                      onChange={e => setEditForm({...editForm, date: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase">Due Date</label>
                    <input 
                      type="text" 
                      value={editForm.dueDate}
                      onChange={e => setEditForm({...editForm, dueDate: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase">Invoice Reference #</label>
                  <input 
                    type="text" 
                    value={editForm.invoiceNumber}
                    onChange={e => setEditForm({...editForm, invoiceNumber: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                    placeholder="N/A"
                  />
                </div>
              </div>

              {/* Group 3: Financial Details */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2 text-slate-400 mb-1">
                  <DollarSign className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Financial Audit</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase">Valuation</label>
                    <input 
                      type="number" 
                      step="0.01"
                      value={editForm.amount}
                      onChange={e => setEditForm({...editForm, amount: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 ml-1 uppercase">Category</label>
                    <select 
                      value={editForm.category}
                      onChange={e => setEditForm({...editForm, category: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all appearance-none"
                    >
                      <option value="Food & Dining">Food & Dining</option>
                      <option value="Travel">Travel</option>
                      <option value="Transport">Transport</option>
                      <option value="Groceries">Groceries</option>
                      <option value="Utilities">Utilities</option>
                      <option value="Office Supplies">Office Supplies</option>
                      <option value="Software & Subscriptions">Software & Subscriptions</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Shopping">Shopping</option>
                      <option value="Entertainment">Entertainment</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Group 4: Auditor Feedback */}
              <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-blue-600">
                    <Zap className="w-3.5 h-3.5" />
                    <h4 className="text-[10px] font-bold uppercase tracking-widest">Precision Feedback</h4>
                  </div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setEditForm({ ...editForm, userRating: star })}
                        className={`w-5 h-5 transition-all ${editForm.userRating >= star ? "text-yellow-400 fill-current" : "text-slate-300 hover:text-yellow-200"}`}
                      >
                        <Star className="w-full h-full" />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  placeholder="Did Auditor AI miss anything? Provide corrections for model fine-tuning..."
                  value={editForm.userFeedback}
                  onChange={(e) => setEditForm({ ...editForm, userFeedback: e.target.value })}
                  className="w-full p-4 bg-white border border-blue-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all resize-none h-24 placeholder:text-slate-400"
                ></textarea>
                <div className="flex justify-between items-center text-[10px] font-bold text-blue-700/60 uppercase tracking-tight">
                   <span>AI fine-tuning data collected</span>
                   {editingExpense.userRating && (
                     <span className="flex items-center"><Check className="w-3 h-3 mr-1"/> Prev. Feedback Logged</span>
                   )}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-slate-100">
              <button 
                onClick={() => { clearDraft(); setEditingExpense(null); }}
                className="px-6 py-2.5 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all"
              >
                Discard Changes
              </button>
              <button 
                onClick={submitEdit}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center"
              >
                <Check className="w-4 h-4 mr-2"/> Commit All Updates
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Line Items Modal */}
      {viewingLineItems && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 flex flex-col max-h-[80vh]"
          >
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{viewingLineItems.documentType ? viewingLineItems.documentType.toUpperCase() : "RECEIPT ITEMS"}</h3>
                <p className="text-sm text-slate-500 font-medium">{viewingLineItems.vendor}</p>
                {viewingLineItems.invoiceNumber && <p className="text-xs text-slate-400 mt-1">Invoice #: {viewingLineItems.invoiceNumber}</p>}
                {viewingLineItems.dueDate && <p className="text-xs text-red-400">Due: {viewingLineItems.dueDate}</p>}
              </div>
              <button 
                onClick={() => setViewingLineItems(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 -mr-2">
              {viewingLineItems.discrepancy === 'yes' && (
                <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3">
                  <div className="mt-0.5">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-red-700 uppercase tracking-widest mb-1">Audit Discrepancy Found</h4>
                    <p className="text-xs text-red-600 font-medium leading-relaxed">
                      {viewingLineItems.discrepancyReason || "Mathematical verification failed during extraction. Total amount does not match the sum of items + tax."}
                    </p>
                  </div>
                </div>
              )}
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-bold">
                    <th className="py-2 px-2">Item</th>
                    <th className="py-2 px-2 text-right">Qty</th>
                    <th className="py-2 px-2 text-right">Price</th>
                    <th className="py-2 px-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseLineItems(viewingLineItems.lineItems).map((item: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-2 font-medium text-slate-900">{item.name || "Unknown Item"}</td>
                      <td className="py-3 px-2 text-right text-slate-600">{item.quantity || 1}</td>
                      <td className="py-3 px-2 text-right text-slate-600">{item.unit_price ? formatCurrency(item.unit_price, viewingLineItems.currency) : "-"}</td>
                      <td className="py-3 px-2 text-right font-bold text-slate-900">{item.total_price ? formatCurrency(item.total_price, viewingLineItems.currency) : "-"}</td>
                    </tr>
                  ))}
                  {parseLineItems(viewingLineItems.lineItems).length === 0 && (
                     <tr>
                       <td colSpan={4} className="py-6 text-center text-slate-500 text-sm">No specific items could be extracted.</td>
                     </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center bg-slate-50 -mx-6 -mb-6 p-6 rounded-b-2xl">
              <div className="text-sm font-medium text-slate-500">
                {viewingLineItems.taxAmount ? `+ Tax: ${formatCurrency(viewingLineItems.taxAmount, viewingLineItems.currency)}` : 'No Tax'}
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-slate-500 mr-2">Total Amount</span>
                <span className="text-lg font-bold text-slate-900">{formatCurrency(viewingLineItems.amount, viewingLineItems.currency)}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Draft Recovery Prompt */}
      {draftPromptOpen && draftData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center"
          >
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Unsaved Changes Found</h3>
            <p className="text-sm text-slate-500 mb-6">
              You have an unsaved audit record edit for <strong>{draftData.form.vendor}</strong>. Would you like to restore it?
            </p>
            <div className="flex space-x-3">
              <button 
                onClick={clearDraft}
                className="flex-1 px-4 py-2 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
              >
                Discard
              </button>
              <button 
                onClick={() => {
                  const expenseToRestore = expenses.find(e => e.id === draftData.id);
                  if (expenseToRestore) {
                    setEditingExpense(expenseToRestore);
                    setEditForm(draftData.form);
                  }
                  setDraftPromptOpen(false);
                }}
                className="flex-1 px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-200"
              >
                Restore
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <FeedbackDialog isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  const { toasts, addToast, removeToast, updateToast } = useToasts();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const uToken = await fbUser.getIdToken();
        const docRef = doc(db, 'users', fbUser.uid);
        const docSnap = await getDoc(docRef);
        
        let userData = { id: fbUser.uid };
        if (docSnap.exists()) {
           userData = { ...userData, ...docSnap.data() };
        }
        
        setToken(uToken);
        setUser(userData as any);
        localStorage.setItem('token', uToken);
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
      setLoadingInitial(false);
    });
    return unsub;
  }, []);

  const login = (t: string, u: User) => {
    setToken(t);
    setUser(u);
  };
  
  const logout = async () => {
    const { signOut } = await import('firebase/auth');
    await signOut(auth);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (!user) return;
    try {
        const docRef = doc(db, 'users', user.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
           const userData = { id: user.id, ...docSnap.data() };
           setUser(userData as any);
           localStorage.setItem('user', JSON.stringify(userData));
        }
    } catch (e) {
      console.error(e);
    }
  };

  const authCtx = { token, user, login, logout, refreshUser };

  const authFetch = async (url: string, options: any = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...options.headers, 'Authorization': `Bearer ${token}` }
    });
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      logout();
    }
    return res;
  }

  // Pre-fetch expenses globally for Analytics & Reports
  useEffect(() => {
    if (user && user.id) {
      const q = query(collection(db, 'users', user.id, 'expenses'), orderBy('createdAt', 'desc'));
      const unsub = onSnapshot(q, (snapshot) => {
          const loadedExpenses = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          setExpenses(loadedExpenses);
      }, (error) => {
          import('./lib/firestoreUtils').then(({ handleFirestoreError, OperationType }) => {
            handleFirestoreError(error, OperationType.LIST, `users/${user.id}/expenses`);
          }).catch(console.error);
      });
      return unsub;
    }
  }, [user?.id]);

  if (loadingInitial) {
     return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <AuthContext.Provider value={authCtx}>
      <Routes>
        <Route path="/" element={!token ? <Landing /> : <DashboardContent expenses={expenses} authFetch={authFetch} logout={logout} addToast={addToast} updateToast={updateToast} />} />
        <Route path="/auth" element={!token ? <Auth setToken={setToken} setUser={setUser} /> : <Navigate to="/" />} />
        <Route path="/analytics" element={token ? <Analytics expenses={expenses} /> : <Navigate to="/auth" />} />
        <Route path="/reports" element={token ? <Reports expenses={expenses} authFetch={authFetch} addToast={addToast} /> : <Navigate to="/auth" />} />
        <Route path="/settings" element={token ? <Settings user={user} logout={logout} refreshUser={refreshUser} addToast={addToast} /> : <Navigate to="/auth" />} />
        <Route path="/privacy" element={<Legal />} />
        <Route path="/terms" element={<Legal />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthContext.Provider>
  )
}
