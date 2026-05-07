import React, { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, ArrowLeft, ShieldCheck, BarChart2, FileText, Home, User as UserIcon } from "lucide-react";
import Footer from "../components/Footer";
import { Sidebar, MobileNav } from "../components/Navigation";
import { useAuth } from "../context/AuthContext";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export default function Analytics({ expenses }: { expenses: any[] }) {
  const navigate = useNavigate();
  const [data, setData] = useState<{ date: string; amount: number }[]>([]);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    // Group by date
    const grouped = expenses.reduce((acc, exp) => {
      acc[exp.date] = (acc[exp.date] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    const sorted = Object.keys(grouped).sort().map(date => ({ date, amount: grouped[date] }));
    setData(sorted);

    // Group by category
    const catGrouped = expenses.reduce((acc, exp) => {
      const cat = exp.category || 'Other';
      acc[cat] = (acc[cat] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    setPieData(Object.keys(catGrouped).map(name => ({ name, value: catGrouped[name] })));
  }, [expenses]);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 p-4 md:p-8 pb-24 lg:pb-8">
        <header className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => navigate(-1)} 
              className="p-2 hover:bg-white rounded-xl transition-colors border border-slate-200 shadow-sm"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Analytics</h1>
              <p className="text-slate-500 font-medium text-sm mt-1">Insights from your audited receipts.</p>
            </div>
          </div>
        </header>

        {/* Mobile Navigation */}
        <MobileNav />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-6">Spending Overview</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.5} />
                    <XAxis dataKey="date" tick={{fontSize: 12}} />
                    <YAxis tick={{fontSize: 12}} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f3f4f6' }} />
                    <Line type="monotone" dataKey="amount" stroke="#000" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-6">Spending by Category</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #f3f4f6' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {pieData.map((entry, index) => (
                  <div key={entry.name} className="flex items-center text-xs text-gray-600">
                    <span className="w-3 h-3 rounded-full mr-1" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    {entry.name}
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <div className="mt-12">
            <Footer />
          </div>
      </main>
    </div>
  );
}
