import React from 'react';
import { motion } from 'motion/react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, Shield, FileText, CheckCircle2 } from 'lucide-react';
import Footer from '../components/Footer';

export default function Legal() {
  const navigate = useNavigate();
  const location = useLocation();
  const isPrivacy = location.pathname === '/privacy';

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
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">1. Data Collection</h2>
                  <p>Auditor AI collects financial data, including receipts and invoices, solely for the purpose of extraction and auditing verification. We do not sell your data to third parties.</p>
                </section>
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">2. Processing Logic</h2>
                  <p>Our AI extraction utilizes enterprise-grade large language models. While we aim for 100% precision, users should verify critical entries. Math checks are performed locally and on secure servers.</p>
                </section>
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">3. Data Retention</h2>
                  <p>Users can delete their data at any time. Accounts on the Professional plan benefit from enhanced encrypted archival cycles.</p>
                </section>
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">4. Security</h2>
                  <p>All data is encrypted in transit and at rest. We employ multi-layer security protocols to safeguard your financial information.</p>
                </section>
              </div>
            ) : (
              <div className="space-y-6 text-slate-600 leading-relaxed font-medium">
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">1. Acceptance of Terms</h2>
                  <p>By accessing Auditor AI, you agree to bound by these terms. Our service is provided as-is, optimized for financial auditing precision.</p>
                </section>
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">2. Use of Service</h2>
                  <p>The "Individual" tier is for personal use only. Enterprise behaviors (team sharing, mass extraction) require the Professional or Enterprise tier license.</p>
                </section>
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">3. Accuracy Disclaimer</h2>
                  <p>Auditor AI provides mathematical validation logic. However, ultimate responsibility for financial filings rests with the user and their certified accountants.</p>
                </section>
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">4. Intellectual Property</h2>
                  <p>The "Auditor AI" name and its precision-audit algorithms are the exclusive property of Auditor AI Corp.</p>
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
    </div>
  );
}
