import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, Home, BarChart2, FileText, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden lg:flex flex-col fixed inset-y-0 shadow-sm z-30">
      <div className="p-6 border-b border-slate-50 flex items-center space-x-2">
        <Link to="/" className="flex items-center space-x-2 w-full">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">Auditor AI</span>
        </Link>
        {user?.plan !== "FREE" && (
          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold uppercase">{user?.plan}</span>
        )}
      </div>

      <nav className="p-4 space-y-1 flex-1">
        <Link to="/" className={`flex items-center px-4 py-2.5 rounded-xl font-semibold transition-all ${location.pathname === "/" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
          <Home className="w-5 h-5 mr-3" /> Home
        </Link>
        <Link to="/analytics" className={`flex items-center px-4 py-2.5 rounded-xl font-semibold transition-all ${location.pathname === "/analytics" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
          <BarChart2 className="w-5 h-5 mr-3" /> Analytics
        </Link>
        <Link to="/reports" className={`flex items-center px-4 py-2.5 rounded-xl font-semibold transition-all ${location.pathname === "/reports" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
          <FileText className="w-5 h-5 mr-3" /> Reports
        </Link>
        <Link to="/settings" className={`flex items-center px-4 py-2.5 rounded-xl font-semibold transition-all ${location.pathname === "/settings" ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}>
          <UserIcon className="w-5 h-5 mr-3" /> Audit Account
        </Link>
      </nav>

      <div className="p-4 border-t border-slate-50 space-y-3">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-4 text-white shadow-xl shadow-blue-100 relative overflow-hidden group">
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform" />
          <div className="text-[10px] font-bold uppercase tracking-widest text-blue-100 mb-1 opacity-80">Cloud Backup</div>
          <p className="text-sm font-bold mb-3 leading-tight text-white relative z-10">
            {user?.plan === "FREE" ? "Get Unlimited AI Scans & Pro Backup" : "Your enterprise dashboard is live."}
          </p>
          {user?.plan === "FREE" && (
            <button 
              className="w-full bg-white text-blue-700 py-2 rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm relative z-10" 
              onClick={() => alert("Premium access is currently available via custom invoice. Please contact support.")}
            >
              Upgrade Now
            </button>
          )}
        </div>
        
        <button onClick={logout} className="w-full flex items-center px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-all">
          <LogOut className="w-5 h-5 mr-3" /> Logout
        </button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { logout } = useAuth();
  const location = useLocation();

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-6 py-3 flex items-center justify-between z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
      <Link to="/" className={`flex flex-col items-center space-y-1 ${location.pathname === "/" ? "text-blue-600" : "text-slate-400"}`}>
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-bold">Home</span>
      </Link>
      <Link to="/analytics" className={`flex flex-col items-center space-y-1 ${location.pathname === "/analytics" ? "text-blue-600" : "text-slate-400"}`}>
        <BarChart2 className="w-5 h-5" />
        <span className="text-[10px] font-bold">Analytics</span>
      </Link>
      <Link to="/reports" className={`flex flex-col items-center space-y-1 ${location.pathname === "/reports" ? "text-blue-600" : "text-slate-400"}`}>
        <FileText className="w-5 h-5" />
        <span className="text-[10px] font-bold">Reports</span>
      </Link>
      <Link to="/settings" className={`flex flex-col items-center space-y-1 ${location.pathname === "/settings" ? "text-blue-600" : "text-slate-400"}`}>
        <UserIcon className="w-5 h-5" />
        <span className="text-[10px] font-bold">Audit Account</span>
      </Link>
      <button onClick={logout} className="flex flex-col items-center space-y-1 text-red-500">
        <LogOut className="w-5 h-5" />
        <span className="text-[10px] font-bold">Logout</span>
      </button>
    </div>
  );
}
