import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, User, Mail, CreditCard, ArrowLeft, Home, BarChart2, FileText, Zap, ChevronRight, Check, Save, Loader2, AlertTriangle, Trash2, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import { Sidebar, MobileNav } from '../components/Navigation';

export default function Settings({ user, logout, refreshUser, addToast }: { user: any; logout: () => void, refreshUser: () => void, addToast: any }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ 
    name: user?.name || '', 
    email: user?.email || '',
    companyName: user?.companyName || '',
    jobTitle: user?.jobTitle || '',
    phoneNumber: user?.phoneNumber || ''
  });
  const [saving, setSaving] = useState(false);
  
  // Account Deletion State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleUpdate = async () => {
    setSaving(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      const { updateProfile } = await import('firebase/auth');
      const { auth, db } = await import('../lib/firebase');
      const { handleFirestoreError, OperationType } = await import('../lib/firestoreUtils');

      if (!user) throw new Error("No user");

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: form.name });
      }

      const userRef = doc(db, 'users', user.id);
      try {
        await updateDoc(userRef, { 
          name: form.name, 
          email: form.email,
          companyName: form.companyName || null,
          jobTitle: form.jobTitle || null,
          phoneNumber: form.phoneNumber || null
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.id}`);
      }

      addToast("Profile intelligence updated.", "success");
      setEditing(false);
      refreshUser();
    } catch (e: any) {
      console.error(e);
      addToast(e.message || "Failed to update profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteAccount = async () => {
    setDeleting(true);
    try {
      const { collection, getDocs, doc, deleteDoc, writeBatch } = await import('firebase/firestore');
      const { auth, db } = await import('../lib/firebase');
      const { handleFirestoreError, OperationType } = await import('../lib/firestoreUtils');

      if (!user || !auth.currentUser) throw new Error("No authenticated user");

      // Delete all expenses
      const expensesSnap = await getDocs(collection(db, 'users', user.id, 'expenses'));
      const batch1 = writeBatch(db);
      expensesSnap.docs.forEach(d => batch1.delete(d.ref));
      try {
        await batch1.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.id}/expenses [Batch]`);
      }

      // Delete all reports
      const reportsSnap = await getDocs(collection(db, 'users', user.id, 'reports'));
      const batch2 = writeBatch(db);
      reportsSnap.docs.forEach(d => batch2.delete(d.ref));
      try {
        await batch2.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.id}/reports [Batch]`);
      }

      // Delete user document
      try {
        await deleteDoc(doc(db, 'users', user.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.id}`);
      }

      // Delete Firebase Auth user
      await auth.currentUser.delete();

      addToast("Account permanently deleted.", "success");
      logout();
      navigate('/');
    } catch (e: any) {
      console.error(e);
      if (e.code === 'auth/requires-recent-login') {
        addToast("Security constraint: Please sign out and sign in again before deleting your account.", "error");
      } else {
        addToast(e.message || "Failed to delete account.", "error");
      }
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  const plans = [
    {
      name: 'FREE',
      price: '$0',
      description: 'Elite data extraction for individuals.',
      features: ['5 Monthly Scans', 'AI Basic Audit', 'CSV Exports', 'Community Support'],
      active: user?.plan === 'FREE'
    },
    {
      name: 'PRO',
      price: '$9.99',
      description: 'Professional auditing for SMBs.',
      features: ['50 Monthly Scans', 'Advanced Math Audit', 'Team Sharing', 'Line Item Extraction', 'Priority Support'],
      active: user?.plan === 'PRO'
    },
    {
      name: 'ENTERPRISE',
      price: 'Contact Sales',
      description: 'Unlimited power for audit firms.',
      features: ['Unlimited Scans', 'Deep Vision Processing', 'Custom API Access', 'SLA Guarantee', 'Dedicated Auditor Support'],
      active: user?.plan === 'ENTERPRISE'
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar />

      <main className="flex-1 lg:ml-64 p-4 md:p-8 pb-24 lg:pb-8 flex flex-col items-center relative z-10">
        <div className="max-w-4xl mx-auto w-full">
          <MobileNav />
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 hover:bg-white rounded-xl transition-colors border border-slate-200 shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Account & Governance</h1>
              <p className="text-slate-500 font-medium text-sm mt-1">Plan Management & Security</p>
            </div>
          </div>
        </header>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="md:col-span-1 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                   <div className="flex justify-between items-start mb-4">
                      <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100 shadow-sm">
                         <User className="w-8 h-8" />
                      </div>
                      <button 
                        onClick={() => {
                          setEditing(!editing);
                          setForm({ 
                            name: user?.name || '', 
                            email: user?.email || '',
                            companyName: user?.companyName || '',
                            jobTitle: user?.jobTitle || '',
                            phoneNumber: user?.phoneNumber || ''
                          });
                        }}
                        className="text-[10px] font-black uppercase text-blue-600 hover:underline tracking-widest"
                      >
                        {editing ? 'Cancel' : 'Edit Intelligence'}
                      </button>
                   </div>
                   
                   {editing ? (
                     <div className="space-y-4">
                        <div>
                           <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Full Name</label>
                           <input 
                             type="text" 
                             value={form.name} 
                             onChange={e => setForm({...form, name: e.target.value})}
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                           />
                        </div>
                        <div>
                           <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Email Archive</label>
                           <input 
                             type="email" 
                             value={form.email} 
                             onChange={e => setForm({...form, email: e.target.value})}
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all disabled:opacity-50"
                             disabled
                           />
                        </div>
                        <div>
                           <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Company Name</label>
                           <input 
                             type="text" 
                             value={form.companyName} 
                             onChange={e => setForm({...form, companyName: e.target.value})}
                             placeholder="e.g. Acme Corp"
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                           />
                        </div>
                        <div>
                           <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Job Title</label>
                           <input 
                             type="text" 
                             value={form.jobTitle} 
                             onChange={e => setForm({...form, jobTitle: e.target.value})}
                             placeholder="e.g. Financial Analyst"
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                           />
                        </div>
                        <div>
                           <label className="block text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Phone Number</label>
                           <input 
                             type="tel" 
                             value={form.phoneNumber} 
                             onChange={e => setForm({...form, phoneNumber: e.target.value})}
                             placeholder="e.g. +1 555-0199"
                             className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                           />
                        </div>
                        <button 
                          disabled={saving}
                          onClick={handleUpdate}
                          className="w-full py-3 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all flex items-center justify-center shadow-lg shadow-blue-100"
                        >
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-3.5 h-3.5 mr-2" /> Commit Identity</>}
                        </button>
                     </div>
                   ) : (
                     <div className="space-y-3">
                        <h3 className="text-xl font-black text-slate-900 mb-1">{user?.name}</h3>
                        <div className="flex items-center text-xs font-bold text-slate-400 mb-2">
                           <Mail className="w-3 h-3 mr-1.5" /> {user?.email}
                        </div>
                        {(user?.companyName || user?.jobTitle) && (
                          <div className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-2 rounded-lg border border-slate-100">
                             {user.jobTitle && <span>{user.jobTitle}</span>}
                             {user.jobTitle && user.companyName && <span> at </span>}
                             {user.companyName && <span>{user.companyName}</span>}
                          </div>
                        )}
                        {user?.phoneNumber && (
                          <div className="text-[10px] font-bold text-slate-400 tracking-wider">
                             TEL: {user.phoneNumber}
                          </div>
                        )}
                        <button onClick={logout} className="w-full py-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-all mt-4">Sign Out Archive</button>
                     </div>
                   )}
                </div>

                <div className="bg-slate-900 p-6 rounded-2xl text-white relative overflow-hidden group">
                   <Zap className="w-20 h-20 text-blue-500/20 absolute -right-4 -bottom-4 rotate-12 group-hover:scale-110 transition-transform" />
                   <h4 className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-2">Usage Quota</h4>
                   <div className="text-3xl font-black tracking-tight mb-2">{user?.scansLeft} <span className="text-sm text-slate-400">Scans</span></div>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Status: {user?.plan} LICENSE ACTIVE</p>
                   <div className="mt-6 w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-1000" style={{ width: user?.plan === 'FREE' ? `${(user?.scansLeft / 10) * 100}%` : '100%' }} />
                   </div>
                </div>

                <div className="p-6 rounded-2xl border border-red-100 bg-red-50/30">
                   <div className="flex items-center text-red-600 space-x-2 mb-3">
                      <AlertTriangle className="w-4 h-4" />
                      <h4 className="text-[10px] font-black uppercase tracking-widest">Danger Zone</h4>
                   </div>
                   <p className="text-[10px] text-slate-500 font-bold leading-relaxed mb-4">Deleting your account will permanently purge all expenses, reports, and identity data.</p>
                   <button 
                     onClick={() => setDeleteConfirmOpen(true)}
                     className="w-full py-3 border border-red-200 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center"
                   >
                      <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Account
                   </button>
                </div>
             </div>

             <div className="md:col-span-2 space-y-6">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center">
                  <CreditCard className="w-4 h-4 mr-2 text-blue-600" /> Tier Governance
                </h3>
                
                <div className="space-y-4">
                   {plans.map(plan => (
                     <div key={plan.name} className={`p-6 rounded-2xl border transition-all ${plan.active ? 'bg-white border-blue-200 shadow-xl shadow-blue-900/5 ring-2 ring-blue-500/5' : 'bg-slate-50 border-slate-200 opacity-60'}`}>
                        <div className="flex justify-between items-start mb-4">
                           <div>
                              <div className="flex items-center space-x-2 mb-1">
                                 <h4 className="text-xl font-black text-slate-900 tracking-tight">{plan.name}</h4>
                                 {plan.active && <span className="bg-blue-600 text-white text-[8px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest">Active License</span>}
                              </div>
                              <p className="text-xs font-medium text-slate-500">{plan.description}</p>
                           </div>
                           <div className="text-right">
                              <span className="text-2xl font-black text-slate-900 tracking-tighter">{plan.price}</span>
                              {plan.price.includes('$') && <span className="text-[10px] font-bold text-slate-400 block uppercase">/ Month</span>}
                           </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-2 mb-6">
                           {plan.features.map(f => (
                             <div key={f} className="flex items-center text-[10px] font-bold text-slate-600">
                                <Check className="w-3 h-3 text-emerald-500 mr-2 shrink-0" /> {f}
                             </div>
                           ))}
                        </div>

                        {!plan.active && (
                          <button 
                            onClick={() => alert(`Upgrading to ${plan.name}... (Stripe Sandbox Active)`)}
                            className="w-full py-3 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all active:scale-[0.98] shadow-lg shadow-slate-200"
                          >
                            Switch to {plan.name} Governance
                          </button>
                        )}
                     </div>
                   ))}
                </div>
             </div>
          </div>

          <Footer />
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden"
          >
            <div className="p-6">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4 border border-red-100">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight mb-2">Delete Auditor Account?</h3>
              <p className="text-sm font-medium text-slate-500 mb-6">
                This action is permanent and cannot be undone. All your expenses, tracking reports, and account settings will be erased from our database.
              </p>
              
              <div className="flex gap-3">
                <button 
                  disabled={deleting}
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-50 text-slate-600 hover:bg-slate-100 font-bold text-sm rounded-xl transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button 
                  disabled={deleting}
                  onClick={confirmDeleteAccount}
                  className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 font-bold text-sm rounded-xl transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex justify-center items-center"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Yes, Delete'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
