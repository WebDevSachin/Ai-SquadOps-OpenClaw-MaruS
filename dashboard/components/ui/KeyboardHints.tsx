"use client";

import { useState, useEffect } from "react";
import { Keyboard, X } from "lucide-react";

interface KeyboardHint {
  key: string;
  description: string;
}

interface KeyboardHintsProps {
  hints?: KeyboardHint[];
  className?: string;
}

const DEFAULT_HINTS: KeyboardHint[] = [
  { key: "Ctrl + K", description: "Search" },
  { key: "Ctrl + N", description: "New item" },
  { key: "?", description: "Show shortcuts" },
  { key: "Esc", description: "Close modal" },
];

export function KeyboardHints({
  hints = DEFAULT_HINTS,
  className = "",
}: KeyboardHintsProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show hints after a delay on desktop
    const timer = setTimeout(() => {
      if (window.innerWidth >= 1024 && !dismissed) {
        setIsVisible(true);
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [dismissed]);

  // Listen for the toggle shortcuts help event
  useEffect(() => {
    const handleToggle = () => {
      setIsVisible((prev) => !prev);
    };

    window.addEventListener("toggle-shortcuts-help", handleToggle);
    return () => window.removeEventListener("toggle-shortcuts-help", handleToggle);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-4 animate-slide-up ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-300">
          <Keyboard className="w-4 h-4" />
          <span className="text-sm font-medium">Keyboard Shortcuts</span>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setDismissed(true);
          }}
          className="p-1 text-gray-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Hints List */}
      <div className="space-y-2">
        {hints.map((hint) => (
          <div key={hint.key} className="flex items-center justify-between gap-4">
            <span className="text-sm text-gray-400">{hint.description}</span>
            <kbd className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs text-gray-300 font-mono">
              {hint.key}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

// Compact keyboard shortcut indicator for headers
export function KeyboardShortcutHint({ className = "" }: { className?: string }) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setShowHint(true);
        setTimeout(() => setShowHint(false), 2000);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (!showHint) return null;

  return (
    <div
      className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in ${className}`}
    >
      Press <kbd className="px-1.5 py-0.5 bg-gray-700 rounded mx-1">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-gray-700 rounded mx-1">K</kbd> to search
    </div>
  );
}

export default KeyboardHints;
