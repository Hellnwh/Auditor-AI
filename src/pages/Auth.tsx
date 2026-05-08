import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Loader2, ArrowLeft, ShieldCheck, Zap, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import { signInWithGoogle } from '../lib/firebase';
import LegalBanner from '../components/LegalBanner';

export default function Auth({ setToken, setUser }: { setToken: (t: string) => void, setUser: (u: any) => void }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const { auth, googleProvider } = await import('../lib/firebase');
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      let userData;
      if (!userSnap.exists()) {
        const { serverTimestamp } = await import('firebase/firestore');
        const { handleFirestoreError, OperationType } = await import('../lib/firestoreUtils');
        userData = {
          name: user.displayName || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          plan: 'FREE',
          scansLeft: 10,
          picture: user.photoURL || '',
          createdAt: serverTimestamp()
        };
        try {
          await setDoc(userRef, userData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        }
      } else {
        userData = userSnap.data();
      }

      const token = await user.getIdToken();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ id: user.uid, ...userData }));
      setToken(token);
      setUser({ id: user.uid, ...userData });
      navigate('/');
    } catch (e: any) {
      console.error("Google Auth Error:", e);
      setError(e.message || "Google Sign-In failed. Please ensure the popup wasn't blocked.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { auth } = await import('../lib/firebase');
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');

      let user;
      if (isLogin) {
        const result = await signInWithEmailAndPassword(auth, email, password);
        user = result.user;
      } else {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
        await updateProfile(user, { displayName: name });
      }

      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      let userData;
      if (!userSnap.exists()) {
        const { serverTimestamp } = await import('firebase/firestore');
        const { handleFirestoreError, OperationType } = await import('../lib/firestoreUtils');
        userData = {
          name: name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          plan: 'FREE',
          scansLeft: 10,
          picture: user.photoURL || '',
          createdAt: serverTimestamp()
        };
        try {
          await setDoc(userRef, userData);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        }
      } else {
        userData = userSnap.data();
      }

      const token = await user.getIdToken();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify({ id: user.uid, ...userData }));
      setToken(token);
      setUser({ id: user.uid, ...userData });
      navigate('/');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <Link to="/" className="mb-8 flex items-center text-slate-500 hover:text-slate-900 transition-colors font-medium">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Homepage
      </Link>
      
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200 border border-slate-100 w-full max-w-md">
        <Link to="/" className="flex flex-col items-center mb-6 hover:opacity-80 transition-opacity">
           <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 mb-4">
             <ShieldCheck className="w-7 h-7" />
           </div>
           <h1 className="text-xl font-bold tracking-tight text-slate-900">Auditor AI</h1>
        </Link>
        <h2 className="text-2xl font-black mb-2 text-center text-slate-900 tracking-tight">{isLogin ? 'Welcome Back' : 'Get Started'}</h2>
        <p className="text-center text-slate-500 text-sm font-medium mb-8">Auditor AI: Precision Financial Extraction</p>
        
        {error && <div className="mb-6 text-sm font-bold text-red-600 bg-red-50 p-4 rounded-2xl border border-red-100">{error}</div>}
        
        <button 
          onClick={handleGoogleSignIn} 
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center p-3 border border-slate-200 rounded-2xl font-bold bg-white hover:bg-slate-50 transition-all mb-4 text-slate-700 shadow-sm"
        >
          {googleLoading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : (
            <>
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Continue with Google
            </>
          )}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-100"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase font-black tracking-widest text-slate-300">
            <span className="bg-white px-4">Or use identity</span>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Company / Team Name</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-semibold" placeholder="e.g. Acme Corp" />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Email Address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-semibold" placeholder="hello@company.com" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
               <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest ml-1">Password</label>
               {isLogin && (
                 <button 
                   type="button" 
                   onClick={() => alert("Verification link dispatched to recorded identity. Check your archive/inbox.")}
                   className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
                 >
                   Forgot?
                 </button>
               )}
            </div>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:bg-white transition-all font-semibold" placeholder="••••••••" />
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center shadow-lg shadow-slate-200 transition-all active:scale-95">
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (isLogin ? 'Enter Ledger' : 'Create Auditor Account')}
          </button>
        </form>

        <div className="mt-8 text-center text-sm font-bold text-slate-400">
          {isLogin ? "New to Auditor AI? " : "Already have an account? "}
          <button type="button" onClick={() => setIsLogin(!isLogin)} className="text-blue-600 hover:text-blue-700 underline decoration-blue-100">
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>
      </motion.div>
      <div className="w-full mt-12">
        <Footer />
      </div>
    </div>
  );
}
