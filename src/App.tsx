import React, { useState, useEffect, useMemo } from "react";
import { UploadCloud, Receipt, Calendar, DollarSign, AlertCircle, Loader2, Trash2, Edit2, Check, X, Search, ChevronUp, ChevronDown, Download, AlertTriangle, Tag, ArrowLeft, User as UserIcon, Star, Mail, FileText, Filter, Zap, MoreVertical, Camera } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as xlsx from "xlsx";
import { Routes, Route, useNavigate, Navigate, Link, useLocation } from "react-router-dom";
import imageCompression from "browser-image-compression";
import Footer from "./components/Footer";
import FeedbackDialog from "./components/FeedbackDialog";
import ToastContainer, { useToasts } from "./components/Toast";
import Auth from "./pages/Auth";
import Analytics from "./pages/Analytics";
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
  const fmtSafe = (n: any, decimals = 2): string => {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '0.00';
    return Number(n).toFixed(decimals);
  };

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `${currency === 'INR' ? '₹' : '$'}${fmtSafe(amount)}`;
  }
};

export function DashboardContent({ expenses, authFetch, logout, addToast, updateToast }: any) {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>(null);
  const [filterVendor, setFilterVendor] = useState("");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterDiscrepancy, setFilterDiscrepancy] = useState("All");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");

  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const hasActiveFilters = filterVendor !== "" || filterMinAmount !== "" || filterMaxAmount !== "" || filterCategory !== "All" || filterDiscrepancy !== "All" || filterStartDate !== "" || filterEndDate !== "";
  const clearFilters = () => {
    setFilterVendor("");
    setFilterMinAmount("");
    setFilterMaxAmount("");
    setFilterCategory("All");
    setFilterDiscrepancy("All");
    setFilterStartDate("");
    setFilterEndDate("");
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
    const newFiles: File[] = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    // Cleanup old previews
    previewUrls.forEach(url => URL.revokeObjectURL(url));

    const urls = newFiles
      .filter((f: File) => f.type.startsWith('image/'))
      .map((f: File) => URL.createObjectURL(f));
    
    setFiles(newFiles);
    setPreviewUrls(urls);
    if (urls.length > 0) {
      setShowPreview(true);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError("");
    const newFile: File | null = e.target.files?.[0] || null;
    if (!newFile) return;

    // Cleanup old previews
    previewUrls.forEach(url => URL.revokeObjectURL(url));

    const url = URL.createObjectURL(newFile);
    setFiles([newFile]);
    setPreviewUrls([url]);
    setShowPreview(true);
  };

  const resetUpload = () => {
    previewUrls.forEach(url => URL.revokeObjectURL(url));
    setFiles([]);
    setPreviewUrls([]);
    setShowPreview(false);
    setUploadConfirm(false);
  };

  const handleUploadClick = () => {
    if (files.length === 0) return;
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

  const [quotaExceededInfo, setQuotaExceededInfo] = useState<{ resetDate: string } | null>(null);

  async function confirmUpload() {
    if (files.length === 0) return;
    setUploadConfirm(false);
    setUploading(true);
    setError("");

    const toastId = addToast(`Analyzing ${files.length} document${files.length > 1 ? 's' : ''}...`, "loading");
    let processedCount = 0;

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
         addToast(`Skipped ${file.name}: File > 10MB`, "error");
         continue;
      }
      try {
        // 1. Prepare Data
        let textContent = "";
        let base64Data = "";
        const isExcel = file.name.match(/\.(xlsx|xls|csv)$/i);

        if (isExcel) {
          const buffer = await file.arrayBuffer();
          const workbook = xlsx.read(buffer, { type: "buffer" });
          
          let foundData = false;
          for (const sheetName of workbook.SheetNames) {
            if (sheetName.match(/read\s*me|instruction|guideline|intro/i)) continue;
            
            const sheet = workbook.Sheets[sheetName];
            const rows: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
            
            const nonEmptyRows = rows.filter(row => row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''));
            
            if (nonEmptyRows.length > 0) {
              textContent = `\n--- Sheet: ${sheetName} ---\n`;
              
              const maxCols = Math.max(...nonEmptyRows.map(r => r.length));
              if (maxCols > 0) {
                nonEmptyRows.forEach((row, i) => {
                  const cells = Array.from({ length: maxCols }).map((_, c) => {
                    const val = row[c];
                    return val ? String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ') : '';
                  });
                  textContent += `| ${cells.join(' | ')} |\n`;
                  if (i === 0) {
                    const separator = Array.from({ length: maxCols }).map(() => '---');
                    textContent += `| ${separator.join(' | ')} |\n`;
                  }
                });
                foundData = true;
                break; // Limit to one invoice per upload
              }
            }
          }
          
          if (!foundData && workbook.SheetNames.length > 0) {
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            textContent = `\n--- Sheet: ${sheetName} ---\n`;
            textContent += xlsx.utils.sheet_to_csv(sheet);
          }
        } else {
          // Image or PDF
          let fileToProcess = file;
          if (file.type.startsWith("image/")) {
             const options = {
               maxSizeMB: 1.5,
               maxWidthOrHeight: 2000,
               useWebWorker: true,
               fileType: "image/jpeg",
               initialQuality: 0.85
             };
             try {
               fileToProcess = await imageCompression(file, options);
             } catch (err) {
               console.warn("Compression failed, using original", err);
             }
          }
          base64Data = await fileToBase64(fileToProcess);
        }

        // 2. Call backend for AI extraction
        const { runAudit } = await import('./services/audit');
        const parsed = await runAudit({
          fileBase64: base64Data,
          mimeType: base64Data ? file.type : undefined,
          spreadsheetText: textContent,
          useGoogleSearch: true
        });
        
        console.log("Extracted Data:", parsed);

        // Low confidence check
        if (parsed.confidence && parsed.confidence < 0.5) {
          addToast(`Low confidence for ${file.name}. Ensure good lighting and focus.`, "warning");
          setError("This photo was hard to read. Try again with better lighting, less glare, and the receipt fully in frame.");
        }

        // 3. Save to Firebase
        const { doc, collection, setDoc, serverTimestamp } = await import('firebase/firestore');
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
            paymentMethod: parsed.payment_method || "Unknown",
            lineItems: JSON.stringify(parsed.items || []),
            discrepancy: parsed.discrepancy || "no",
            discrepancyReason: parsed.discrepancy_reason || parsed.discrepancyReason || null,
            confidence: parsed.confidence || 0,
            rawText: JSON.stringify(parsed),
            createdAt: serverTimestamp()
          };

          try {
            await setDoc(expenseRef, expenseData);
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `${expensePath}/${expenseRef.id}`);
          }
        }
        processedCount++;
      } catch (e: any) {
        console.error(`Extraction failed for ${file.name}`, e);
        if (e.status === 402) {
          setQuotaExceededInfo({ resetDate: e.resetDate });
          updateToast(toastId, "Scan limit reached.", "error");
          processedCount = 0; // stop processing
          break;
        }
        let errorMsg = e.message || "Extraction failed.";
        if (errorMsg.includes("API_KEY_INVALID") || errorMsg.includes("leaked")) {
           errorMsg = "API Key Error. Check configuration.";
        } else if (errorMsg.includes("auth token") || errorMsg.includes("unauthenticated")) {
           errorMsg = "Your session expired, please sign in again.";
        }
        addToast(`Failed: ${file.name} - ${errorMsg}`, "error");
      }
    }

    setFiles([]);
    setUploading(false);
    if (processedCount > 0) {
       updateToast(toastId, `Audit Complete: ${processedCount} processed.`, "success");
    } else {
       updateToast(toastId, `No files processed.`, "error");
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

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    expenses.forEach(e => {
      if (e.category) cats.add(e.category);
      // Also check line items for categories if top-level is missing
      if (!e.category && e.lineItems) {
        try {
          const items = JSON.parse(e.lineItems);
          if (Array.isArray(items) && items[0]?.category) {
            cats.add(items[0].category);
          }
        } catch (err) {}
      }
    });
    return Array.from(cats).sort();
  }, [expenses]);

  const processedExpenses = useMemo(() => {
    let result = [...expenses];
    if (filterVendor) {
      result = result.filter(e => e.vendor.toLowerCase().includes(filterVendor.toLowerCase()));
    }
    if (filterCategory !== "All") {
      result = result.filter(e => e.category === filterCategory);
    }
    if (filterDiscrepancy !== "All") {
      result = result.filter(e => {
        const hasDisc = (e.discrepancy || "").toLowerCase() === "yes";
        return filterDiscrepancy === "Yes" ? hasDisc : !hasDisc;
      });
    }
    if (filterStartDate) {
      const start = new Date(filterStartDate).getTime();
      result = result.filter(e => {
         const expDate = new Date(e.date).getTime();
         return isNaN(expDate) || expDate >= start;
      });
    }
    if (filterEndDate) {
      const end = new Date(filterEndDate).getTime();
      result = result.filter(e => {
         const expDate = new Date(e.date).getTime();
         return isNaN(expDate) || expDate <= end;
      });
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
  }, [expenses, sortConfig, filterVendor, filterMinAmount, filterMaxAmount, filterCategory, filterDiscrepancy, filterStartDate, filterEndDate]);

  const currencyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const exp of processedExpenses) {
      const cur = exp.currency || 'USD';
      totals[cur] = (totals[cur] || 0) + exp.amount;
    }
    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [processedExpenses]);

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

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMenuId && !(e.target as Element).closest('.row-actions-menu')) {
        setActiveMenuId(null);
      }
      if (exportMenuOpen && !(e.target as Element).closest('.bulk-export-menu')) {
        setExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenuId, exportMenuOpen]);

  const fmt = (n: any, decimals = 2): string => {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return '';
    return Number(n).toFixed(decimals);
  };

  const exportSingleXLSX = (exp: Expense) => {
    try {
      const wb = xlsx.utils.book_new();

      // Summary sheet
      const summaryData = [{
        Vendor: exp.vendor || '',
        Date: exp.date || '',
        Currency: exp.currency || '',
        Subtotal: Number(exp.subtotal ?? 0),
        Tax: Number(exp.taxAmount ?? 0),
        Discount: Number(exp.discount ?? 0),
        Total: Number(exp.amount ?? 0),
        Discrepancy: exp.discrepancy || 'no',
        'Discrepancy Reason': exp.discrepancyReason || '',
        Confidence: Number(exp.confidence ?? 0),
      }];
      const summarySheet = xlsx.utils.json_to_sheet(summaryData);
      xlsx.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Line Items sheet
      const items = parseLineItems(exp.lineItems);
      const itemsData = items.map((i: any) => ({
        Description: i.description || i.name || '',
        Quantity: Number(i.quantity ?? 1),
        'Unit Price': Number(i.unit_price ?? (i.amount || 0)),
        Amount: Number(i.amount ?? i.total_price ?? 0),
        Category: i.category || exp.category || 'Other',
      }));
      const itemsSheet = xlsx.utils.json_to_sheet(itemsData);
      xlsx.utils.book_append_sheet(wb, itemsSheet, 'Line Items');

      // Column widths
      summarySheet['!cols'] = [
        { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 40 }, { wch: 10 },
      ];
      itemsSheet['!cols'] = [
        { wch: 40 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
      ];

      const vendorSlug = exp.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const dateStr = exp.date;
      const shortId = exp.id.slice(0, 6);
      const filename = `${vendorSlug}-${dateStr}-${shortId}.xlsx`;
      xlsx.writeFile(wb, filename);
      addToast("Audit data exported as Excel.", "success");
    } catch (err: any) {
      console.error('Single XLSX Export failed:', err);
      addToast(`Export failed: ${err.message || 'Unknown error'}`, "error");
    }
  };

  const exportXLSX = () => {
    try {
      const wb = xlsx.utils.book_new();

      // Summary sheet
      const summaryData = processedExpenses.map(e => ({
        Vendor: e.vendor || '',
        Date: e.date || '',
        Currency: e.currency || '',
        Subtotal: Number(e.subtotal ?? 0),
        Tax: Number(e.taxAmount ?? 0),
        Discount: Number(e.discount ?? 0),
        Total: Number(e.amount ?? 0),
        Discrepancy: e.discrepancy || 'no',
        'Discrepancy Reason': e.discrepancyReason || '',
        Confidence: Number(e.confidence ?? 0),
      }));
      const summarySheet = xlsx.utils.json_to_sheet(summaryData);
      xlsx.utils.book_append_sheet(wb, summarySheet, 'Summary');

      // Line Items sheet
      const itemsData = processedExpenses.flatMap(e => {
        const items = parseLineItems(e.lineItems);
        return items.map((i: any) => ({
          Vendor: e.vendor || '',
          Date: e.date || '',
          Description: i.description || i.name || '',
          Quantity: Number(i.quantity ?? 1),
          'Unit Price': Number(i.unit_price ?? (i.amount || 0)),
          Amount: Number(i.amount ?? i.total_price ?? 0),
          Category: i.category || e.category || 'Other',
        }));
      });
      const itemsSheet = xlsx.utils.json_to_sheet(itemsData);
      xlsx.utils.book_append_sheet(wb, itemsSheet, 'Line Items');

      // Column widths
      summarySheet['!cols'] = [
        { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 },
        { wch: 40 }, { wch: 10 },
      ];
      itemsSheet['!cols'] = [
        { wch: 30 }, { wch: 12 }, { wch: 40 }, { wch: 10 },
        { wch: 12 }, { wch: 12 }, { wch: 18 },
      ];

      const filename = `auditor-ai-export-${new Date().toISOString().split("T")[0]}.xlsx`;
      xlsx.writeFile(wb, filename);
      addToast(`Exported ${processedExpenses.length} records to Excel.`, "success");
    } catch (err: any) {
      console.error('XLSX Export failed:', err);
      alert(`Excel Export failed: ${err.message || 'Unknown error'}. Please try again.`);
    }
  };

  const exportSingleJSON = (exp: Expense) => {
    try {
      const dataStr = JSON.stringify(exp, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const link = document.createElement("a");
      const vendorSlug = exp.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const dateStr = exp.date;
      const shortId = exp.id.slice(0, 6);
      
      link.href = URL.createObjectURL(blob);
      link.download = `${vendorSlug}-${dateStr}-${shortId}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      addToast("Audit data exported as JSON.", "success");
    } catch (err: any) {
      console.error('JSON Export failed:', err);
      addToast(`Export failed: ${err.message || 'Unknown error'}`, "error");
    }
  };

  const exportSingleCSV = (exp: Expense) => {
    try {
      const summaryHeaders = ["Vendor", "Date", "Currency", "Subtotal", "Tax", "Discount", "Total", "Discrepancy", "Discrepancy Reason", "Confidence"];
      const summaryRow = [
        `"${exp.vendor.replace(/"/g, '""')}"`,
        `"${exp.date}"`,
        exp.currency || "USD",
        fmt(exp.subtotal ?? 0),
        fmt(exp.taxAmount ?? 0),
        fmt(exp.discount ?? 0),
        fmt(exp.amount ?? 0),
        exp.discrepancy || "no",
        `"${(exp.discrepancyReason || "").replace(/"/g, '""')}"`,
        fmt(exp.confidence ?? 0)
      ].join(",");

      const itemHeaders = ["Description", "Quantity", "Unit Price", "Amount", "Category"];
      const items = parseLineItems(exp.lineItems);
      const itemRows = items.map((item: any) => {
        const itemName = item.description || item.name || item.category || "Unknown Item";
        const q = item.quantity !== undefined && item.quantity !== null ? item.quantity : 1;
        const up = item.unit_price !== undefined && item.unit_price !== null ? item.unit_price : (item.amount || item.total_price || 0);
        const p = item.amount !== undefined && item.amount !== null ? item.amount : item.total_price;
        const cat = item.category || exp.category || "Other";
        
        return [
          `"${itemName.replace(/"/g, '""')}"`,
          q,
          fmt(up ?? 0),
          fmt(p ?? 0),
          `"${cat}"`
        ].join(",");
      });

      const csvContent = [
        "# Invoice Summary",
        summaryHeaders.join(","),
        summaryRow,
        "",
        "# Line Items",
        itemHeaders.join(","),
        ...itemRows
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const vendorSlug = exp.vendor.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const dateStr = exp.date;
      const shortId = exp.id.slice(0, 6);
      
      link.href = URL.createObjectURL(blob);
      link.download = `${vendorSlug}-${dateStr}-${shortId}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      addToast("Audit data exported as CSV.", "success");
    } catch (err: any) {
      console.error('CSV Export failed:', err);
      addToast(`Export failed: ${err.message || 'Unknown error'}`, "error");
    }
  };

  const exportCSV = () => {
    try {
      const headers = [
        "ID", "Vendor", "Date", "Currency", "Payment Method", "Confidence", 
        "Discrepancy", "Discrepancy Reason", 
        "Total Amount", "Subtotal", "Tax", "Discount",
        "Item Name", "Item Quantity", "Item Unit Price", "Item Total Price", "Item Category"
      ];
      
      const rows: string[] = [];
      
      processedExpenses.forEach(exp => {
        const baseRow = [
          exp.id,
          `"${exp.vendor.replace(/"/g, '""')}"`,
          `"${exp.date}"`,
          exp.currency || "USD",
          `"${exp.paymentMethod || "Unknown"}"`,
          exp.confidence !== null ? Math.round((exp.confidence || 0) * 100) + '%' : "0%",
          exp.discrepancy || "no",
          `"${(exp.discrepancyReason || "").replace(/"/g, '""')}"`,
          fmt(exp.amount ?? 0),
          fmt(exp.subtotal ?? 0),
          fmt(exp.taxAmount ?? 0),
          fmt(exp.discount ?? 0)
        ];

        const items = parseLineItems(exp.lineItems);
        if (items.length === 0) {
           rows.push([...baseRow, "", "", "", "", `"${exp.category || "Other"}"`].join(","));
        } else {
           items.forEach((item: any) => {
              const itemName = item.description || item.name || item.category || "Unknown Item";
              const q = item.quantity;
              const up = item.unit_price;
              const p = item.amount !== undefined && item.amount !== null ? item.amount : item.total_price;
              const cat = item.category || exp.category || "Other";
              
              rows.push([...baseRow, 
                `"${itemName.replace(/"/g, '""')}"`,
                q !== undefined && q !== null ? q : "",
                fmt(up),
                fmt(p),
                `"${cat}"`
              ].join(","));
           });
        }
      });

      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `auditor-ai-export-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      addToast(`Exported ${processedExpenses.length} records.`, "success");
    } catch (err: any) {
      console.error('Bulk Export failed:', err);
      // Fallback to alert as requested by user
      alert(`Export failed: ${err.message || 'Unknown error'}. Please try again or contact support.`);
    }
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

  const [hintIndex, setHintIndex] = useState(0);
  const hints = [
    "Lay receipt flat on a dark surface",
    "Avoid shadows and glare",
    "Capture the entire receipt including the total",
    "Ensure all text is in sharp focus",
    "Align the receipt vertically for best OCR"
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setHintIndex((prev) => (prev + 1) % hints.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      {/* Quota Exceeded Modal */}
      <AnimatePresence>
        {quotaExceededInfo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden border border-white"
            >
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center mb-6 border border-blue-100 shadow-sm mx-auto">
                  <Zap className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-3">Scan Limit Reached</h3>
                <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                  You've used all 5 free scans this month. Upgrade to Pro for unlimited scans and high-performance extraction, or wait for your quota to reset.
                </p>
                
                <div className="bg-slate-50 rounded-2xl p-4 mb-8">
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Quota Resets On</div>
                  <div className="text-sm font-bold text-slate-900">
                    {new Date(quotaExceededInfo.resetDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <button 
                    disabled
                    className="w-full py-4 bg-slate-100 text-slate-400 font-bold text-sm rounded-2xl transition-all cursor-not-allowed flex items-center justify-center"
                  >
                    Upgrade to Pro <span className="ml-2 text-[8px] bg-slate-200 px-1.5 py-0.5 rounded uppercase">Coming Soon</span>
                  </button>
                  <button 
                    onClick={() => setQuotaExceededInfo(null)}
                    className="w-full py-4 bg-white text-slate-600 hover:bg-slate-50 font-bold text-sm rounded-2xl transition-all border border-slate-200"
                  >
                    Got it
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                    <img src={`https://randomuser.me/api/portraits/women/${40 + i}.jpg`} referrerPolicy="no-referrer" alt="Team" className="w-full h-full object-cover" />
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

              <div className="flex flex-col space-y-3 mb-6">
                <button 
                  onClick={() => cameraInputRef.current?.click()}
                  className="w-full h-24 sm:h-auto flex flex-col sm:flex-row items-center justify-center py-4 px-4 border-2 border-slate-900 rounded-2xl text-xs sm:text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                >
                  <Camera className="w-6 h-6 sm:w-5 sm:h-5 sm:mr-3 mb-2 sm:mb-0" />
                  Capture with Camera
                </button>

                <label className="flex flex-col items-center justify-center w-full h-20 sm:h-24 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 hover:bg-slate-50 cursor-pointer transition-all group relative p-4 text-center">
                  <div className="flex items-center space-x-2">
                    <UploadCloud className="h-4 w-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-600 group-hover:text-slate-900 leading-tight">Upload Document</span>
                  </div>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                    onChange={handleFileChange}
                  />
                </label>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                  ref={cameraInputRef}
                />
              </div>

              <div className="mb-6 p-3 bg-indigo-50/30 rounded-xl border border-indigo-100 flex items-start space-x-3">
                <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center text-indigo-500 shadow-sm shrink-0 mt-0.5">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-1">Audit Tip</p>
                  <motion.p 
                    key={hintIndex}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-[11px] text-indigo-600 font-medium leading-tight"
                  >
                    {hints[hintIndex]}
                  </motion.p>
                </div>
              </div>

              {files.length > 0 && !showPreview && (
                <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-100 flex items-center justify-between">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-blue-800 truncate">{files.length === 1 ? files[0].name : `${files.length} selected`}</span>
                  </div>
                  <button onClick={resetUpload} className="text-[10px] font-bold text-red-500 hover:text-red-700">Clear</button>
                </div>
              )}

              {error && (
                <div className="flex flex-col space-y-2 bg-red-50 p-4 rounded-xl text-xs mb-4 border border-red-100">
                  <div className="flex items-center space-x-2 text-red-600">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <p className="font-bold leading-tight">{error}</p>
                  </div>
                  {error.includes("lighting") && (
                    <button 
                      onClick={resetUpload}
                      className="mt-2 w-full py-2 bg-white border border-red-200 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-colors uppercase tracking-widest"
                    >
                      Retry / Re-take
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={handleUploadClick}
                disabled={files.length === 0 || uploading}
                className="w-full flex items-center justify-center py-4 px-4 rounded-2xl text-sm font-bold text-white transition-all bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-slate-200"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Analyzing...
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
                  <div className="flex flex-col">
                    <h2 className="text-base font-bold text-slate-900">Processed Ledger</h2>
                    <div className="flex items-center space-x-3 text-sm text-slate-500 font-medium">
                      <span>{processedExpenses.length} entries</span>
                      {currencyTotals.length > 0 && (
                        <div className="flex items-center space-x-2 border-l border-slate-200 pl-3">
                          {currencyTotals.map(([cur, amount]) => (
                            <span key={cur} className="flex items-center space-x-1">
                              <span className="text-[10px] uppercase font-bold text-slate-400">{cur}</span>
                              <span className="text-slate-700 font-black">{formatCurrency(amount, cur)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 relative">
                    <div className="relative bulk-export-menu">
                      <button 
                        onClick={() => setExportMenuOpen(!exportMenuOpen)} 
                        className="flex items-center space-x-2 px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
                      </button>

                      <AnimatePresence>
                        {exportMenuOpen && (
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 5 }}
                            className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 py-2 overflow-hidden"
                          >
                            <button 
                              onClick={() => { exportXLSX(); setExportMenuOpen(false); }}
                              className="w-full flex items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5 mr-3 text-emerald-500" />
                              Excel (.xlsx)
                              <span className="ml-auto text-[8px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded">NEW</span>
                            </button>
                            <button 
                              onClick={() => { exportCSV(); setExportMenuOpen(false); }}
                              className="w-full flex items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                            >
                              <Tag className="w-3.5 h-3.5 mr-3 text-blue-500" />
                              CSV
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {hasActiveFilters && (
                      <button onClick={clearFilters} className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center px-2">
                        <X className="w-3 h-3 mr-1"/> Clear
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                  <div className="relative col-span-1 sm:col-span-2 md:col-span-1 lg:col-span-2">
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
                      {uniqueCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <AlertCircle className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <select 
                      value={filterDiscrepancy}
                      onChange={(e) => setFilterDiscrepancy(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:outline-none font-medium appearance-none"
                    >
                      <option value="All">Any Status</option>
                      <option value="Yes">Discrepancy Found</option>
                      <option value="No">No Discrepancies</option>
                    </select>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input 
                      title="Start Date"
                      type="date" 
                      value={filterStartDate}
                      onChange={(e) => setFilterStartDate(e.target.value)}
                      className="w-full px-2 py-2 text-[10px] bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:outline-none font-medium text-slate-600"
                    />
                    <span className="text-slate-300">-</span>
                    <input 
                      title="End Date"
                      type="date" 
                      value={filterEndDate}
                      onChange={(e) => setFilterEndDate(e.target.value)}
                      className="w-full px-2 py-2 text-[10px] bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/10 focus:outline-none font-medium text-slate-600"
                    />
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
                </div>
              </div>

              {processedExpenses.length === 0 ? (
                <div className="p-20 text-center flex flex-col items-center">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100 text-slate-200">
                    <Receipt className="w-10 h-10" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 leading-tight">
                    {expenses.length === 0 ? "No data extracted yet" : "No matching records"}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-sm mt-2 font-medium">
                    {expenses.length === 0 ? "Upload your first document to begin the AI audit loop." : "Try adjusting your search criteria or clearing filters."}
                  </p>
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
                                     <span>{exp.category || (parseLineItems(exp.lineItems)[0]?.category) || 'Unclassified'}</span>
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
                                      className={`h-full rounded-full ${Math.round((exp.confidence || 0) * 100) > 90 ? 'bg-emerald-500' : Math.round((exp.confidence || 0) * 100) > 70 ? 'bg-amber-500' : 'bg-red-500'}`} 
                                      style={{ width: `${Math.round((exp.confidence || 0) * 100)}%` }} 
                                   />
                                </div>
                                <span className={`text-[10px] font-bold ${Math.round((exp.confidence || 0) * 100) > 90 ? 'text-emerald-600' : Math.round((exp.confidence || 0) * 100) > 70 ? 'text-amber-600' : 'text-red-600'}`}>
                                   {Math.round((exp.confidence || 0) * 100)}%
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
                          <td className="px-6 py-5 text-right relative overflow-visible">
                            <div className="flex items-center justify-end space-x-1">
                               <button 
                                onClick={() => setActiveMenuId(activeMenuId === exp.id ? null : exp.id)}
                                className={`p-2 rounded-lg transition-all ${activeMenuId === exp.id ? 'bg-slate-100 text-slate-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                                title="Actions"
                               >
                                 <MoreVertical className="w-4 h-4" />
                               </button>

                               <AnimatePresence>
                                 {activeMenuId === exp.id && (
                                   <motion.div 
                                     initial={{ opacity: 0, scale: 0.9, y: 5 }}
                                     animate={{ opacity: 1, scale: 1, y: 0 }}
                                     exit={{ opacity: 0, scale: 0.9, y: 5 }}
                                     className="absolute right-6 top-12 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 py-2 row-actions-menu overflow-hidden"
                                   >
                                     <button 
                                      onClick={() => { setViewingLineItems(exp); setActiveMenuId(null); }}
                                      className="w-full flex items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                     >
                                       <FileText className="w-3.5 h-3.5 mr-3 text-blue-500" />
                                       View Details
                                     </button>
                                     <button 
                                      onClick={() => { exportSingleXLSX(exp); setActiveMenuId(null); }}
                                      className="w-full flex items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                     >
                                       <FileText className="w-3.5 h-3.5 mr-3 text-indigo-500" />
                                       Export as Excel
                                     </button>
                                     <button 
                                      onClick={() => { exportSingleCSV(exp); setActiveMenuId(null); }}
                                      className="w-full flex items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                     >
                                       <Download className="w-3.5 h-3.5 mr-3 text-emerald-500" />
                                       Export as CSV
                                     </button>
                                     <button 
                                      onClick={() => { exportSingleJSON(exp); setActiveMenuId(null); }}
                                      className="w-full flex items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                     >
                                       <Zap className="w-3.5 h-3.5 mr-3 text-amber-500" />
                                       Export as JSON
                                     </button>
                                     <div className="h-px bg-slate-100 my-1" />
                                     <button 
                                      onClick={() => { startEdit(exp); setActiveMenuId(null); }}
                                      className="w-full flex items-center px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                                     >
                                       <Edit2 className="w-3.5 h-3.5 mr-3 text-slate-400" />
                                       Edit Record
                                     </button>
                                     <button 
                                      onClick={() => { setExpenseToDelete(exp.id); setActiveMenuId(null); }}
                                      className="w-full flex items-center px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors"
                                     >
                                       <Trash2 className="w-3.5 h-3.5 mr-3" />
                                       Delete Entry
                                     </button>
                                   </motion.div>
                                 )}
                               </AnimatePresence>
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

      {showPreview && previewUrls.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">Review Audit Document</h3>
                <p className="text-sm text-slate-500 font-medium">Confirm visibility for high-precision extraction</p>
              </div>
              <button 
                onClick={resetUpload}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
              <div className="space-y-6">
                {previewUrls.map((url, idx) => (
                  <div key={idx} className="relative rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-white group">
                    <img 
                      src={url} 
                      alt={`Preview ${idx + 1}`} 
                      className="w-full h-auto object-contain max-h-[60vh] mx-auto" 
                    />
                    <div className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur text-white px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg">
                      Draft {idx + 1}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-2">
                    <Check className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Text Quality</p>
                  <p className="text-xs text-slate-600 font-bold">Sharp Focus</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mb-2">
                    <Zap className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Visibility</p>
                  <p className="text-xs text-slate-600 font-bold">No Glare</p>
                </div>
                <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-2">
                    <FileText className="w-4 h-4" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Coverage</p>
                  <p className="text-xs text-slate-600 font-bold">Full Frame</p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-white border-t border-slate-100 flex flex-col sm:flex-row gap-3">
              <button 
                onClick={resetUpload}
                className="flex-1 py-4 px-6 border-2 border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all text-sm flex items-center justify-center"
              >
                <Camera className="w-4 h-4 mr-2" /> Re-take / Clear
              </button>
              <button 
                onClick={() => { setShowPreview(false); setUploadConfirm(true); }}
                className="flex-[2] py-4 px-6 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all text-sm flex items-center justify-center shadow-xl shadow-slate-200"
              >
                <Check className="w-4 h-4 mr-2" /> Looks Good — Audit This
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {uploadConfirm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
          >
            <h3 className="text-lg font-bold text-slate-900 mb-2">Analyze with Vision AI?</h3>
            <p className="text-sm text-slate-500 mb-6">Are you sure you want to extract data from <strong className="break-all text-slate-800">{files.length === 1 ? files[0].name : `${files.length} documents`}</strong>? Gemini will scan for line items, categories, and taxes.</p>
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
                {uploading ? "Analyzing..." : "Analyze"}
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
                  {parseLineItems(viewingLineItems.lineItems).map((item: any, idx: number) => {
                    if (!item || typeof item !== 'object') {
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td colSpan={4} className="py-3 px-2 font-medium text-slate-900">Unknown Item</td>
                        </tr>
                      );
                    }
                    const itemName = item.description || item.name || item.category;
                    const p = item.amount !== undefined && item.amount !== null ? item.amount : item.total_price;
                    const up = item.unit_price;
                    const q = item.quantity;
                    return (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-2 font-medium text-slate-900">{itemName || "Unknown Item"}</td>
                        <td className="py-3 px-2 text-right text-slate-600">{q !== undefined && q !== null ? q : "-"}</td>
                        <td className="py-3 px-2 text-right text-slate-600">{up !== undefined && up !== null ? formatCurrency(up, viewingLineItems.currency) : "-"}</td>
                        <td className="py-3 px-2 text-right font-bold text-slate-900">{p !== undefined && p !== null ? formatCurrency(p, viewingLineItems.currency) : "-"}</td>
                      </tr>
                    );
                  })}
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
        <Route path="/settings" element={token ? <Settings user={user} logout={logout} refreshUser={refreshUser} addToast={addToast} /> : <Navigate to="/auth" />} />
        <Route path="/privacy" element={<Legal />} />
        <Route path="/terms" element={<Legal />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </AuthContext.Provider>
  )
}
