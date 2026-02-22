"use client";

import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description?: string;
  action: () => void;
}

export interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Don't trigger shortcuts when typing in input fields
      const target = event.target as HTMLElement;
      const isInputField =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Allow some shortcuts even in input fields
      const allowedInInput = ["Escape", "ArrowUp", "ArrowDown", "Enter"];

      if (isInputField && !allowedInInput.includes(event.key)) {
        return;
      }

      // Find matching shortcut
      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const metaMatch = !!shortcut.meta === event.metaKey;
        const shiftMatch = !!shortcut.shift === event.shiftKey;
        const altMatch = !!shortcut.alt === event.altKey;

        // For shortcuts without modifiers, only trigger if no modifiers are pressed
        if (!shortcut.ctrl && !shortcut.meta && !shortcut.shift && !shortcut.alt) {
          if (keyMatch && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            shortcut.action();
            return;
          }
        } else {
          // For shortcuts with modifiers, all must match
          if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
            event.preventDefault();
            shortcut.action();
            return;
          }
        }
      }
    },
    [shortcuts, enabled]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

// Predefined shortcuts for the app
export const DEFAULT_SHORTCUTS: KeyboardShortcut[] = [
  {
    key: "k",
    ctrl: true,
    description: "Open search",
    action: () => {
      const searchInput = document.querySelector(
        'input[placeholder*="Search"]'
      ) as HTMLInputElement;
      searchInput?.focus();
    },
  },
  {
    key: "n",
    ctrl: true,
    description: "Create new item",
    action: () => {
      // Dispatch custom event or find create button
      const createButton = document.querySelector(
        '[data-action="create"], button:has-text("New"), button:has-text("Add")'
      ) as HTMLButtonElement;
      createButton?.click();
    },
  },
  {
    key: "Escape",
    description: "Close modal / Clear selection",
    action: () => {
      // Close any open modals
      const modal = document.querySelector('[role="dialog"]') as HTMLElement;
      if (modal) {
        const closeButton = modal.querySelector('button[aria-label="Close"]') || modal.querySelector('.close-button');
        (closeButton as HTMLElement)?.click();
      }
    },
  },
  {
    key: "?",
    shift: true,
    description: "Show keyboard shortcuts",
    action: () => {
      // Toggle shortcuts help modal
      window.dispatchEvent(new CustomEvent("toggle-shortcuts-help"));
    },
  },
];

export default useKeyboardShortcuts;
