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
                <p>Last updated: 07/05/2026</p>
                <p>Auditor AI ("we", "our", "the app") is operated by Void-AI, based in India. This policy explains what data we handle and how.</p>
                
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">1. What we collect</h2>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Files you upload: receipts, invoices, PDFs, and spreadsheets you submit for extraction.</li>
                    <li>Extracted data: the structured fields (vendor, date, amounts, line items, etc.) returned by our AI processing.</li>
                    <li>Account information: email address and authentication data managed via Firebase Authentication.</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">2. How we process your data</h2>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Uploaded documents are sent to Google's Gemini API for AI-based extraction and verification. By using Auditor AI, you acknowledge that your documents are processed by Google as a sub-processor under Google's API terms.</li>
                    <li>Extracted structured data is stored in Google Firestore associated with your account.</li>
                    <li>We do not sell your data. We do not use your documents to train any AI model.</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">3. Web search and vendor verification</h2>
                  <p>For some audits, the AI may use Google Search grounding to verify vendor names or local tax rates. The text of your document may be included in those search queries.</p>
                </section>
                
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">4. Data retention and deletion</h2>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>You can delete any audit record from your account at any time from within the app. Deletion is permanent and removes the record from Firestore.</li>
                    <li>Account deletion: contact Voidthoughts.official@gmail.com and we will delete your account and all associated records within 30 days.</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">5. Security</h2>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Data is transmitted over HTTPS.</li>
                    <li>Firestore data is encrypted at rest by Google Cloud's default encryption.</li>
                    <li>We do not have additional security certifications (SOC 2, ISO 27001) at this time. Do not upload documents containing data you are not authorized to share.</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">6. Your rights</h2>
                  <ul className="list-disc pl-5 space-y-2">
                    <li>Under India's Digital Personal Data Protection Act 2023, you have the right to access, correct, and delete your personal data, and to withdraw consent.</li>
                    <li>Under GDPR (if you are in the EEA/UK), you additionally have the right to data portability and to lodge a complaint with a supervisory authority.</li>
                  </ul>
                </section>
                
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">7. Contact</h2>
                  <p>For privacy questions, deletion requests, or complaints: Voidthoughts.official@gmail.com</p>
                </section>
                
                <section>
                  <h2 className="text-xl font-bold text-slate-900 mb-3">8. Changes</h2>
                  <p>We will update the "Last updated" date at the top of this page when this policy changes. Material changes will be communicated via email if you have an account.</p>
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
