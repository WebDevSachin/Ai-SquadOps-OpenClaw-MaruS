"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface ImpersonationContextType {
  isImpersonating: boolean;
  originalUser: User | null;
  impersonatedUser: User | null;
  startImpersonation: (user: User) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const STORAGE_KEY = "impersonation_data";

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    isImpersonating: boolean;
    originalUser: User | null;
    impersonatedUser: User | null;
  }>(() => {
    // Load from localStorage on init
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    }
    return {
      isImpersonating: false,
      originalUser: null,
      impersonatedUser: null,
    };
  });

  const startImpersonation = useCallback((user: User) => {
    // Store current admin user before switching
    const currentUserStr = localStorage.getItem("user");
    const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;
    
    const newState = {
      isImpersonating: true,
      originalUser: currentUser,
      impersonatedUser: user,
    };
    
    setState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    
    // Temporarily switch the user in localStorage
    localStorage.setItem("user", JSON.stringify(user));
    
    // Reload to apply changes
    window.location.reload();
  }, []);

  const stopImpersonation = useCallback(() => {
    // Restore original user
    if (state.originalUser) {
      localStorage.setItem("user", JSON.stringify(state.originalUser));
    }
    
    localStorage.removeItem(STORAGE_KEY);
    setState({
      isImpersonating: false,
      originalUser: null,
      impersonatedUser: null,
    });
    
    // Reload to apply changes
    window.location.reload();
  }, [state.originalUser]);

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: state.isImpersonating,
        originalUser: state.originalUser,
        impersonatedUser: state.impersonatedUser,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation(): ImpersonationContextType {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
}
