import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export type ContactReason = 'delete_account' | 'general' | 'support' | 'enterprise';

interface ContactDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: ContactReason;
  initialSubject?: string;
  initialMessage?: string;
}

export default function ContactDialog({ isOpen, onClose, reason = 'general', initialSubject = '', initialMessage = '' }: ContactDialogProps) {
  const [form, setForm] = useState({
    email: '',
    subject: initialSubject,
    message: initialMessage
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { token, user } = useAuth() || { token: null, user: null };

  React.useEffect(() => {
    if (isOpen) {
      setForm({
        email: user?.email || '',
        subject: initialSubject,
        message: initialMessage
      });
      setSubmitted(false);
      setError('');
    }
  }, [isOpen, user, initialSubject, initialMessage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          ...form,
          reason,
          website: (e.target as any).website.value
        })
      });

      const result = await response.json();
      if (result.success) {
        setSubmitted(true);
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        setError(result.error || 'Submission failed');
      }
    } catch (err) {
      console.error("Contact error", err);
      setError('Something went wrong. Please try again or email us.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const titles = {
    delete_account: 'Account Deletion Request',
    general: 'Contact Us',
    support: 'Support Request',
    enterprise: 'Talk to Founder (Enterprise)'
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
        >
          <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center space-x-3 text-slate-900">
               <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                  <MessageSquare className="w-5 h-5" />
               </div>
               <h3 className="font-black tracking-tight">{titles[reason]}</h3>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-8">
            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-10"
              >
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-2xl font-black text-slate-900 mb-2">Message Received!</h4>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Thanks! We've received your message and will get back to you soon.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="you@company.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Subject</label>
                  <input
                    type="text"
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="How can we help?"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Message</label>
                  <textarea
                    required
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Share the details..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  style={{ position: 'absolute', left: '-9999px' }}
                  aria-hidden="true"
                />

                {error && (
                  <p className="text-rose-600 text-[10px] font-black uppercase text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-slate-200 flex items-center justify-center transform active:scale-[0.98]"
                >
                  {submitting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <><Send className="w-5 h-5 mr-2" /> Send Message</>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
