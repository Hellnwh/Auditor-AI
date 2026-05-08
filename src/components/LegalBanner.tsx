import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function LegalBanner() {
  return (
    <div className="bg-amber-50 border-b border-amber-100 py-2.5 px-4">
      <div className="max-w-7xl mx-auto flex items-center justify-center space-x-3 text-center">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-[11px] md:text-xs font-bold text-amber-800 uppercase tracking-wider">
          <span className="opacity-70">Public Beta:</span> Auditor AI is currently under active development. 
          Use for informational purposes only. We assume no legal or financial liability.
        </p>
      </div>
    </div>
  );
}
