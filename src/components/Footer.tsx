import React, { useState } from 'react';
import { Shield, FileText, MessageSquare, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import FeedbackDialog from './FeedbackDialog';
import ContactDialog from './ContactDialog';

export default function Footer() {
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

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
      <button 
        onClick={() => setContactOpen(true)}
        className="flex items-center text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors uppercase tracking-[0.2em]"
      >
        <Mail className="w-3.5 h-3.5 mr-3" />
        Contact Support
      </button>

      <div className="text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em] leading-relaxed max-w-[200px]">
        &copy; {new Date().getFullYear()} Auditor AI. <br />
        All rights reserved.
      </div>

      <FeedbackDialog isOpen={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <ContactDialog isOpen={contactOpen} onClose={() => setContactOpen(false)} reason="general" />
    </div>
  );
}
