import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, Link } from 'react-router-dom';
import { FileSearch, Zap, ShieldCheck, PieChart, Users, Receipt, ArrowRight, CheckCircle2, Star, Menu, X, Mail, Sparkles } from 'lucide-react';
import Footer from '../components/Footer';

export default function Landing() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistStatus, setWaitlistStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const joinWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    setWaitlistStatus('loading');
    
    try {
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await addDoc(collection(db, 'waitlist'), {
        email: waitlistEmail,
        createdAt: serverTimestamp(),
        source: 'landing_pricing'
      });
      setWaitlistStatus('success');
      setTimeout(() => {
        setWaitlistOpen(false);
        setWaitlistStatus('idle');
        setWaitlistEmail('');
      }, 2000);
    } catch (err) {
      console.error('Waitlist error:', err);
      setWaitlistStatus('idle');
      alert('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900">
      <AnimatePresence>
        {waitlistOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-[2rem] shadow-2xl max-w-sm w-full overflow-hidden border border-white p-8"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 border border-blue-100 shadow-sm mx-auto">
                  <Mail className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-2">Join the Pro Waitlist</h3>
                <p className="text-sm font-medium text-slate-500 mb-8 leading-relaxed">
                  Help us shape the Pro plan. Join the waitlist for early access pricing and exclusive features.
                </p>

                {waitlistStatus === 'success' ? (
                  <div className="bg-emerald-50 text-emerald-700 py-4 rounded-2xl font-bold text-sm flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 mr-2" /> You're on the list!
                  </div>
                ) : (
                  <form onSubmit={joinWaitlist} className="space-y-4">
                    <input 
                      type="email"
                      required
                      placeholder="Enter your work email"
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                    />
                    <button 
                      type="submit"
                      disabled={waitlistStatus === 'loading'}
                      className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-200 disabled:opacity-50"
                    >
                      {waitlistStatus === 'loading' ? 'Joining...' : 'Get Early Access'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setWaitlistOpen(false)}
                      className="w-full text-slate-400 font-bold text-xs hover:text-slate-600 py-2"
                    >
                      Maybe later
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">Auditor AI</span>
            </Link>
            
            <div className="hidden md:flex items-center space-x-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Features</a>
              <a href="#pricing" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">Pricing</a>
              <a href="#auditor" className="text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">The Auditor AI</a>
              <Link to="/auth" className="text-sm font-semibold text-white bg-slate-900 px-5 py-2.5 rounded-full hover:bg-slate-800 transition-all shadow-md shadow-slate-200">
                Access Portal
              </Link>
            </div>

            <div className="md:hidden">
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-slate-600 hover:text-slate-900"
              >
                {mobileMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:hidden bg-white border-b border-slate-100 px-4 py-6 flex flex-col space-y-4"
          >
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-slate-700">Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-lg font-medium text-slate-700">Pricing</a>
            <Link to="/auth" className="text-lg font-semibold text-blue-600">Login / Signup</Link>
          </motion.div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] bg-gradient-to-b from-blue-50/50 to-transparent -z-10 rounded-full blur-3xl opacity-50" />
        
        <div className="max-w-5xl mx-auto text-center">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold tracking-widest uppercase mb-6 ring-1 ring-blue-100">
              Introducing Auditor AI Precision
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1] mb-8">
              Financial Data <br /> 
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Autopilot</span> for Teams.
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto mb-10 leading-relaxed">
              Scan receipts, digest multi-page PDF invoices, and let our AI auditor verify the math. The first expense tool that fights for your accuracy.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => navigate('/auth')}
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-lg transition-all shadow-xl shadow-blue-200 flex items-center justify-center transform hover:scale-105 active:scale-95"
              >
                Start Free Scan <ArrowRight className="ml-2 w-5 h-5" />
              </button>
              <div className="flex -space-x-3 items-center ml-4">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-100 overflow-hidden ring-2 ring-slate-50">
                    <img src={`https://picsum.photos/seed/${i + 130}/200`} referrerPolicy="no-referrer" alt="User" />
                  </div>
                ))}
                <span className="ml-4 text-sm font-semibold text-slate-500 italic">Join 2,400+ accounting teams</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Trusted By */}
      <section className="py-12 border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-40 grayscale contrast-125 font-black tracking-widest text-slate-600">
          <span className="text-2xl">FINANCE.CO</span>
          <span className="text-2xl">BLOCK.INC</span>
          <span className="text-2xl">ASSET.FLOW</span>
          <span className="text-2xl">CRYPTIC</span>
          <span className="text-2xl">GLOBAL.BANK</span>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight">Built for Accuracy.</h2>
            <p className="text-slate-500 max-w-xl mx-auto">Native AI extraction with built-in audit logic ensures your financial records are 100% consistent.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Zap className="text-blue-600" />}
              title="Instant Extraction"
              description="Upload images or PDFs. Our AI digests dates, vendors, tax, and line-items in under 2 seconds."
            />
            <FeatureCard 
              icon={<ShieldCheck className="text-green-600" />}
              title="Auditor AI Review"
              description="Automatically cross-checks subtotal + tax = total. Flags inconsistencies before they hit your books."
            />
            <FeatureCard 
              icon={<FileSearch className="text-indigo-600" />}
              title="PDF Digest"
              description="The only tool that natively understands multi-page PDF invoices with broken table structures."
            />
          </div>
        </div>
      </section>

      {/* The Auditor AI Deep Dive */}
      <section id="auditor" className="py-24 bg-slate-900 text-white overflow-hidden relative">
        <div className="absolute right-0 top-0 w-1/3 h-full bg-blue-600/10 blur-[120px]" />
        
        <div className="max-w-7xl mx-auto px-4 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">It doesn't just read data. <br /> It checks the math.</h2>
            <p className="text-lg md:text-xl text-slate-600 mb-10 leading-relaxed font-medium">
              Standard OCR tools just transcribe what they see—even mistakes. Auditor AI uses an integrated Financial Auditor logic that validates every entry. 
            </p>
            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <CheckCircle2 className="text-blue-500 w-6 h-6 shrink-0" />
                <span>Detection of duplicate invoice numbers across your team.</span>
              </li>
              <li className="flex items-start space-x-3">
                <CheckCircle2 className="text-blue-500 w-6 h-6 shrink-0" />
                <span>Smart category mapping based on vendor historical context.</span>
              </li>
              <li className="flex items-start space-x-3">
                <CheckCircle2 className="text-blue-500 w-6 h-6 shrink-0" />
                <span>Confidence scoring based on mathematical consistency.</span>
              </li>
            </ul>
          </div>
          
          <div className="lg:w-1/2 relative">
            <div className="bg-slate-800 rounded-2xl p-4 border border-slate-700 shadow-2xl transform rotate-2">
               <div className="flex items-center space-x-2 mb-4 border-b border-slate-700 pb-3">
                 <div className="flex space-x-1">
                   {[1,2,3].map(i => <div key={i} className="w-2 h-2 rounded-full bg-slate-600" />)}
                 </div>
                 <div className="text-[10px] text-slate-500 font-mono underline decoration-blue-500">AUDIT_VERIFICATION_v2.0</div>
               </div>
               <div className="space-y-3 font-mono text-xs">
                 <div className="text-emerald-400">✓ Extracted Vendor: "Apple Store"</div>
                 <div className="text-emerald-400">✓ Subtotal ($99.00) + Tax ($8.17) = $107.17</div>
                 <div className="text-blue-400 animate-pulse">Running Auditor check...</div>
                 <div className="text-slate-300">Confidence: 99.8% Perfect Match</div>
               </div>
            </div>
            <div className="absolute -bottom-6 -right-6 bg-blue-600 rounded-xl p-4 shadow-xl border border-blue-400 transform -rotate-1 hidden md:block">
              <div className="text-[10px] text-blue-100 font-bold mb-1 uppercase tracking-widest">Revenue Status</div>
              <div className="text-xl font-black text-white">$43,102.50</div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-96 bg-blue-100/20 blur-[120px] -z-10" />
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-black mb-4 tracking-tight">Simple, Honest <span className="text-blue-600">Pricing.</span></h2>
            <p className="text-slate-500 font-bold max-w-xl mx-auto italic">Start for free, upgrade when you realize how much time you're saving.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <PricingCard 
              title="Individual"
              price="₹0"
              features={[
                "5 AI Scans / Month", 
                "Standard Math Audit", 
                "CSV & JSON Exports", 
                "7-Day History", 
                "Community Support"
              ]}
              buttonText="Start Scanning"
              cta={() => navigate('/auth')}
            />
            <PricingCard 
              title="Professional"
              price="₹500"
              highlight={true}
              features={[
                "Unlimited AI Scans", 
                "Advanced Math Audit", 
                "Excel (.xlsx) Export", 
                "Web Vendor Verification", 
                "Search Grounding",
                "Priority AI Processing",
                "Lifetime History"
              ]}
              buttonText="Join Waitlist"
              cta={() => setWaitlistOpen(true)}
              subtitle="Pricing not finalized. Join waitlist for early access pricing."
            />
            <PricingCard 
              title="Enterprise"
              price="Custom"
              features={[
                "Deep Vision Processing", 
                "Custom Audit Policies", 
                "ERP Integration", 
                "Priority Support",
                "SLA Guarantees"
              ]}
              buttonText="Talk to Founder"
              cta={() => window.location.href = 'mailto:Voidthoughts.official@gmail.com?subject=Enterprise Inquiry: Auditor AI'}
            />
          </div>
          
          <div className="mt-16 text-center">
            <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Trusted for accuracy by</p>
            <div className="flex flex-wrap justify-center items-center gap-8 opacity-30 grayscale contrast-200">
               <span className="text-lg font-black tracking-tighter">FINANCE.LLP</span>
               <span className="text-lg font-black tracking-tighter">CORP_LEDGER</span>
               <span className="text-lg font-black tracking-tighter">AUDIT_FLOW</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer Section Wrapper */}
      <div className="py-12 bg-white border-t border-slate-100">
         <div className="max-w-7xl mx-auto px-4">
            <Footer />
         </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: any) {
  return (
    <div className="p-8 bg-white border border-slate-100 rounded-3xl hover:shadow-xl hover:shadow-slate-100 transition-all group">
      <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl font-bold mb-3">{title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed font-medium">{description}</p>
    </div>
  );
}

function PricingCard({ title, price, features, highlight, buttonText, cta, subtitle }: any) {
  return (
    <div className={`p-8 md:p-10 rounded-3xl border ${highlight ? 'bg-slate-900 text-white border-slate-900 shadow-2xl shadow-blue-200' : 'bg-white border-slate-100 shadow-sm'} flex flex-col relative overflow-hidden group`}>
      {highlight && <div className="absolute top-0 right-0 bg-blue-600 text-[10px] text-white font-bold px-4 py-1.5 uppercase tracking-widest rounded-bl-xl border-b border-l border-blue-400">Best Value</div>}
      <h3 className="text-xl font-bold mb-2 tracking-tight">{title}</h3>
      <div className="flex items-baseline mb-2">
        <span className="text-4xl font-black">{price}</span>
        {price.startsWith('₹') && (
          <span className={`text-sm ${highlight ? 'text-slate-400' : 'text-slate-500'} ml-1 font-bold`}>/mo</span>
        )}
      </div>
      {subtitle && <p className={`text-[10px] font-bold italic mb-6 ${highlight ? 'text-blue-400' : 'text-slate-400'}`}>{subtitle}</p>}
      <ul className="space-y-4 mb-10 flex-1">
        {features.map((f: any, i: number) => (
          <li key={i} className="flex items-center space-x-3 text-[13px] font-bold">
            <CheckCircle2 className={`w-5 h-5 ${highlight ? 'text-blue-500' : 'text-emerald-500'}`} />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button 
        onClick={cta}
        className={`w-full py-4 rounded-2xl font-bold transition-all transform active:scale-95 ${highlight ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-900/50' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}`}
      >
        {buttonText}
      </button>
    </div>
  );
}
