import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Plus, Trash2, Check, ArrowLeft, ShieldCheck, Home, BarChart2, Eye, Receipt, ChevronRight, X, Download, AlertTriangle } from 'lucide-react';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { Sidebar, MobileNav } from '../components/Navigation';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

export default function Reports({ expenses, authFetch, addToast }: { expenses: any[], authFetch: any, addToast: any }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [availableExpenses, setAvailableExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.id, 'reports'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const loadedReports = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const reportsWithExpenses = loadedReports.map(rep => ({
        ...rep,
        expenses: expenses.filter(e => e.reportId === rep.id)
      }));
      setReports(reportsWithExpenses);
      
      const unassigned = expenses.filter(e => !e.reportId);
      setAvailableExpenses(unassigned);
      setLoading(false);
    }, (error) => {
      import('../lib/firestoreUtils').then(m => {
        m.handleFirestoreError(error, m.OperationType.LIST, `users/${user.id}/reports`);
      }).catch(console.error);
      setLoading(false);
    });
    return unsub;
  }, [user, expenses]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (selectedExpenses.size === 0) return addToast('Select at least one record to archive.', "info");
    
    try {
      const { handleFirestoreError, OperationType } = await import('../lib/firestoreUtils');
      const reportRef = doc(collection(db, 'users', user.id, 'reports'));
      
      const batch = writeBatch(db);
      batch.set(reportRef, {
        title,
        description: desc,
        status: "Draft",
        createdAt: serverTimestamp()
      });
      
      Array.from(selectedExpenses).forEach((eid) => {
        const expenseId = eid as string;
        const eRef = doc(db, 'users', user.id, 'expenses', expenseId);
        batch.update(eRef, { reportId: reportRef.id });
      });
      
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.id}/reports/${reportRef.id} [Batch]`);
      }

      setCreating(false);
      setTitle('');
      setDesc('');
      setSelectedExpenses(new Set());
      addToast("Consolidated archive generated.", "success");
    } catch (error) {
      console.error(error);
      addToast("Failed to generate archive.", "error");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const { handleFirestoreError, OperationType } = await import('../lib/firestoreUtils');
      const reportExp = expenses.filter(exp => exp.reportId === id);
      const batch = writeBatch(db);
      
      batch.delete(doc(db, 'users', user.id, 'reports', id));
      
      reportExp.forEach(exp => {
        batch.update(doc(db, 'users', user.id, 'expenses', exp.id), { reportId: null });
      });
      
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.id}/reports/${id} [Batch]`);
      }

      if (selectedReport?.id === id) setSelectedReport(null);
      addToast("Archive deleted. Records restored to ledger.", "success");
    } catch (error) {
      console.error(error);
      addToast("Failed to delete archive.", "error");
    }
  };

  const toggleExpense = (id: string) => {
    const next = new Set(selectedExpenses);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedExpenses(next);
  };

  const exportReportCSV = (report: any) => {
    const headers = ["Date", "Vendor", "Category", "Amount", "Tax", "Confidence"];
    const rows = report.expenses.map((exp: any) => [
      `"${exp.date}"`,
      `"${exp.vendor.replace(/"/g, '""')}"`,
      `"${exp.category || "Other"}"`,
      exp.amount.toFixed(2),
      exp.taxAmount !== null ? exp.taxAmount.toFixed(2) : "",
      exp.confidence !== null ? exp.confidence.toFixed(1) + "%" : ""
    ].join(","));
    
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${report.title.replace(/\s+/g, '_')}_Archive.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 lg:ml-64 flex items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest">Accessing Ledger...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-4 md:p-8 pb-24 lg:pb-8 flex flex-col items-center">
        <div className="max-w-7xl mx-auto w-full">
          <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
             <div className="flex items-center space-x-4">
               <button 
                onClick={() => navigate(-1)} 
                className="p-2 hover:bg-white rounded-xl transition-colors border border-slate-200 shadow-sm"
               >
                 <ArrowLeft className="w-5 h-5 text-slate-600" />
               </button>
               <div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Audit Reports</h1>
                  <p className="text-slate-500 font-medium text-sm mt-1">Consolidated Financial Archiving.</p>
               </div>
             </div>
             <button
               onClick={() => setCreating(true)}
               className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold flex items-center shadow-lg shadow-blue-200 transition-all active:scale-95 text-sm"
             >
               <Plus className="w-4 h-4 mr-2" /> New Archive
             </button>
          </header>

          <MobileNav />

          <AnimatePresence>
            {creating && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 mb-8 border border-slate-200 overflow-hidden">
                <form onSubmit={handleCreate}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Archive Title</label>
                        <input required type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-bold text-sm" placeholder="Q1 Financial Recovery" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Description</label>
                        <textarea value={desc} onChange={e => setDesc(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-bold text-sm h-24" placeholder="Brief summary of records..." />
                      </div>
                    </div>
                    <div className="space-y-2">
                       <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Select Expenses ({availableExpenses.length} available)</label>
                       <div className="max-h-48 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                         {availableExpenses.map(exp => (
                           <div 
                             key={exp.id} 
                             onClick={() => toggleExpense(exp.id)}
                             className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${selectedExpenses.has(exp.id) ? 'bg-blue-50 border-blue-200 shadow-sm' : 'bg-slate-50 border-slate-100 hover:border-slate-200'}`}
                           >
                              <div className="flex flex-col">
                                <span className="text-xs font-bold text-slate-900 flex items-center">
                                  {exp.vendor}
                                  {exp.discrepancy === 'yes' && <AlertTriangle className="w-2.5 h-2.5 ml-1.5 text-red-600 animate-pulse" title={exp.discrepancyReason || "Audit Discrepancy Found"} />}
                                </span>
                                <span className="text-[10px] font-bold text-slate-400">{exp.date}</span>
                              </div>
                              <div className="flex items-center space-x-3">
                                 <span className="text-xs font-black text-slate-700">${exp.amount.toFixed(2)}</span>
                                 <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedExpenses.has(exp.id) ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                                   {selectedExpenses.has(exp.id) && <Check className="w-3 h-3" />}
                                 </div>
                              </div>
                           </div>
                         ))}
                         {availableExpenses.length === 0 && <p className="text-center py-8 text-xs font-bold text-slate-400">All expenses are already archived.</p>}
                       </div>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button type="button" onClick={() => setCreating(false)} className="px-6 py-3 text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">Abort</button>
                    <button type="submit" className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200 text-sm">Save Global Archive</button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map(report => {
              const totalAmount = report.expenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

              return (
                <motion.div 
                  key={report.id} 
                  layoutId={report.id}
                  onClick={() => setSelectedReport(report)}
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col group cursor-pointer hover:shadow-xl hover:shadow-slate-200/50 hover:border-blue-200 transition-all max-h-[400px]"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="max-w-[70%]">
                      <h3 className="font-black text-lg text-slate-900 leading-tight mb-1 group-hover:text-blue-600 transition-colors">{report.title}</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest line-clamp-2">{report.description || 'Verified AI Extraction Archive'}</p>
                    </div>
                    <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                       <FileText className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="space-y-4 mb-8">
                    <div className="flex justify-between items-center bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Consolidated Vol.</span>
                        <span className="text-2xl font-black text-slate-900 tracking-tighter">${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="text-right">
                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Records</span>
                         <div className="text-sm font-black text-slate-700">{report.expenses.length} Units</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                    <div className="flex flex-col text-[10px]">
                      <span className="font-bold text-slate-400 uppercase">Created On</span>
                      <span className="font-bold text-slate-600">{new Date(report.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                       <button onClick={(e) => handleDelete(report.id, e)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Wipe Archive">
                        <Trash2 className="w-4 h-4" />
                       </button>
                       <div className="p-2 text-blue-600 bg-blue-50 rounded-lg border border-blue-100">
                          <Eye className="w-4 h-4" />
                       </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
            
            {reports.length === 0 && !creating && (
              <div className="col-span-full py-20 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mb-6 border border-slate-100 text-slate-200">
                  <FileText className="w-10 h-10" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">No archives generated yet</h3>
                <p className="text-sm text-slate-500 max-w-sm mt-2 font-medium">Click "New Archive" to consolidate your AI-extracted financial records.</p>
              </div>
            )}
          </div>

          <AnimatePresence>
            {selectedReport && (
              <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 shadow-blue-900/10"
                >
                  <div className="p-6 md:p-8 bg-slate-900 text-white flex justify-between items-start shrink-0">
                    <div>
                        <div className="flex items-center space-x-3 mb-2">
                           <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-900/50"><ShieldCheck className="w-5 h-5"/></div>
                           <h3 className="text-2xl font-black tracking-tight leading-tight">{selectedReport.title}</h3>
                        </div>
                        <p className="text-sm text-slate-400 font-medium">{selectedReport.description || 'Financial Audit Archive'}</p>
                    </div>
                    <button onClick={() => setSelectedReport(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 transition-all">
                      <X className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar">
                     <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Total Valuation</span>
                           <span className="text-2xl font-black text-slate-900 tracking-tight">
                             ${selectedReport.expenses.reduce((s:number, e:any) => s + e.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                           </span>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Audit Unit Count</span>
                           <span className="text-2xl font-black text-slate-900 tracking-tight">{selectedReport.expenses.length} Units</span>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 shadow-sm shadow-slate-100">
                           <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 block">Audit Integrity</span>
                           <div className="flex items-center space-x-2">
                              <span className="text-2xl font-black text-emerald-600 tracking-tight">100%</span>
                              <div className="w-10 h-1 bg-emerald-100 rounded-full overflow-hidden mt-1 shadow-inner"><div className="w-full h-full bg-emerald-500" /></div>
                           </div>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <div className="flex items-center justify-between">
                           <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center">
                             <Receipt className="w-4 h-4 mr-2 text-blue-600" /> Linked Record Ledger
                           </h4>
                           <button 
                             onClick={() => exportReportCSV(selectedReport)}
                             className="text-xs font-bold text-blue-600 hover:bg-blue-50 px-3 py-2 rounded-xl border border-blue-100 flex items-center transition-all active:scale-95 shadow-sm"
                           >
                             <Download className="w-3.5 h-3.5 mr-1.5" /> Export .CSV
                           </button>
                        </div>
                        <div className="space-y-3">
                           {selectedReport.expenses.map((exp: any) => (
                             <div key={exp.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-lg hover:shadow-blue-900/5 transition-all group">
                                <div className="flex items-center space-x-4">
                                   <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                                      <Receipt className="w-5 h-5" />
                                   </div>
                                   <div>
                                      <div className="text-sm font-black text-slate-900 leading-tight group-hover:text-blue-700 transition-colors flex items-center">{exp.vendor}
                                         {exp.discrepancy === 'yes' && (
                                           <span className="ml-2 inline-flex items-center text-[8px] bg-red-600 text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm animate-pulse" title={exp.discrepancyReason || "Audit Discrepancy Found"}>
                                             <AlertTriangle className="w-2.5 h-2.5 mr-1" /> MATH DISCREPANCY
                                           </span>
                                         )}</div>
                                      <div className="flex items-center space-x-2 mt-0.5">
                                         <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{exp.category}</span>
                                         <span className="text-[10px] text-slate-300">•</span>
                                         <span className="text-[10px] font-bold text-slate-400">{exp.date}</span>
                                      </div>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <div className="text-base font-black text-slate-900 tracking-tighter">${exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                   <div className={`text-[10px] font-bold ${exp.confidence > 90 ? 'text-emerald-500' : 'text-amber-500'}`}>
                                      AI Audit: {Math.round(exp.confidence)}%
                                   </div>
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>
                  </div>

                  <div className="p-8 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-widest shrink-0">
                     <div className="tracking-[0.15em]">© 2026 AUDITOR AI SECURITY PROTOCOL v1.5</div>
                     <div className="flex items-center text-blue-600">
                        <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Verified Ledger Archive
                     </div>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
          
          <div className="mt-12">
            <Footer />
          </div>
        </div>
      </main>
    </div>
  );
}
