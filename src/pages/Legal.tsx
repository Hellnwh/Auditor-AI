import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, CheckCircle2 } from 'lucide-react';
import Footer from '../components/Footer';
import ContactDialog from '../components/ContactDialog';

export default function Legal() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPrivacy = location.pathname === '/privacy';
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Auditor AI</span>
          </div>
          <button 
            onClick={() => navigate(-1)}
            className="flex items-center text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Return
          </button>
        </div>
      </nav>

      <main className="flex-1 pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100">
          <div className="flex items-center space-x-4 mb-8">
            <div className={`p-3 rounded-2xl ${isPrivacy ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600'}`}>
              {isPrivacy ? <Shield className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
              {isPrivacy ? 'Privacy Policy' : 'Terms & Conditions'}
            </h1>
          </div>

          <div className="prose prose-slate max-w-none">
            {isPrivacy ? (
                <div className="space-y-6 text-slate-600 leading-relaxed font-medium">
                  <p>Last updated: May 2026</p>
                  <p>Auditor AI is currently operated by VOID AI ("the Operator"). This policy explains our commitment to your data during this preview/beta phase.</p>
                  
                  <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">1. Data Handling</h2>
                    <p>We process documents you upload using the Google Gemini API to provide financial extraction features. Your data is stored in Google Cloud (Firestore) and is associated with your authenticated account.</p>
                  </section>
                  
                  <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">2. Privacy & Security</h2>
                    <p>We do not sell your personal data. We use industry-standard encryption provided by Google Cloud to protect your documents at rest and in transit. However, as this is a beta service, please do not upload highly sensitive or proprietary financial data that you are not authorized to share.</p>
                  </section>
                  
                  <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">3. Ownership</h2>
                    <p>You retain all rights to the documents you upload. The software, algorithms, and brand "Auditor AI" are the property of the Operator.</p>
                  </section>
                  
                  <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">4. Contact & Deletion</h2>
                    <p>For data deletion requests or privacy inquiries, please <button onClick={() => setContactOpen(true)} className="text-blue-600 hover:underline font-bold">contact us</button>. We will process all requests within 30 days.</p>
                  </section>
                </div>
              ) : (
                <div className="space-y-6 text-slate-600 leading-relaxed font-medium">
                  <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">1. Terms of Use</h2>
                    <p>Auditor AI is provided "as is" without warranties of any kind. By using this service, you agree that the Operator - VOID AI is not liable for any financial inaccuracies or audit failures resulting from the use of this tool.</p>
                  </section>
                  <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">2. beta Status</h2>
                    <p>The service is currently in a beta/preview phase. Features, pricing, and availability are subject to change without notice.</p>
                  </section>
                  <section>
                    <h2 className="text-xl font-bold text-slate-900 mb-3">3. Governing Law</h2>
                    <p>These terms shall be governed by the laws of your local jurisdiction.</p>
                  </section>
                </div>
            )}
          </div>

          <div className="mt-12 pt-8 border-t border-slate-100 flex justify-between items-center text-sm">
            <span className="text-slate-400 font-bold uppercase tracking-widest">Last Updated: April 2026</span>
            <Link to={isPrivacy ? '/terms' : '/privacy'} className="text-blue-600 font-bold hover:underline">
               Read {isPrivacy ? 'Terms & Conditions' : 'Privacy Policy'}
            </Link>
          </div>
        </div>
      </main>

      <div className="p-8">
        <Footer />
      </div>
      <ContactDialog isOpen={contactOpen} onClose={() => setContactOpen(false)} reason="delete_account" />
    </div>
  );
}
