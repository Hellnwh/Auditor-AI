import React, { useState } from 'react';
import { Shield, FileText, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import FeedbackDialog from './FeedbackDialog';

export default function Footer() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  return (
    <div className="flex flex-col items-start space-y-4 py-8">
      <Link to="/privacy" className="flex items-center text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em]">
        <Shield className="w-3.5 h-3.5 mr-3" />
        Privacy Policy
      </Link>
      <Link to="/terms" className="flex items-center text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em]">
        <FileText className="w-3.5 h-3.5 mr-3" />
        Terms & Conditions
      </Link>
      <button 
        onClick={() => setFeedbackOpen(true)}
        className="flex items-center text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em]"
      >
        <MessageSquare className="w-3.5 h-3.5 mr-3" />
        Feedback
      </button>

      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-relaxed max-w-[200px]">
        &copy; {new Date().getFullYear()} Auditor AI. <br />
        All rights reversed. <br />
        Intelligence with accountability.
      </div>

      <FeedbackDialog isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </div>
  );
}
