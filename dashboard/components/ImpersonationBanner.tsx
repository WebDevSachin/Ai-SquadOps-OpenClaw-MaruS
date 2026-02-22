"use client";

import { Shield, LogOut } from "lucide-react";
import { useImpersonation } from "@/hooks/useImpersonation";

export function ImpersonationBanner() {
  const { isImpersonating, impersonatedUser, originalUser, stopImpersonation } = useImpersonation();

  if (!isImpersonating) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 shadow-lg">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5" />
          <span className="font-medium">
            Impersonating: <strong>{impersonatedUser?.name}</strong> ({impersonatedUser?.email}) - {impersonatedUser?.role}
          </span>
          <span className="text-amber-200 text-sm">
            (Original: {originalUser?.email})
          </span>
        </div>
        <button
          onClick={stopImpersonation}
          className="flex items-center gap-2 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          Exit Impersonation
        </button>
      </div>
    </div>
  );
}
