import React from 'react';

export default function HeroVisual() {
  return (
    <div className="w-full max-w-[600px] mx-auto lg:mx-0">
      <style>{`
        @keyframes fadeIn {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        @keyframes checkPop {
          0% { opacity: 0; transform: translateY(4px) scale(0.9); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* 8 Second Cycle: 0s -> 7s Animation, 7s -> 8s Pause & Reset */
        .anim-group {
          animation: globalReset 8s infinite;
        }

        @keyframes globalReset {
          0%, 85% { opacity: 1; }
          86%, 100% { opacity: 0; }
        }

        .line { opacity: 0; animation: fadeIn 0.4s ease forwards; }
        .output-row { opacity: 0; animation: fadeIn 0.4s ease forwards; }
        .badge { opacity: 0; animation: checkPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

        /* Receipt Line Timings (Staggered 0.3s) */
        .line-1 { animation-delay: 0.2s; } /* Header */
        .line-2 { animation-delay: 0.5s; } /* Date */
        .line-3 { animation-delay: 0.8s; } /* Item 1 */
        .line-4 { animation-delay: 1.1s; } /* Item 2 */
        .line-5 { animation-delay: 1.4s; } /* Item 3 */
        .line-6 { animation-delay: 1.7s; } /* Subtotal */
        .line-7 { animation-delay: 2.0s; } /* Tax */
        .line-8 { animation-delay: 2.3s; } /* Total */

        /* Output Row Timings (Staggered 0.4s, starting after Receipt) */
        .row-1 { animation-delay: 2.7s; } /* Vendor */
        .row-2 { animation-delay: 3.1s; } /* Date */
        .row-3 { animation-delay: 3.5s; } /* Items */
        .row-4 { animation-delay: 3.9s; } /* Subtotal */
        .row-5 { animation-delay: 4.3s; } /* Tax */
        .row-6 { animation-delay: 4.7s; } /* Total */
        .badge { animation-delay: 5.5s; } /* Math Verified */

        @media (prefers-reduced-motion: reduce) {
          .line, .output-row, .badge, .anim-group {
            animation: none !important;
            opacity: 1 !important;
          }
        }
      `}</style>
      
      <svg viewBox="0 0 540 300" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
        <defs>
          <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000" floodOpacity="0.06" />
          </filter>
        </defs>

        <g className="anim-group">
          {/* Left Panel: Paper Receipt */}
          <g transform="translate(20, 20)">
            <rect width="210" height="260" rx="2" fill="white" filter="url(#shadow)" />
            <path d="M 0 255 Q 5 265 10 255 Q 15 245 20 255 Q 25 265 30 255 Q 35 245 40 255 L 210 255 L 210 250 L 0 250 Z" fill="#f8fafc" />
            
            <g transform="translate(15, 30)" style={{ fontFamily: '"Courier New", Courier, monospace' }}>
              <text y="0" fontSize="11" fontWeight="bold" fill="#1e293b" className="line line-1">BLUE BOTTLE COFFEE</text>
              <text y="20" fontSize="9" fill="#64748b" className="line line-2">March 15, 2026</text>
              
              <line x1="0" y1="35" x2="180" y2="35" stroke="#e2e8f0" strokeWidth="1" strokeDasharray="2 2" />
              
              <g transform="translate(0, 60)" className="line line-3">
                <text fontSize="10" fill="#475569">Cappuccino</text>
                <text x="180" textAnchor="end" fontSize="10" fill="#1e293b" fontWeight="bold">$5.50</text>
              </g>
              
              <g transform="translate(0, 80)" className="line line-4">
                <text fontSize="10" fill="#475569">Croissant</text>
                <text x="180" textAnchor="end" fontSize="10" fill="#1e293b" fontWeight="bold">$4.25</text>
              </g>
              
              <g transform="translate(0, 100)" className="line line-5">
                <text fontSize="10" fill="#475569">Muffin</text>
                <text x="180" textAnchor="end" fontSize="10" fill="#1e293b" fontWeight="bold">$3.75</text>
              </g>
              
              <g transform="translate(0, 140)" className="line line-6">
                <text x="110" fontSize="9" fill="#94a3b8">Subtotal</text>
                <text x="180" textAnchor="end" fontSize="9" fill="#475569">$13.50</text>
              </g>
              
              <g transform="translate(0, 155)" className="line line-7">
                <text x="110" fontSize="9" fill="#94a3b8">Tax (8.75%)</text>
                <text x="180" textAnchor="end" fontSize="9" fill="#475569">$1.18</text>
              </g>
              
              <line x1="120" y1="165" x2="180" y2="165" stroke="#e2e8f0" strokeWidth="1" />
              
              <g transform="translate(0, 185)" className="line line-8">
                <text x="110" fontSize="10" fontWeight="bold" fill="#1e293b">Total</text>
                <text x="180" textAnchor="end" fontSize="11" fontWeight="bold" fill="#1e293b">$14.68</text>
              </g>
            </g>
          </g>

          {/* Connection Line */}
          <g transform="translate(230, 150)">
            <path d="M 0 0 L 60 0" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M 55 -4 L 63 0 L 55 4" fill="#cbd5e1" />
          </g>

          {/* Right Panel: Data Card */}
          <g transform="translate(310, 20)">
            <rect width="210" height="260" rx="12" fill="white" filter="url(#shadow)" />
            
            <g transform="translate(20, 25)" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
              <text fontSize="9" fontWeight="800" fill="#94a3b8" letterSpacing="0.05em">AUDITED DATA</text>
              
              {/* Row 1: Vendor */}
              <g transform="translate(0, 35)" className="output-row row-1">
                <text fontSize="8" fontWeight="bold" fill="#64748b">Vendor:</text>
                <text x="50" fontSize="10" fontWeight="bold" fill="#1e293b">Blue Bottle Coffee</text>
                <text x="160" fontSize="10" fill="#10b981" fontWeight="bold">✓</text>
              </g>

              {/* Row 2: Date */}
              <g transform="translate(0, 60)" className="output-row row-2">
                <text fontSize="8" fontWeight="bold" fill="#64748b">Date:</text>
                <text x="50" fontSize="10" fontWeight="bold" fill="#1e293b">2026-03-15</text>
                <text x="160" fontSize="10" fill="#10b981" fontWeight="bold">✓</text>
              </g>

              {/* Row 3: Items */}
              <g transform="translate(0, 85)" className="output-row row-3">
                <text fontSize="8" fontWeight="bold" fill="#64748b">Items:</text>
                <text x="50" fontSize="10" fontWeight="bold" fill="#1e293b">3 components</text>
                <text x="160" fontSize="10" fill="#10b981" fontWeight="bold">✓</text>
              </g>

              <line x1="0" y1="105" x2="170" y2="105" stroke="#f1f5f9" strokeWidth="1" />

              {/* Row 4: Subtotal */}
              <g transform="translate(0, 125)" className="output-row row-4">
                <text fontSize="8" fontWeight="bold" fill="#64748b">Subtotal:</text>
                <text x="130" textAnchor="end" fontSize="10" fontWeight="bold" fill="#1e293b">$13.50</text>
                <text x="160" fontSize="10" fill="#10b981" fontWeight="bold">✓</text>
              </g>

              {/* Row 5: Tax */}
              <g transform="translate(0, 145)" className="output-row row-5">
                <text fontSize="8" fontWeight="bold" fill="#64748b">Tax:</text>
                <text x="130" textAnchor="end" fontSize="10" fontWeight="bold" fill="#1e293b">$1.18</text>
                <text x="160" fontSize="10" fill="#10b981" fontWeight="bold">✓</text>
              </g>

              {/* Row 6: Total */}
              <g transform="translate(0, 175)" className="output-row row-6">
                <text fontSize="10" fontWeight="800" fill="#1e293b">TOTAL:</text>
                <text x="130" textAnchor="end" fontSize="14" fontWeight="900" fill="#3b82f6">$14.68</text>
                <text x="160" fontSize="10" fill="#10b981" fontWeight="bold">✓</text>
              </g>

              {/* Final Badge */}
              <g transform="translate(0, 205)" className="badge">
                <rect width="170" height="24" rx="12" fill="#f0fdf4" stroke="#10b981" strokeWidth="1" />
                <text x="85" y="16" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#166534" letterSpacing="0.02em">✓ AUDIT MATH VERIFIED</text>
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
