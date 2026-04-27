import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2, Info, X, Loader2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'loading';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContainerProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

export default function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`
              pointer-events-auto
              flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl border
              min-w-[320px] max-w-md
              bg-white
              ${toast.type === 'success' ? 'border-emerald-100' : 
                toast.type === 'error' ? 'border-rose-100' : 
                'border-slate-100'}
            `}
          >
            <div className={`
              w-10 h-10 rounded-xl flex items-center justify-center shrink-0
              ${toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 
                toast.type === 'error' ? 'bg-rose-50 text-rose-600' : 
                'bg-blue-50 text-blue-600'}
            `}>
              {toast.type === 'success' && <CheckCircle2 className="w-5 h-5" />}
              {toast.type === 'error' && <AlertCircle className="w-5 h-5" />}
              {toast.type === 'info' && <Info className="w-5 h-5" />}
              {toast.type === 'loading' && <Loader2 className="w-5 h-5 animate-spin" />}
            </div>
            
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-900 leading-tight">
                {toast.message}
              </p>
            </div>

            <button 
              onClick={() => removeToast(toast.id)}
              className="p-1 text-slate-300 hover:text-slate-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// Hook for using toasts
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: ToastType = 'info', duration = 5000) => {
    const id = Math.random().toString(36).substring(2, 11);
    setToasts((prev) => [...prev, { id, message, type }]);

    if (type !== 'loading') {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const updateToast = (id: string, message: string, type: ToastType) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, message, type } : t));
    
    // Auto remove after update if it becomes success/error
    if (type !== 'loading') {
       setTimeout(() => removeToast(id), 5000);
    }
  };

  return { toasts, addToast, removeToast, updateToast };
}
