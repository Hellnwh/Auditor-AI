import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, X, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { token } = useAuth() || { token: null };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Please provide a star rating.');
      return;
    }
    if (!content.trim()) {
      setError('Please share your thoughts with us.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { db, auth } = await import('../lib/firebase');

      await addDoc(collection(db, 'feedback'), {
        rating,
        content,
        source: 'Global',
        userId: auth.currentUser?.uid || null,
        createdAt: serverTimestamp()
      });

      setSubmitted(true);
    } catch (err) {
      console.error("Feedback error", err);
      setError('Connection interrupted. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

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
               <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
                  <MessageSquare className="w-5 h-5" />
               </div>
               <h3 className="font-black tracking-tight">Share Your Audit</h3>
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
                <h4 className="text-2xl font-black text-slate-900 mb-2">Thank you for sharing!</h4>
                <p className="text-slate-500 font-medium leading-relaxed">
                  Your feedback is important for us to know how we serve you. We use this intelligence to refine the Auditor AI precision loop.
                </p>
                <button 
                  onClick={onClose}
                  className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
                >
                  Close
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-4">How do we serve you?</label>
                  <div className="flex justify-center space-x-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className="transition-transform active:scale-90"
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        onClick={() => setRating(star)}
                      >
                        <Star 
                          className={`w-10 h-10 ${
                            (hoveredRating || rating) >= star 
                              ? 'fill-amber-400 text-amber-400' 
                              : 'text-slate-200'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="feedback" className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">Tell us more...</label>
                  <textarea
                    id="feedback"
                    rows={4}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="What did you like? What can we improve?"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-900 font-medium focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                  />
                </div>

                {error && (
                  <p className="text-rose-600 text-[10px] font-black uppercase text-center">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-lg transition-all shadow-xl shadow-blue-200 flex items-center justify-center transform active:scale-[0.98]"
                >
                  {submitting ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>Submit Feedback</>
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
